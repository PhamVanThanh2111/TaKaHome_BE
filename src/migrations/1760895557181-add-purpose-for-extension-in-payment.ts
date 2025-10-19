import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPurposeForExtensionInPayment1760895557181 implements MigrationInterface {
    name = 'AddPurposeForExtensionInPayment1760895557181'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."contract_extensions_status_enum" RENAME TO "contract_extensions_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."contract_extensions_status_enum" AS ENUM('PENDING', 'LANDLORD_RESPONDED', 'AWAITING_SIGNATURES', 'LANDLORD_SIGNED', 'AWAITING_ESCROW', 'ESCROW_FUNDED_T', 'ESCROW_FUNDED_L', 'DUAL_ESCROW_FUNDED', 'ACTIVE', 'REJECTED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ALTER COLUMN "status" TYPE "public"."contract_extensions_status_enum" USING "status"::"text"::"public"."contract_extensions_status_enum"`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."contract_extensions_status_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."payment_purpose_enum" RENAME TO "payment_purpose_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."payment_purpose_enum" AS ENUM('WALLET_TOPUP', 'TENANT_ESCROW_DEPOSIT', 'LANDLORD_ESCROW_DEPOSIT', 'FIRST_MONTH_RENT', 'MONTHLY_RENT', 'TENANT_EXTENSION_ESCROW_DEPOSIT', 'LANDLORD_EXTENSION_ESCROW_DEPOSIT')`);
        await queryRunner.query(`ALTER TABLE "payment" ALTER COLUMN "purpose" TYPE "public"."payment_purpose_enum" USING "purpose"::"text"::"public"."payment_purpose_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payment_purpose_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."payment_purpose_enum_old" AS ENUM('WALLET_TOPUP', 'TENANT_ESCROW_DEPOSIT', 'LANDLORD_ESCROW_DEPOSIT', 'FIRST_MONTH_RENT', 'MONTHLY_RENT')`);
        await queryRunner.query(`ALTER TABLE "payment" ALTER COLUMN "purpose" TYPE "public"."payment_purpose_enum_old" USING "purpose"::"text"::"public"."payment_purpose_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."payment_purpose_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."payment_purpose_enum_old" RENAME TO "payment_purpose_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."contract_extensions_status_enum_old" AS ENUM('PENDING', 'LANDLORD_RESPONDED', 'AWAITING_SIGNATURES', 'LANDLORD_SIGNED', 'FULLY_SIGNED', 'AWAITING_ESCROW', 'ACTIVE', 'REJECTED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ALTER COLUMN "status" TYPE "public"."contract_extensions_status_enum_old" USING "status"::"text"::"public"."contract_extensions_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."contract_extensions_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."contract_extensions_status_enum_old" RENAME TO "contract_extensions_status_enum"`);
    }

}
