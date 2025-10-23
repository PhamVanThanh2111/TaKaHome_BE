import { MigrationInterface, QueryRunner } from "typeorm";

export class RmPriceElectricWater1761208054488 implements MigrationInterface {
    name = 'RmPriceElectricWater1761208054488'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contract_extensions" DROP COLUMN "newElectricityPrice"`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" DROP COLUMN "newWaterPrice"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contract_extensions" ADD "newWaterPrice" integer`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ADD "newElectricityPrice" integer`);
    }

}
