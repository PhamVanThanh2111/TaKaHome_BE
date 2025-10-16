import { MigrationInterface, QueryRunner } from "typeorm";

export class JoinColumnPaymentInvoice1760658999996 implements MigrationInterface {
    name = 'JoinColumnPaymentInvoice1760658999996'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "invoice" ADD "paymentId" uuid`);
        await queryRunner.query(`ALTER TABLE "invoice" ADD CONSTRAINT "UQ_03ccf846238db85401525e07cd2" UNIQUE ("paymentId")`);
        await queryRunner.query(`ALTER TABLE "invoice" ADD CONSTRAINT "FK_03ccf846238db85401525e07cd2" FOREIGN KEY ("paymentId") REFERENCES "payment"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "invoice" DROP CONSTRAINT "FK_03ccf846238db85401525e07cd2"`);
        await queryRunner.query(`ALTER TABLE "invoice" DROP CONSTRAINT "UQ_03ccf846238db85401525e07cd2"`);
        await queryRunner.query(`ALTER TABLE "invoice" DROP COLUMN "paymentId"`);
    }

}
