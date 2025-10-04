import { MigrationInterface, QueryRunner } from 'typeorm';

export class LandlordEscrow1757919261869 implements MigrationInterface {
  name = 'LandlordEscrow1757919261869';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "booking" ADD "landlordEscrowDepositDueAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" ADD "landlordEscrowDepositFundedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."booking_status_enum" RENAME TO "booking_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."booking_status_enum" AS ENUM('PENDING_LANDLORD', 'REJECTED', 'PENDING_SIGNATURE', 'SIGNED', 'AWAITING_DEPOSIT', 'DEPOSIT_FUNDED', 'DUAL_ESCROW_FUNDED', 'AWAITING_FIRST_RENT', 'READY_FOR_HANDOVER', 'ACTIVE', 'SETTLEMENT_PENDING', 'SETTLED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" ALTER COLUMN "status" TYPE "public"."booking_status_enum" USING "status"::"text"::"public"."booking_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" ALTER COLUMN "status" SET DEFAULT 'PENDING_LANDLORD'`,
    );
    await queryRunner.query(`DROP TYPE "public"."booking_status_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "public"."payment_purpose_enum" RENAME TO "payment_purpose_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payment_purpose_enum" AS ENUM('WALLET_TOPUP', 'ESCROW_DEPOSIT', 'OWNER_ESCROW_DEPOSIT', 'FIRST_MONTH_RENT', 'MONTHLY_RENT')`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment" ALTER COLUMN "purpose" TYPE "public"."payment_purpose_enum" USING "purpose"::"text"::"public"."payment_purpose_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."payment_purpose_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."payment_purpose_enum_old" AS ENUM('WALLET_TOPUP', 'ESCROW_DEPOSIT', 'FIRST_MONTH_RENT', 'MONTHLY_RENT')`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment" ALTER COLUMN "purpose" TYPE "public"."payment_purpose_enum_old" USING "purpose"::"text"::"public"."payment_purpose_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."payment_purpose_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."payment_purpose_enum_old" RENAME TO "payment_purpose_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."booking_status_enum_old" AS ENUM('PENDING_LANDLORD', 'REJECTED', 'PENDING_SIGNATURE', 'SIGNED', 'AWAITING_DEPOSIT', 'DEPOSIT_FUNDED', 'AWAITING_FIRST_RENT', 'READY_FOR_HANDOVER', 'ACTIVE', 'SETTLEMENT_PENDING', 'SETTLED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" ALTER COLUMN "status" TYPE "public"."booking_status_enum_old" USING "status"::"text"::"public"."booking_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" ALTER COLUMN "status" SET DEFAULT 'PENDING_LANDLORD'`,
    );
    await queryRunner.query(`DROP TYPE "public"."booking_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."booking_status_enum_old" RENAME TO "booking_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" DROP COLUMN "landlordEscrowDepositFundedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" DROP COLUMN "landlordEscrowDepositDueAt"`,
    );
  }
}
