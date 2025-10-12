import { MigrationInterface, QueryRunner } from 'typeorm';

export class Invoice1757645719044 implements MigrationInterface {
  name = 'Invoice1757645719044';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "invoice_item" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "description" character varying NOT NULL, "amount" integer NOT NULL, "invoiceId" uuid, CONSTRAINT "PK_621317346abdf61295516f3cb76" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."invoice_status_enum" AS ENUM('PENDING', 'PAID', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "invoice" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "invoiceCode" character varying NOT NULL, "totalAmount" integer NOT NULL, "dueDate" date NOT NULL, "status" "public"."invoice_status_enum" NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "contractId" uuid, CONSTRAINT "UQ_81b7ca2937901baf7ddfef39884" UNIQUE ("invoiceCode"), CONSTRAINT "PK_15d25c200d9bcd8a33f698daf18" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`ALTER TABLE "payment" ADD "invoiceId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "invoice_item" ADD CONSTRAINT "FK_553d5aac210d22fdca5c8d48ead" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice" ADD CONSTRAINT "FK_51fd47e65bdbb4bc565795feea1" FOREIGN KEY ("contractId") REFERENCES "contract"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment" ADD CONSTRAINT "FK_87223c7f1d4c2ca51cf69927844" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment" DROP CONSTRAINT "FK_87223c7f1d4c2ca51cf69927844"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice" DROP CONSTRAINT "FK_51fd47e65bdbb4bc565795feea1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_item" DROP CONSTRAINT "FK_553d5aac210d22fdca5c8d48ead"`,
    );
    await queryRunner.query(`ALTER TABLE "payment" DROP COLUMN "invoiceId"`);
    await queryRunner.query(`DROP TABLE "invoice"`);
    await queryRunner.query(`DROP TYPE "public"."invoice_status_enum"`);
    await queryRunner.query(`DROP TABLE "invoice_item"`);
  }
}
