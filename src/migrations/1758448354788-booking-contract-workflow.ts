import { MigrationInterface, QueryRunner } from "typeorm";

export class BookingContractWorkflow1758448354788 implements MigrationInterface {
    name = 'BookingContractWorkflow1758448354788'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "booking" ADD "contractId" uuid`);
        await queryRunner.query(`ALTER TABLE "booking" ADD CONSTRAINT "UQ_f2c70440a09d8b09b7da74469f9" UNIQUE ("contractId")`);
        await queryRunner.query(`ALTER TYPE "public"."contract_status_enum" RENAME TO "contract_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."contract_status_enum" AS ENUM('DRAFT', 'PENDING_SIGNATURE', 'SIGNED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'TERMINATED')`);
        await queryRunner.query(`ALTER TABLE "contract" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "contract" ALTER COLUMN "status" TYPE "public"."contract_status_enum" USING "status"::"text"::"public"."contract_status_enum"`);
        await queryRunner.query(`ALTER TABLE "contract" ALTER COLUMN "status" SET DEFAULT 'PENDING_SIGNATURE'`);
        await queryRunner.query(`DROP TYPE "public"."contract_status_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."booking_status_enum" RENAME TO "booking_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."booking_status_enum" AS ENUM('PENDING_LANDLORD', 'REJECTED', 'PENDING_SIGNATURE', 'SIGNED', 'AWAITING_DEPOSIT', 'ESCROW_FUNDED_T', 'ESCROW_FUNDED_L', 'DUAL_ESCROW_FUNDED', 'AWAITING_FIRST_RENT', 'READY_FOR_HANDOVER', 'ACTIVE', 'SETTLEMENT_PENDING', 'SETTLED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "booking" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "booking" ALTER COLUMN "status" TYPE "public"."booking_status_enum" USING "status"::"text"::"public"."booking_status_enum"`);
        await queryRunner.query(`ALTER TABLE "booking" ALTER COLUMN "status" SET DEFAULT 'PENDING_LANDLORD'`);
        await queryRunner.query(`DROP TYPE "public"."booking_status_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."payment_purpose_enum" RENAME TO "payment_purpose_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."payment_purpose_enum" AS ENUM('WALLET_TOPUP', 'TENANT_ESCROW_DEPOSIT', 'LANDLORD_ESCROW_DEPOSIT', 'FIRST_MONTH_RENT', 'MONTHLY_RENT')`);
        await queryRunner.query(`ALTER TABLE "payment" ALTER COLUMN "purpose" TYPE "public"."payment_purpose_enum" USING "purpose"::"text"::"public"."payment_purpose_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payment_purpose_enum_old"`);
        await queryRunner.query(`ALTER TABLE "booking" ADD CONSTRAINT "FK_f2c70440a09d8b09b7da74469f9" FOREIGN KEY ("contractId") REFERENCES "contract"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "booking" DROP CONSTRAINT "FK_f2c70440a09d8b09b7da74469f9"`);
        await queryRunner.query(`CREATE TYPE "public"."payment_purpose_enum_old" AS ENUM('WALLET_TOPUP', 'ESCROW_DEPOSIT', 'OWNER_ESCROW_DEPOSIT', 'FIRST_MONTH_RENT', 'MONTHLY_RENT')`);
        await queryRunner.query(`ALTER TABLE "payment" ALTER COLUMN "purpose" TYPE "public"."payment_purpose_enum_old" USING "purpose"::"text"::"public"."payment_purpose_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."payment_purpose_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."payment_purpose_enum_old" RENAME TO "payment_purpose_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."booking_status_enum_old" AS ENUM('PENDING_LANDLORD', 'REJECTED', 'PENDING_SIGNATURE', 'SIGNED', 'AWAITING_DEPOSIT', 'DEPOSIT_FUNDED', 'DUAL_ESCROW_FUNDED', 'AWAITING_FIRST_RENT', 'READY_FOR_HANDOVER', 'ACTIVE', 'SETTLEMENT_PENDING', 'SETTLED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "booking" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "booking" ALTER COLUMN "status" TYPE "public"."booking_status_enum_old" USING "status"::"text"::"public"."booking_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "booking" ALTER COLUMN "status" SET DEFAULT 'PENDING_LANDLORD'`);
        await queryRunner.query(`DROP TYPE "public"."booking_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."booking_status_enum_old" RENAME TO "booking_status_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."contract_status_enum_old" AS ENUM('DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'TERMINATED')`);
        await queryRunner.query(`ALTER TABLE "contract" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "contract" ALTER COLUMN "status" TYPE "public"."contract_status_enum_old" USING "status"::"text"::"public"."contract_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "contract" ALTER COLUMN "status" SET DEFAULT 'PENDING_SIGNATURE'`);
        await queryRunner.query(`DROP TYPE "public"."contract_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."contract_status_enum_old" RENAME TO "contract_status_enum"`);
        await queryRunner.query(`ALTER TABLE "booking" DROP CONSTRAINT "UQ_f2c70440a09d8b09b7da74469f9"`);
        await queryRunner.query(`ALTER TABLE "booking" DROP COLUMN "contractId"`);
    }

}
