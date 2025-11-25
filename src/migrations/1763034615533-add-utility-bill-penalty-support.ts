import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUtilityBillPenaltySupport1763034615533 implements MigrationInterface {
    name = 'AddUtilityBillPenaltySupport1763034615533'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "penalty_records" ADD "invoiceId" uuid`);
        await queryRunner.query(`ALTER TYPE "public"."invoice_status_enum" RENAME TO "invoice_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."invoice_status_enum" AS ENUM('PENDING', 'PAID', 'OVERDUE', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "invoice" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "invoice" ALTER COLUMN "status" TYPE "public"."invoice_status_enum" USING "status"::"text"::"public"."invoice_status_enum"`);
        await queryRunner.query(`ALTER TABLE "invoice" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."invoice_status_enum_old"`);
        await queryRunner.query(`CREATE INDEX "IDX_492753f745157b19b4c167e8ba" ON "penalty_records" ("invoiceId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_492753f745157b19b4c167e8ba"`);
        await queryRunner.query(`CREATE TYPE "public"."invoice_status_enum_old" AS ENUM('PENDING', 'PAID', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "invoice" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "invoice" ALTER COLUMN "status" TYPE "public"."invoice_status_enum_old" USING "status"::"text"::"public"."invoice_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "invoice" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."invoice_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."invoice_status_enum_old" RENAME TO "invoice_status_enum"`);
        await queryRunner.query(`ALTER TABLE "penalty_records" DROP COLUMN "invoiceId"`);
    }

}
