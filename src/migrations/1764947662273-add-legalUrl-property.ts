import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLegalUrlProperty1764947662273 implements MigrationInterface {
    name = 'AddLegalUrlProperty1764947662273'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "review" ADD "roomTypeId" uuid`);
        await queryRunner.query(`ALTER TABLE "property" ADD "legalUrl" character varying`);
        await queryRunner.query(`ALTER TABLE "review" ADD CONSTRAINT "FK_585b45df34cb339782c8619dd8b" FOREIGN KEY ("roomTypeId") REFERENCES "room_type"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "review" DROP CONSTRAINT "FK_585b45df34cb339782c8619dd8b"`);
        await queryRunner.query(`ALTER TABLE "property" DROP COLUMN "legalUrl"`);
        await queryRunner.query(`ALTER TABLE "review" DROP COLUMN "roomTypeId"`);
    }

}
