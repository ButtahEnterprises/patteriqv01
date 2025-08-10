import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1) Ensure a sample ISO week exists
  await prisma.week.upsert({
    where: { iso: '2025-W32' },
    update: {},
    create: {
      iso: '2025-W32',
      year: 2025,
      startDate: new Date('2025-08-04'),
      endDate: new Date('2025-08-10'),
    },
  });

  // 2) One store (adjust unique field if your model differs)
  const store = await prisma.store.upsert({
    where: { code: 'ULTA-001' },
    update: {},
    create: { code: 'ULTA-001', name: 'Ulta Beauty #001', city: 'Chicago', state: 'IL' },
  });

  // 3) One SKU — find-or-create by UPC (unique)
  let sku = await prisma.sku.findFirst({ where: { upc: 'BTPH115US' } });
  if (!sku) {
    sku = await prisma.sku.create({
      data: {
        upc: 'BTPH115US',
        name: 'Buttah Facial Moisturizer',
        // If your Sku model has other REQUIRED fields, add them here (e.g., brand)
      },
    });
  }

  const week = await prisma.week.findUniqueOrThrow({ where: { iso: '2025-W32' } });

  // 4) One fact row so the app has data
  await prisma.salesFact.create({
    data: {
      units: 12,
      revenue: 382.0,
      week:  { connect: { id: week.id } },
      store: { connect: { id: store.id } },
      sku:   { connect: { id: sku.id } },
    },
  });

  console.log('✅ Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });