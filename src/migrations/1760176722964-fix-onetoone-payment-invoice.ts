import { MigrationInterface, QueryRunner } from "typeorm";

export class FixOnetoonePaymentInvoice1760176722964 implements MigrationInterface {
    name = 'FixOnetoonePaymentInvoice1760176722964'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payment" DROP CONSTRAINT "FK_87223c7f1d4c2ca51cf69927844"`);
        await queryRunner.query(`ALTER TABLE "payment" DROP COLUMN "invoiceId"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payment" ADD "invoiceId" uuid`);
        await queryRunner.query(`ALTER TABLE "payment" ADD CONSTRAINT "FK_87223c7f1d4c2ca51cf69927844" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
