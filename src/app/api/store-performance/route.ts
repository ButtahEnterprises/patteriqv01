import { NextResponse } from 'next/server';
import { withApi } from '../../../lib/api';
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
        bestStore: null,
        worstStore: null
      });
    }

    // Get store revenues for the week, excluding Ulta.com
    const storeRevenues = await prisma.salesFact.groupBy({
      by: ['storeId'],
      where: {
        weekId: targetWeek.id,
        revenue: { gt: 0 }
      },
      _sum: {
        revenue: true,
        units: true
      },
      orderBy: {
        _sum: {
          revenue: 'desc'
        }
      }
    });

    if (storeRevenues.length === 0) {
      return NextResponse.json({ 
        bestStore: null,
        worstStore: null
      });
    }

    // Get store details for best and worst performers
    const bestStoreId = storeRevenues[0].storeId;
    const worstStoreId = storeRevenues[storeRevenues.length - 1].storeId;

    const [bestStore, worstStore] = await Promise.all([
      prisma.store.findUnique({
        where: { id: bestStoreId },
        select: {
          id: true,
          name: true,
          code: true,
          city: true,
          state: true
        }
      }),
      prisma.store.findUnique({
        where: { id: worstStoreId },
        select: {
          id: true,
          name: true,
          code: true,
          city: true,
          state: true
        }
      })
    ]);

    // Filter out Ulta.com stores (e-commerce channels)
    const isUltaCom = (store: any) => {
      if (!store) return false;
      const name = store.name?.toLowerCase() || '';
      const code = store.code?.toLowerCase() || '';
      return name.includes('ulta.com') || name.includes('online') || name.includes('web') ||
             code.includes('com') || code.includes('web') || code.includes('online');
    };

    // Find best physical store (excluding Ulta.com)
    let bestPhysicalStore: any = null;
    let bestPhysicalRevenue = 0;
    
    for (const sr of storeRevenues) {
      const store = await prisma.store.findUnique({
        where: { id: sr.storeId },
        select: { id: true, name: true, code: true, city: true, state: true }
      });
      
      if (store && !isUltaCom(store)) {
        bestPhysicalStore = store;
        bestPhysicalRevenue = Number(sr._sum.revenue || 0);
        break;
      }
    }

    // Find worst physical store (excluding Ulta.com) - considering both WoW drop and no-sales streak
    let worstPhysicalStore: any = null;
    let worstPhysicalRevenue = 0;
    let worstWoWDrop = 0;
    let longestNoSalesStreak = 0;
    
    // Get previous week for WoW comparison
    const previousWeek = await prisma.week.findFirst({
      where: { startDate: { lt: targetWeek.startDate } },
      orderBy: { startDate: 'desc' }
    });
    
    let worstStoreCandidate: { id: number; code: string; name: string; city: string | null; state: string | null; } | null = null;
    let worstScore = 0; // Higher score = worse performance
    
    for (const sr of storeRevenues) {
      const store = await prisma.store.findUnique({
        where: { id: sr.storeId },
        select: { id: true, name: true, code: true, city: true, state: true }
      });
      
      if (store && !isUltaCom(store)) {
        const currentRevenue = Number(sr._sum.revenue || 0);
        
        // Calculate WoW drop
        let wowDrop = 0;
        if (previousWeek) {
          const previousRevenue = await prisma.salesFact.aggregate({
            where: { storeId: sr.storeId, weekId: previousWeek.id },
            _sum: { revenue: true }
          });
          const prevRev = Number(previousRevenue._sum.revenue || 0);
          if (prevRev > 0) {
            wowDrop = ((prevRev - currentRevenue) / prevRev) * 100; // Positive = drop
          }
        }
        
        // Calculate no-sales streak (weeks with zero sales)
        const recentWeeks = await prisma.week.findMany({
          where: { startDate: { lte: targetWeek.startDate } },
          orderBy: { startDate: 'desc' },
          take: 8 // Check last 8 weeks
        });
        
        let noSalesStreak = 0;
        for (const week of recentWeeks) {
          const weekRevenue = await prisma.salesFact.aggregate({
            where: { storeId: sr.storeId, weekId: week.id },
            _sum: { revenue: true }
          });
          if (Number(weekRevenue._sum.revenue || 0) === 0) {
            noSalesStreak++;
          } else {
            break; // Streak broken
          }
        }
        
        // Calculate composite worst score (higher = worse)
        // Weight: 60% WoW drop, 40% no-sales streak
        const score = (wowDrop * 0.6) + (noSalesStreak * 10 * 0.4);
        
        if (score > worstScore) {
          worstScore = score;
          worstStoreCandidate = store;
          worstPhysicalRevenue = currentRevenue;
          worstWoWDrop = wowDrop;
          longestNoSalesStreak = noSalesStreak;
        }
      }
    }
    
    worstPhysicalStore = worstStoreCandidate;

    return NextResponse.json({
      bestStore: bestPhysicalStore ? {
        name: bestPhysicalStore.name,
        city: bestPhysicalStore.city,
        state: bestPhysicalStore.state,
        revenue: bestPhysicalRevenue,
        note: `Highest sales this week (excludes Ulta.com)`
      } : null,
      worstStore: worstPhysicalStore ? {
        name: worstPhysicalStore.name,
        city: worstPhysicalStore.city,
        state: worstPhysicalStore.state,
        revenue: worstPhysicalRevenue,
        wowDrop: worstWoWDrop,
        noSalesStreak: longestNoSalesStreak,
        note: `Worst performing: ${worstWoWDrop.toFixed(1)}% WoW drop, ${longestNoSalesStreak} weeks no sales`
      } : null
    });

  } catch (error) {
    console.error('Error fetching store performance:', error);
    return NextResponse.json({ 
      bestStore: null,
      worstStore: null
    }, { status: 500 });
  }
});
