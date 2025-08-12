import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get last 5 weeks of data to compare revenue
    const weeks = await prisma.week.findMany({
      where: { startDate: { lte: new Date() } },
      orderBy: { startDate: 'desc' },
      take: 5,
      select: {
        id: true,
        iso: true,
        startDate: true,
        endDate: true
      }
    });

    const weeklyRevenues = [];

    for (const week of weeks) {
      // Get revenue for this specific week
      const agg = await prisma.salesFact.aggregate({
        where: { weekId: week.id },
        _sum: { revenue: true, units: true }
      });

      // Get count of sales facts for this week
      const factCount = await prisma.salesFact.count({
        where: { weekId: week.id }
      });

      weeklyRevenues.push({
        weekId: week.id,
        weekIso: week.iso,
        startDate: week.startDate,
        endDate: week.endDate,
        revenue: agg._sum.revenue ? Number(agg._sum.revenue) : 0,
        units: agg._sum.units || 0,
        factCount: factCount
      });
    }

    return NextResponse.json({
      message: 'Revenue debug data for last 5 weeks',
      weeks: weeklyRevenues,
      totalWeeksInDB: weeks.length
    });

  } catch (error) {
    console.error('Error in revenue debug:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch revenue debug data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
