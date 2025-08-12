import { NextResponse } from 'next/server';
import { withApi } from '../../../../../lib/api';
import prisma from '../../../../../lib/prisma';

export const dynamic = 'force-dynamic';

export const GET = withApi(async (req: Request) => {
  const url = new URL(req.url);
  const week = url.searchParams.get('week') || 'latest';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '5'), 50);

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
      return NextResponse.json({ stores: [] });
    }

    // Get top performing stores for the week by aggregating sales facts
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
      },
      take: limit
    });

    // Get store details
    const storeIds = storeRevenues.map(s => s.storeId);
    const stores = await prisma.store.findMany({
      where: {
        id: { in: storeIds }
      },
      select: {
        id: true,
        name: true,
        code: true,
        city: true,
        state: true
      }
    });

    const formattedStores = storeRevenues.map(sr => {
      const store = stores.find(s => s.id === sr.storeId);
      return {
        storeId: sr.storeId,
        storeName: store?.name || 'Unknown',
        storeCode: store?.code || 'Unknown',
        city: store?.city,
        state: store?.state,
        revenue: sr._sum.revenue || 0,
        units: sr._sum.units || 0,
        week: targetWeek.iso,
        store: store
      };
    }).filter(store => {
      // Filter out Ulta.com and e-commerce channels
      const name = store.store?.name?.toLowerCase() || '';
      const code = store.store?.code?.toLowerCase() || '';
      const isUltaCom = name.includes('ulta.com') || name === 'online' || name === 'web' ||
                       code === 'com' || code === 'web' || code === 'online' || code === 'ecom';
      return !isUltaCom;
    }).map(store => {
      // Remove the temporary store property
      const { store: _, ...cleanStore } = store;
      return cleanStore;
    });

    return NextResponse.json({ stores: formattedStores });
  } catch (error) {
    console.error('Error fetching top stores:', error);
    return NextResponse.json({ stores: [] });
  }
});
