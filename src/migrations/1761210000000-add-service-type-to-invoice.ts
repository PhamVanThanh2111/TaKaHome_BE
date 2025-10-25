import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddServiceTypeToInvoice1761210000000 implements MigrationInterface {
  name = 'AddServiceTypeToInvoice1761210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add service_type enum type
    await queryRunner.query(`
      CREATE TYPE "public"."invoice_servicetype_enum" AS ENUM(
        'ELECTRICITY', 
        'WATER', 
        'PARKING', 
        'INTERNET', 
        'CLEANING', 
        'SECURITY', 
        'RENT', 
        'OTHER'
      )
    `);

    // Add serviceType column to invoice table
    await queryRunner.query(`
      ALTER TABLE "invoice" 
      ADD "serviceType" "public"."invoice_servicetype_enum"
    `);

    // Create unique index for service type constraint
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_invoice_contract_servicetype_billingperiod" 
      ON "invoice" ("contractId", "serviceType", "billingPeriod") 
      WHERE "serviceType" IS NOT NULL AND "billingPeriod" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop unique index
    await queryRunner.query(`
      DROP INDEX "public"."IDX_invoice_contract_servicetype_billingperiod"
    `);

    // Drop serviceType column
    await queryRunner.query(`
      ALTER TABLE "invoice" DROP COLUMN "serviceType"
    `);

    // Drop enum type
    await queryRunner.query(`
      DROP TYPE "public"."invoice_servicetype_enum"
    `);
  }
}