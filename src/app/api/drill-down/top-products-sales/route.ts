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
      return NextResponse.json({ products: [] });
    }

    // Get top products by sales for the week
    const products = await prisma.salesFact.findMany({
      where: { 
        weekId: targetWeek.id,
        revenue: { gt: 0 }
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

    const formattedProducts = products.map(p => ({
      skuId: p.sku.id,
      skuName: p.sku.name,
      brand: p.sku.brand,
      upc: p.sku.upc,
      revenue: p.revenue,
      units: p.units,
      week: targetWeek.iso
    }));

    return NextResponse.json({ products: formattedProducts });
  } catch (error) {
    console.error('Error fetching top products by sales:', error);
    return NextResponse.json({ products: [] });
  }
});
