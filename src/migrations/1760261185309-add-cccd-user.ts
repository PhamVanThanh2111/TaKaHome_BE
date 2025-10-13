import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCccdUser1760261185309 implements MigrationInterface {
    name = 'AddCccdUser1760261185309'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "CCCD" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "CCCD"`);
    }

}
