import { MigrationInterface, QueryRunner } from "typeorm";

export class BookingPayment1757088339688 implements MigrationInterface {
    name = 'BookingPayment1757088339688'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "booking" ADD "signedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "booking" ADD "escrowDepositDueAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "booking" ADD "escrowDepositFundedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "booking" ADD "firstRentDueAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "booking" ADD "firstRentPaidAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "booking" ADD "handoverAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "booking" ADD "activatedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "booking" ADD "closedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`CREATE TYPE "public"."payment_purpose_enum" AS ENUM('WALLET_TOPUP', 'ESCROW_DEPOSIT', 'FIRST_MONTH_RENT', 'MONTHLY_RENT')`);
        await queryRunner.query(`ALTER TABLE "payment" ADD "purpose" "public"."payment_purpose_enum" NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payment" DROP COLUMN "purpose"`);
        await queryRunner.query(`DROP TYPE "public"."payment_purpose_enum"`);
        await queryRunner.query(`ALTER TABLE "booking" DROP COLUMN "closedAt"`);
        await queryRunner.query(`ALTER TABLE "booking" DROP COLUMN "activatedAt"`);
        await queryRunner.query(`ALTER TABLE "booking" DROP COLUMN "handoverAt"`);
        await queryRunner.query(`ALTER TABLE "booking" DROP COLUMN "firstRentPaidAt"`);
        await queryRunner.query(`ALTER TABLE "booking" DROP COLUMN "firstRentDueAt"`);
        await queryRunner.query(`ALTER TABLE "booking" DROP COLUMN "escrowDepositFundedAt"`);
        await queryRunner.query(`ALTER TABLE "booking" DROP COLUMN "escrowDepositDueAt"`);
        await queryRunner.query(`ALTER TABLE "booking" DROP COLUMN "signedAt"`);
    }

}
