import { MigrationInterface, QueryRunner } from "typeorm";

export class UniqueCccd1762672923117 implements MigrationInterface {
    name = 'UniqueCccd1762672923117'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "UQ_5bbe4b93fd6c0b59d6bb4cf9f67" UNIQUE ("CCCD")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "UQ_5bbe4b93fd6c0b59d6bb4cf9f67"`);
    }

}
