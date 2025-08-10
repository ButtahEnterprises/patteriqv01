-- CreateIndex
CREATE INDEX "SalesFact_storeId_weekId_idx" ON "app"."SalesFact"("storeId", "weekId");

-- CreateIndex
CREATE INDEX "Week_startDate_idx" ON "app"."Week"("startDate");
