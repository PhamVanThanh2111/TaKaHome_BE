import { MigrationInterface, QueryRunner } from 'typeorm';

export class Autoabc1755443291255 implements MigrationInterface {
  name = 'Autoabc1755443291255';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment" ADD "bankCode" character varying`,
    );
    await queryRunner.query(`ALTER TABLE "payment" ADD "paidAt" TIMESTAMP`);
    await queryRunner.query(
      `ALTER TABLE "contract" ADD CONSTRAINT "UQ_d816c97377d424d91103e8a4bf6" UNIQUE ("contractCode")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contract" DROP CONSTRAINT "UQ_d816c97377d424d91103e8a4bf6"`,
    );
    await queryRunner.query(`ALTER TABLE "payment" DROP COLUMN "paidAt"`);
    await queryRunner.query(`ALTER TABLE "payment" DROP COLUMN "bankCode"`);
  }
}
