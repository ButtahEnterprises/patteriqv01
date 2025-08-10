-- CreateTable
CREATE TABLE "app"."Week" (
    "id" SERIAL NOT NULL,
    "iso" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Week_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."Store" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."Sku" (
    "id" SERIAL NOT NULL,
    "upc" TEXT,
    "brand" TEXT,
    "name" TEXT NOT NULL,

    CONSTRAINT "Sku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."SalesFact" (
    "id" SERIAL NOT NULL,
    "weekId" INTEGER NOT NULL,
    "storeId" INTEGER NOT NULL,
    "skuId" INTEGER NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "SalesFact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Week_iso_key" ON "app"."Week"("iso");

-- CreateIndex
CREATE UNIQUE INDEX "Store_code_key" ON "app"."Store"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Sku_upc_key" ON "app"."Sku"("upc");

-- CreateIndex
CREATE INDEX "SalesFact_weekId_storeId_skuId_idx" ON "app"."SalesFact"("weekId", "storeId", "skuId");

-- AddForeignKey
ALTER TABLE "app"."SalesFact" ADD CONSTRAINT "SalesFact_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "app"."Week"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."SalesFact" ADD CONSTRAINT "SalesFact_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "app"."Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."SalesFact" ADD CONSTRAINT "SalesFact_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "app"."Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
