import { NextResponse } from 'next/server';
import { withApi } from '../../../../../lib/api';
import prisma from '../../../../../lib/prisma';

export const dynamic = 'force-dynamic';

export const GET = withApi(async (req: Request) => {
  const url = new URL(req.url);
  const week = url.searchParams.get('week') || 'latest';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);

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
      return NextResponse.json({ skus: [] });
    }

    // Get active SKUs (criteria: SKUs with more than one sale)
    const skus = await prisma.salesFact.findMany({
      where: { 
        weekId: targetWeek.id,
        units: { gt: 1 } // More than one sale
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
      orderBy: { revenue: 'desc' },
      take: limit
    });

    const formattedSkus = skus.map(s => ({
      skuId: s.sku.id,
      skuName: s.sku.name,
      brand: s.sku.brand,
      upc: s.sku.upc,
      revenue: s.revenue,
      units: s.units,
      week: targetWeek.iso
    }));

    return NextResponse.json({ skus: formattedSkus });
  } catch (error) {
    console.error('Error fetching active SKUs:', error);
    return NextResponse.json({ skus: [] });
  }
});
