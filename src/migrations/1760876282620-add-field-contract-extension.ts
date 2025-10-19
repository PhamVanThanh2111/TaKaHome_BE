import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFieldContractExtension1760876282620 implements MigrationInterface {
    name = 'AddFieldContractExtension1760876282620'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contract_extensions" ADD "extensionContractFileUrl" character varying`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ADD "landlordSignedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ADD "tenantSignedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ADD "transactionIdLandlordSign" character varying`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ADD "transactionIdTenantSign" character varying`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ADD "escrowDepositDueAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ADD "tenantEscrowDepositFundedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ADD "landlordEscrowDepositFundedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ADD "activatedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TYPE "public"."contract_extensions_status_enum" RENAME TO "contract_extensions_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."contract_extensions_status_enum" AS ENUM('PENDING', 'LANDLORD_RESPONDED', 'AWAITING_SIGNATURES', 'LANDLORD_SIGNED', 'FULLY_SIGNED', 'AWAITING_ESCROW', 'ACTIVE', 'REJECTED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ALTER COLUMN "status" TYPE "public"."contract_extensions_status_enum" USING "status"::"text"::"public"."contract_extensions_status_enum"`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."contract_extensions_status_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."contract_extensions_status_enum_old" AS ENUM('PENDING', 'LANDLORD_RESPONDED', 'APPROVED', 'REJECTED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ALTER COLUMN "status" TYPE "public"."contract_extensions_status_enum_old" USING "status"::"text"::"public"."contract_extensions_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."contract_extensions_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."contract_extensions_status_enum_old" RENAME TO "contract_extensions_status_enum"`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" DROP COLUMN "activatedAt"`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" DROP COLUMN "landlordEscrowDepositFundedAt"`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" DROP COLUMN "tenantEscrowDepositFundedAt"`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" DROP COLUMN "escrowDepositDueAt"`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" DROP COLUMN "transactionIdTenantSign"`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" DROP COLUMN "transactionIdLandlordSign"`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" DROP COLUMN "tenantSignedAt"`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" DROP COLUMN "landlordSignedAt"`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" DROP COLUMN "extensionContractFileUrl"`);
    }

}
