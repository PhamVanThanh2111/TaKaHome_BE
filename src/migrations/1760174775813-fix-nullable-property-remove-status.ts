import { MigrationInterface, QueryRunner } from "typeorm";

export class FixNullablePropertyRemoveStatus1760174775813 implements MigrationInterface {
    name = 'FixNullablePropertyRemoveStatus1760174775813'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "property" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."property_status_enum"`);
        await queryRunner.query(`ALTER TABLE "property" DROP COLUMN "floor"`);
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "province" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "ward" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "address" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "furnishing" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "price" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "price" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "furnishing" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "address" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "ward" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "province" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "property" ADD "floor" character varying`);
        await queryRunner.query(`CREATE TYPE "public"."property_status_enum" AS ENUM('ACTIVE', 'INACTIVE', 'PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "property" ADD "status" "public"."property_status_enum" NOT NULL DEFAULT 'ACTIVE'`);
    }

}
