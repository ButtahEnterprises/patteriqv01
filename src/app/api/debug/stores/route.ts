import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get all stores to understand the data structure
    const stores = await prisma.store.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        city: true,
        state: true
      },
      orderBy: { name: 'asc' }
    });

    // Get revenue by store for latest week to identify highest revenue channel
    const latestWeek = await prisma.week.findFirst({
      where: { startDate: { lte: new Date() } },
      orderBy: { startDate: 'desc' }
    });

    let storeRevenues = [];
    if (latestWeek) {
      storeRevenues = await prisma.salesFact.groupBy({
        by: ['storeId'],
        where: {
          weekId: latestWeek.id,
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
        take: 10
      });
    }

    // Match stores with their revenue data
    const storesWithRevenue = storeRevenues.map(sr => {
      const store = stores.find(s => s.id === sr.storeId);
      return {
        ...store,
        revenue: sr._sum.revenue || 0,
        units: sr._sum.units || 0
      };
    });

    return NextResponse.json({
      totalStores: stores.length,
      allStores: stores.slice(0, 20), // First 20 stores
      topRevenueStores: storesWithRevenue,
      latestWeek: latestWeek?.iso
    });
  } catch (error) {
    console.error('Error fetching store debug data:', error);
    return NextResponse.json({ error: 'Failed to fetch store data' }, { status: 500 });
  }
}
