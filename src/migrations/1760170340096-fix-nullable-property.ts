import { MigrationInterface, QueryRunner } from "typeorm";

export class FixNullableProperty1760170340096 implements MigrationInterface {
    name = 'FixNullableProperty1760170340096'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "province" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "ward" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "address" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "furnishing" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "deposit" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "deposit" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "furnishing" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "address" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "ward" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "province" DROP NOT NULL`);
    }

}
