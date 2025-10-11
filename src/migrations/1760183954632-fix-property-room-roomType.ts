import { MigrationInterface, QueryRunner } from "typeorm";

export class FixPropertyRoomRoomType1760183954632 implements MigrationInterface {
    name = 'FixPropertyRoomRoomType1760183954632'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "room_type" DROP CONSTRAINT "FK_d39f8507f26c31a196f64df8d67"`);
        await queryRunner.query(`CREATE TABLE "room" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "isVisible" boolean NOT NULL DEFAULT true, "floor" integer, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "propertyId" uuid, "roomTypeId" uuid, CONSTRAINT "PK_c6d46db005d623e691b2fbcba23" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "room_type" DROP COLUMN "count"`);
        await queryRunner.query(`ALTER TABLE "room_type" DROP COLUMN "isActive"`);
        await queryRunner.query(`ALTER TABLE "room_type" DROP COLUMN "propertyId"`);
        await queryRunner.query(`ALTER TABLE "room_type" DROP COLUMN "locations"`);
        await queryRunner.query(`ALTER TABLE "room_type" ADD "furnishing" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "room_type" ADD "heroImage" character varying`);
        await queryRunner.query(`ALTER TABLE "report" ADD "roomId" uuid`);
        await queryRunner.query(`ALTER TABLE "contract" ADD "roomId" uuid`);
        await queryRunner.query(`ALTER TABLE "booking" ADD "roomId" uuid`);
        await queryRunner.query(`ALTER TABLE "report" ADD CONSTRAINT "FK_dc9ee2bb3a36bd8117f3e1c4513" FOREIGN KEY ("roomId") REFERENCES "room"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "room" ADD CONSTRAINT "FK_6a9adbe3db58dad30c0c63ca31d" FOREIGN KEY ("propertyId") REFERENCES "property"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "room" ADD CONSTRAINT "FK_9e55182c47f8ba7a32466131837" FOREIGN KEY ("roomTypeId") REFERENCES "room_type"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "contract" ADD CONSTRAINT "FK_cf9839a50efcca56cff91d68852" FOREIGN KEY ("roomId") REFERENCES "room"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "booking" ADD CONSTRAINT "FK_769a5e375729258fd0bbfc0a456" FOREIGN KEY ("roomId") REFERENCES "room"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "booking" DROP CONSTRAINT "FK_769a5e375729258fd0bbfc0a456"`);
        await queryRunner.query(`ALTER TABLE "contract" DROP CONSTRAINT "FK_cf9839a50efcca56cff91d68852"`);
        await queryRunner.query(`ALTER TABLE "room" DROP CONSTRAINT "FK_9e55182c47f8ba7a32466131837"`);
        await queryRunner.query(`ALTER TABLE "room" DROP CONSTRAINT "FK_6a9adbe3db58dad30c0c63ca31d"`);
        await queryRunner.query(`ALTER TABLE "report" DROP CONSTRAINT "FK_dc9ee2bb3a36bd8117f3e1c4513"`);
        await queryRunner.query(`ALTER TABLE "booking" DROP COLUMN "roomId"`);
        await queryRunner.query(`ALTER TABLE "contract" DROP COLUMN "roomId"`);
        await queryRunner.query(`ALTER TABLE "report" DROP COLUMN "roomId"`);
        await queryRunner.query(`ALTER TABLE "room_type" DROP COLUMN "heroImage"`);
        await queryRunner.query(`ALTER TABLE "room_type" DROP COLUMN "furnishing"`);
        await queryRunner.query(`ALTER TABLE "room_type" ADD "locations" text array NOT NULL`);
        await queryRunner.query(`ALTER TABLE "room_type" ADD "propertyId" uuid`);
        await queryRunner.query(`ALTER TABLE "room_type" ADD "isActive" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "room_type" ADD "count" integer NOT NULL DEFAULT '1'`);
        await queryRunner.query(`DROP TABLE "room"`);
        await queryRunner.query(`ALTER TABLE "room_type" ADD CONSTRAINT "FK_d39f8507f26c31a196f64df8d67" FOREIGN KEY ("propertyId") REFERENCES "property"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
