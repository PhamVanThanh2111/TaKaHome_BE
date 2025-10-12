import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsApproveProperty1760252360192 implements MigrationInterface {
    name = 'AddIsApproveProperty1760252360192'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "property" ADD "isApproved" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "property" DROP COLUMN "isApproved"`);
    }

}
