import { MigrationInterface, QueryRunner } from "typeorm";

export class DefaultIsApprovedIsVisible1765684531446 implements MigrationInterface {
    name = 'DefaultIsApprovedIsVisible1765684531446'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "isVisible" SET DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "isVisible" SET DEFAULT true`);
    }

}
