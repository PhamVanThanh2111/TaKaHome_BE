import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveDecimalPriceRoomType1760608929433 implements MigrationInterface {
    name = 'RemoveDecimalPriceRoomType1760608929433'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "room_type" DROP COLUMN "area"`);
        await queryRunner.query(`ALTER TABLE "room_type" ADD "area" integer`);
        await queryRunner.query(`ALTER TABLE "room_type" DROP COLUMN "price"`);
        await queryRunner.query(`ALTER TABLE "room_type" ADD "price" integer`);
        await queryRunner.query(`ALTER TABLE "room_type" DROP COLUMN "deposit"`);
        await queryRunner.query(`ALTER TABLE "room_type" ADD "deposit" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "room_type" DROP COLUMN "deposit"`);
        await queryRunner.query(`ALTER TABLE "room_type" ADD "deposit" numeric(15,2) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "room_type" DROP COLUMN "price"`);
        await queryRunner.query(`ALTER TABLE "room_type" ADD "price" numeric(15,2) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "room_type" DROP COLUMN "area"`);
        await queryRunner.query(`ALTER TABLE "room_type" ADD "area" numeric(10,2) NOT NULL`);
    }

}
