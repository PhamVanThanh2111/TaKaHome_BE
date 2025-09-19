import { MigrationInterface, QueryRunner } from "typeorm";

export class Maintenance1757925771642 implements MigrationInterface {
    name = 'Maintenance1757925771642'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."maintenance_ticket_status_enum" AS ENUM('OPEN', 'RESOLVED', 'DISPUTED', 'CLOSED')`);
        await queryRunner.query(`CREATE TABLE "maintenance_ticket" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "description" text NOT NULL, "status" "public"."maintenance_ticket_status_enum" NOT NULL DEFAULT 'OPEN', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "bookingId" uuid, CONSTRAINT "PK_fab802c54642b3888fa360b4273" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "maintenance_ticket" ADD CONSTRAINT "FK_710cd2497ed0c4593d5dd0c134a" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "maintenance_ticket" DROP CONSTRAINT "FK_710cd2497ed0c4593d5dd0c134a"`);
        await queryRunner.query(`DROP TABLE "maintenance_ticket"`);
        await queryRunner.query(`DROP TYPE "public"."maintenance_ticket_status_enum"`);
    }

}
