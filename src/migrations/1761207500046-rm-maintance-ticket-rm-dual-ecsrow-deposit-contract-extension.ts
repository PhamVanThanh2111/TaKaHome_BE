import { MigrationInterface, QueryRunner } from "typeorm";

export class RmMaintanceTicketRmDualEcsrowDepositContractExtension1761207500046 implements MigrationInterface {
    name = 'RmMaintanceTicketRmDualEcsrowDepositContractExtension1761207500046'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."contract_extensions_status_enum" RENAME TO "contract_extensions_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."contract_extensions_status_enum" AS ENUM('PENDING', 'LANDLORD_RESPONDED', 'AWAITING_SIGNATURES', 'LANDLORD_SIGNED', 'AWAITING_ESCROW', 'ESCROW_FUNDED_T', 'ESCROW_FUNDED_L', 'ACTIVE', 'REJECTED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ALTER COLUMN "status" TYPE "public"."contract_extensions_status_enum" USING "status"::"text"::"public"."contract_extensions_status_enum"`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."contract_extensions_status_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."contract_extensions_status_enum_old" AS ENUM('PENDING', 'LANDLORD_RESPONDED', 'AWAITING_SIGNATURES', 'LANDLORD_SIGNED', 'AWAITING_ESCROW', 'ESCROW_FUNDED_T', 'ESCROW_FUNDED_L', 'DUAL_ESCROW_FUNDED', 'ACTIVE', 'REJECTED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ALTER COLUMN "status" TYPE "public"."contract_extensions_status_enum_old" USING "status"::"text"::"public"."contract_extensions_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."contract_extensions_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."contract_extensions_status_enum_old" RENAME TO "contract_extensions_status_enum"`);
    }

}
