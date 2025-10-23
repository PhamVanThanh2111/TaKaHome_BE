import { MigrationInterface, QueryRunner } from 'typeorm';

export class MoveServiceTypeToInvoiceItem1761220000000 implements MigrationInterface {
  name = 'MoveServiceTypeToInvoiceItem1761220000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add serviceType column to invoice_item table
    await queryRunner.query(`
      ALTER TABLE "invoice_item" 
      ADD "serviceType" "public"."invoice_servicetype_enum"
    `);

    // Drop unique index from invoice table
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_invoice_contract_servicetype_billingperiod"
    `);

    // Remove serviceType column from invoice table
    await queryRunner.query(`
      ALTER TABLE "invoice" DROP COLUMN IF EXISTS "serviceType"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Add serviceType column back to invoice table
    await queryRunner.query(`
      ALTER TABLE "invoice" 
      ADD "serviceType" "public"."invoice_servicetype_enum"
    `);

    // Recreate unique index on invoice table
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_invoice_contract_servicetype_billingperiod" 
      ON "invoice" ("contractId", "serviceType", "billingPeriod") 
      WHERE "serviceType" IS NOT NULL AND "billingPeriod" IS NOT NULL
    `);

    // Remove serviceType column from invoice_item table
    await queryRunner.query(`
      ALTER TABLE "invoice_item" DROP COLUMN "serviceType"
    `);
  }
}