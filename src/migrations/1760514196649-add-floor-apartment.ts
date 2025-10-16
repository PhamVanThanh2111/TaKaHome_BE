import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFloorApartment1760514196649 implements MigrationInterface {
    name = 'AddFloorApartment1760514196649'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "property" ADD "floor" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "property" DROP COLUMN "floor"`);
    }

}
