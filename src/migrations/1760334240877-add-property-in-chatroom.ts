import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPropertyInChatroom1760334240877 implements MigrationInterface {
    name = 'AddPropertyInChatroom1760334240877'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_room" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "chat_room" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "chat_room" ADD "propertyId" uuid`);
        await queryRunner.query(`ALTER TABLE "chat_room" ADD CONSTRAINT "FK_73dee746d45556bc32fcdd01445" FOREIGN KEY ("propertyId") REFERENCES "property"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_room" DROP CONSTRAINT "FK_73dee746d45556bc32fcdd01445"`);
        await queryRunner.query(`ALTER TABLE "chat_room" DROP COLUMN "propertyId"`);
        await queryRunner.query(`ALTER TABLE "chat_room" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "chat_room" DROP COLUMN "createdAt"`);
    }

}
