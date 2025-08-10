import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { withApi } from '../../../../lib/api';

export const dynamic = 'force-dynamic';

export const GET = withApi(async (req: Request) => {
  void req; // intentionally unused
  const weeks = await prisma.week.findMany({
    orderBy: { startDate: 'desc' },
    take: 20,
  });
  return NextResponse.json({ weeks });
});
