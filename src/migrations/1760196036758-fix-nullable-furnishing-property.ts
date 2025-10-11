import { MigrationInterface, QueryRunner } from "typeorm";

export class FixNullableFurnishingProperty1760196036758 implements MigrationInterface {
    name = 'FixNullableFurnishingProperty1760196036758'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "furnishing" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "furnishing" SET NOT NULL`);
    }

}
