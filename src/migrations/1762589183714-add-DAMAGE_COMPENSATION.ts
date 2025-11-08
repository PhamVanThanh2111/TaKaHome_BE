import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDAMAGECOMPENSATION1762589183714 implements MigrationInterface {
    name = 'AddDAMAGECOMPENSATION1762589183714'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."invoice_item_servicetype_enum" RENAME TO "invoice_item_servicetype_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."invoice_item_servicetype_enum" AS ENUM('ELECTRICITY', 'WATER', 'PARKING', 'INTERNET', 'CLEANING', 'SECURITY', 'RENT', 'DAMAGE_COMPENSATION', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "invoice_item" ALTER COLUMN "serviceType" TYPE "public"."invoice_item_servicetype_enum" USING "serviceType"::"text"::"public"."invoice_item_servicetype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."invoice_item_servicetype_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."invoice_item_servicetype_enum_old" AS ENUM('ELECTRICITY', 'WATER', 'PARKING', 'INTERNET', 'CLEANING', 'SECURITY', 'RENT', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "invoice_item" ALTER COLUMN "serviceType" TYPE "public"."invoice_item_servicetype_enum_old" USING "serviceType"::"text"::"public"."invoice_item_servicetype_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."invoice_item_servicetype_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."invoice_item_servicetype_enum_old" RENAME TO "invoice_item_servicetype_enum"`);
    }

}
