import { NextResponse } from 'next/server';
import { withApi } from '../../../../lib/api';
import prisma from '../../../../lib/prisma';

export const dynamic = 'force-dynamic';

export const GET = withApi(async (req: Request) => {
  const url = new URL(req.url);
  const week = url.searchParams.get('week') || 'latest';

  try {
    // Get the specific week or latest week (using same logic as weekly-summary API)
    let targetWeek;
    if (week === 'latest') {
      targetWeek = await prisma.week.findFirst({
        orderBy: { startDate: 'desc' },
        select: { id: true, iso: true, startDate: true, endDate: true }
      });
    } else {
      targetWeek = await prisma.week.findFirst({
        where: { iso: week },
        select: { id: true, iso: true, startDate: true, endDate: true }
      });
    }

    if (!targetWeek) {
      return NextResponse.json({ 
        metrics: {
          unitsSold: 0,
          revenue: 0,
          topSkus: []
        }
      });
    }

    // Find Ulta.com store - try broader search patterns
    // First, let's get the store with the highest revenue to identify the e-commerce channel
    const topStoreByRevenue = await prisma.salesFact.groupBy({
      by: ['storeId'],
      where: {
        weekId: targetWeek.id,
        revenue: { gt: 0 }
      },
      _sum: {
        revenue: true
      },
      orderBy: {
        _sum: {
          revenue: 'desc'
        }
      },
      take: 1
    });

    let ultaComStore: any = null;
    
    if (topStoreByRevenue.length > 0) {
      // Get the top revenue store details
      const topStore = await prisma.store.findUnique({
        where: { id: topStoreByRevenue[0].storeId }
      });
      
      // If the top revenue store looks like an e-commerce channel, use it
      if (topStore) {
        const name = topStore.name?.toLowerCase() || '';
        const code = topStore.code?.toLowerCase() || '';
        
        // Check if it's likely an e-commerce channel
        if (name.includes('ulta') || name.includes('online') || name.includes('web') || name.includes('.com') ||
            code.includes('com') || code.includes('web') || code.includes('online') || code.includes('ulta')) {
          ultaComStore = topStore;
        }
      }
    }
    
    // If we didn't find it via top revenue, try the original search
    if (!ultaComStore) {
      ultaComStore = await prisma.store.findFirst({
        where: {
          OR: [
            { code: { contains: 'COM', mode: 'insensitive' } },
            { code: { contains: 'WEB', mode: 'insensitive' } },
            { code: { contains: 'ONLINE', mode: 'insensitive' } },
            { code: { contains: 'ULTA', mode: 'insensitive' } },
            { name: { contains: 'ulta.com', mode: 'insensitive' } },
            { name: { contains: 'online', mode: 'insensitive' } },
            { name: { contains: 'web', mode: 'insensitive' } },
            { name: { contains: '.com', mode: 'insensitive' } }
          ]
        }
      });
    }

    if (!ultaComStore) {
      // If no specific Ulta.com store found, return empty metrics
      return NextResponse.json({ 
        metrics: {
          unitsSold: 0,
          revenue: 0,
          topSkus: []
        }
      });
    }

    // Get Ulta.com metrics for the week
    const ultaComSales = await prisma.salesFact.aggregate({
      where: { 
        weekId: targetWeek.id,
        storeId: ultaComStore.id
      },
      _sum: { revenue: true, units: true }
    });

    // Get previous week for WoW comparison
    const previousWeek = await prisma.week.findFirst({
      where: { 
        startDate: { lt: targetWeek.startDate }
      },
      orderBy: { startDate: 'desc' }
    });

    let weekOverWeekChange: any = null;
    if (previousWeek) {
      const previousUltaComSales = await prisma.salesFact.aggregate({
        where: { 
          weekId: previousWeek.id,
          storeId: ultaComStore.id
        },
        _sum: { revenue: true, units: true }
      });

      const currentRevenue = Number(ultaComSales._sum.revenue || 0);
      const previousRevenue = Number(previousUltaComSales._sum.revenue || 0);
      const currentUnits = ultaComSales._sum.units || 0;
      const previousUnits = previousUltaComSales._sum.units || 0;

      weekOverWeekChange = {
        units: {
          current: currentUnits,
          previous: previousUnits,
          percentage: previousUnits > 0 ? ((currentUnits - previousUnits) / previousUnits) * 100 : 0
        },
        revenue: {
          current: currentRevenue,
          previous: previousRevenue,
          percentage: previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0
        }
      };
    }

    // Get top SKUs for Ulta.com
    const topSkus = await prisma.salesFact.findMany({
      where: { 
        weekId: targetWeek.id,
        storeId: ultaComStore.id,
        units: { gt: 0 }
      },
      include: {
        sku: {
          select: {
            id: true,
            name: true,
            brand: true,
            upc: true
          }
        }
      },
      orderBy: { units: 'desc' },
      take: 10
    });

    const formattedTopSkus = topSkus.map(s => ({
      skuId: s.sku.id,
      skuName: s.sku.name,
      brand: s.sku.brand,
      upc: s.sku.upc,
      revenue: Number(s.revenue || 0),
      units: s.units,
      week: targetWeek.iso
    }));

    return NextResponse.json({
      metrics: {
        unitsSold: ultaComSales._sum.units || 0,
        revenue: Number(ultaComSales._sum.revenue || 0),
        topSkus: formattedTopSkus,
        weekOverWeekChange: weekOverWeekChange
      },
      week: targetWeek.iso,
      storeInfo: {
        id: ultaComStore.id,
        name: ultaComStore.name,
        code: ultaComStore.code
      }
    });
  } catch (error) {
    console.error('Error fetching Ulta.com metrics:', error);
    return NextResponse.json({ 
      metrics: {
        unitsSold: 0,
        revenue: 0,
        topSkus: []
      }
    });
  }
});
