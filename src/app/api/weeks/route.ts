import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { withApi } from '../../../../lib/api';

export const dynamic = 'force-dynamic';

export const GET = withApi(async (req: Request) => {
  void req; // intentionally unused
  const now = new Date();
  const weeks = await prisma.week.findMany({
    where: { startDate: { lte: now } },
    orderBy: { startDate: 'desc' },
    take: 104, // ~2 years of weeks
  });
  return NextResponse.json({ weeks });
});
