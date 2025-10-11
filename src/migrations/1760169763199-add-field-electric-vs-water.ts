import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFieldElectricVsWater1760169763199 implements MigrationInterface {
    name = 'AddFieldElectricVsWater1760169763199'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "property" ADD "electricityPricePerKwh" numeric(15,2)`);
        await queryRunner.query(`ALTER TABLE "property" ADD "waterPricePerM3" numeric(15,2)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "property" DROP COLUMN "waterPricePerM3"`);
        await queryRunner.query(`ALTER TABLE "property" DROP COLUMN "electricityPricePerKwh"`);
    }

}
