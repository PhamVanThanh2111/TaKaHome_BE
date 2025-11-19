import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRoontypeInFavorite1763567975628 implements MigrationInterface {
    name = 'AddRoontypeInFavorite1763567975628'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "favorite" ADD "roomTypeId" uuid`);
        await queryRunner.query(`ALTER TABLE "favorite" ADD CONSTRAINT "FK_8ce544dd218ee3eff1849690f8a" FOREIGN KEY ("roomTypeId") REFERENCES "room_type"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "favorite" DROP CONSTRAINT "FK_8ce544dd218ee3eff1849690f8a"`);
        await queryRunner.query(`ALTER TABLE "favorite" DROP COLUMN "roomTypeId"`);
    }

}
