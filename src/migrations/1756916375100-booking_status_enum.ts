import { MigrationInterface, QueryRunner } from 'typeorm';

export class BookingStatusEnum1756916375100 implements MigrationInterface {
  name = 'BookingStatusEnum1756916375100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."booking_status_enum" RENAME TO "booking_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."booking_status_enum" AS ENUM('PENDING_LANDLORD', 'REJECTED', 'PENDING_SIGNATURE', 'SIGNED', 'AWAITING_DEPOSIT', 'DEPOSIT_FUNDED', 'AWAITING_FIRST_RENT', 'READY_FOR_HANDOVER', 'ACTIVE', 'SETTLEMENT_PENDING', 'SETTLED', 'CANCELLED')`,
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
      `ALTER TYPE "public"."payment_method_enum" RENAME TO "payment_method_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payment_method_enum" AS ENUM('WALLET', 'VNPAY')`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment" ALTER COLUMN "method" TYPE "public"."payment_method_enum" USING "method"::"text"::"public"."payment_method_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."payment_method_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."payment_method_enum_old" AS ENUM('CASH', 'VNPAY')`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment" ALTER COLUMN "method" TYPE "public"."payment_method_enum_old" USING "method"::"text"::"public"."payment_method_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."payment_method_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."payment_method_enum_old" RENAME TO "payment_method_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."booking_status_enum_old" AS ENUM('ACTIVE', 'INACTIVE', 'PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" ALTER COLUMN "status" TYPE "public"."booking_status_enum_old" USING "status"::"text"::"public"."booking_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
    );
    await queryRunner.query(`DROP TYPE "public"."booking_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."booking_status_enum_old" RENAME TO "booking_status_enum"`,
    );
  }
}
