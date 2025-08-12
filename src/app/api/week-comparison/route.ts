import { NextResponse } from 'next/server';
import { withApi } from '../../../../lib/api';
import prisma from '../../../../lib/prisma';

export const dynamic = 'force-dynamic';

export const GET = withApi(async (req: Request) => {
  const url = new URL(req.url);
  const week = url.searchParams.get('week') || 'latest';

  try {
    // Get the specific week or latest week
    let targetWeek;
    if (week === 'latest') {
      targetWeek = await prisma.week.findFirst({
        where: { startDate: { lte: new Date() } },
        orderBy: { startDate: 'desc' }
      });
    } else {
      targetWeek = await prisma.week.findFirst({
        where: { iso: week }
      });
    }

    if (!targetWeek) {
      return NextResponse.json({ 
        comparison: {
          totalSales: { current: 0, previous: 0, change: 0 },
          unitsSold: { current: 0, previous: 0, change: 0 },
          activeSkus: { current: 0, previous: 0, change: 0 },
          activeStores: { current: 0, previous: 0, change: 0 }
        }
      });
    }

    // Get the previous week
    const previousWeek = await prisma.week.findFirst({
      where: { 
        startDate: { lt: targetWeek.startDate }
      },
      orderBy: { startDate: 'desc' }
    });

    // Get current week metrics using SalesFact
    const currentSalesAgg = await prisma.salesFact.aggregate({
      where: { weekId: targetWeek.id },
      _sum: { revenue: true, units: true }
    });

    const currentActiveSkus = await prisma.salesFact.count({
      where: { 
        weekId: targetWeek.id,
        units: { gt: 1 }
      }
    });

    const currentActiveStores = await prisma.salesFact.groupBy({
      by: ['storeId'],
      where: { 
        weekId: targetWeek.id,
        revenue: { gt: 0 }
      }
    });

    let previousSalesAgg = { _sum: { revenue: null as any, units: null as any } };
    let previousActiveSkus = 0;
    let previousActiveStores: { storeId: number }[] = [];

    if (previousWeek) {
      previousSalesAgg = await prisma.salesFact.aggregate({
        where: { weekId: previousWeek.id },
        _sum: { revenue: true, units: true }
      });

      previousActiveSkus = await prisma.salesFact.count({
        where: { 
          weekId: previousWeek.id,
          units: { gt: 1 }
        }
      });

      previousActiveStores = await prisma.salesFact.groupBy({
        by: ['storeId'],
        where: { 
          weekId: previousWeek.id,
          revenue: { gt: 0 }
        }
      });
    }

    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const currentSales = Number(currentSalesAgg._sum.revenue || 0);
    const previousSales = Number(previousSalesAgg._sum.revenue || 0);
    const currentUnits = currentSalesAgg._sum.units || 0;
    const previousUnits = previousSalesAgg._sum.units || 0;
    const currentSkus = currentActiveSkus;
    const previousSkus = previousActiveSkus;
    const currentStores = currentActiveStores.length;
    const previousStoresCount = previousActiveStores.length;

    return NextResponse.json({
      comparison: {
        totalSales: {
          current: currentSales,
          previous: previousSales,
          change: calculateChange(currentSales, previousSales)
        },
        unitsSold: {
          current: currentUnits,
          previous: previousUnits,
          change: calculateChange(currentUnits, previousUnits)
        },
        activeSkus: {
          current: currentSkus,
          previous: previousSkus,
          change: calculateChange(currentSkus, previousSkus)
        },
        activeStores: {
          current: currentStores,
          previous: previousStoresCount,
          change: calculateChange(currentStores, previousStoresCount)
        }
      },
      currentWeek: targetWeek.iso,
      previousWeek: previousWeek?.iso || null
    });
  } catch (error) {
    console.error('Error fetching week comparison:', error);
    return NextResponse.json({ 
      comparison: {
        totalSales: { current: 0, previous: 0, change: 0 },
        unitsSold: { current: 0, previous: 0, change: 0 },
        activeSkus: { current: 0, previous: 0, change: 0 },
        activeStores: { current: 0, previous: 0, change: 0 }
      }
    });
  }
});
