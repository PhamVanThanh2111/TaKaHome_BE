import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHandoverOverduePenaltyType1760900906712 implements MigrationInterface {
    name = 'AddHandoverOverduePenaltyType1760900906712'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "property_utility" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying, "propertyId" uuid, CONSTRAINT "PK_a8ef74b902c9bbaf33e3bcaf26c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TYPE "public"."notification_type_enum" RENAME TO "notification_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."notification_type_enum" AS ENUM('GENERAL', 'PAYMENT', 'CONTRACT', 'PENALTY', 'SYSTEM')`);
        await queryRunner.query(`ALTER TABLE "notification" ALTER COLUMN "type" TYPE "public"."notification_type_enum" USING "type"::"text"::"public"."notification_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notification_type_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."payment_purpose_enum" RENAME TO "payment_purpose_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."payment_purpose_enum" AS ENUM('WALLET_TOPUP', 'TENANT_ESCROW_DEPOSIT', 'LANDLORD_ESCROW_DEPOSIT', 'FIRST_MONTH_RENT', 'MONTHLY_RENT')`);
        await queryRunner.query(`ALTER TABLE "payment" ALTER COLUMN "purpose" TYPE "public"."payment_purpose_enum" USING "purpose"::"text"::"public"."payment_purpose_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payment_purpose_enum_old"`);
        await queryRunner.query(`ALTER TABLE "property_utility" ADD CONSTRAINT "FK_7258107ce13db63e211056726ef" FOREIGN KEY ("propertyId") REFERENCES "property"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "property_utility" DROP CONSTRAINT "FK_7258107ce13db63e211056726ef"`);
        await queryRunner.query(`CREATE TYPE "public"."payment_purpose_enum_old" AS ENUM('WALLET_TOPUP', 'TENANT_ESCROW_DEPOSIT', 'LANDLORD_ESCROW_DEPOSIT', 'FIRST_MONTH_RENT', 'MONTHLY_RENT', 'TENANT_EXTENSION_ESCROW_DEPOSIT', 'LANDLORD_EXTENSION_ESCROW_DEPOSIT')`);
        await queryRunner.query(`ALTER TABLE "payment" ALTER COLUMN "purpose" TYPE "public"."payment_purpose_enum_old" USING "purpose"::"text"::"public"."payment_purpose_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."payment_purpose_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."payment_purpose_enum_old" RENAME TO "payment_purpose_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."notification_type_enum_old" AS ENUM('GENERAL', 'PAYMENT', 'CONTRACT', 'SYSTEM')`);
        await queryRunner.query(`ALTER TABLE "notification" ALTER COLUMN "type" TYPE "public"."notification_type_enum_old" USING "type"::"text"::"public"."notification_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."notification_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."notification_type_enum_old" RENAME TO "notification_type_enum"`);
        await queryRunner.query(`DROP TABLE "property_utility"`);
    }

}
