import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveBookingIdInPenaty1760156914171 implements MigrationInterface {
    name = 'RemoveBookingIdInPenaty1760156914171'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "penalty_records" DROP CONSTRAINT "FK_fd852fdfd0b11c51cb36d8672aa"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fd852fdfd0b11c51cb36d8672a"`);
        await queryRunner.query(`ALTER TABLE "penalty_records" DROP COLUMN "bookingId"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "penalty_records" ADD "bookingId" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_fd852fdfd0b11c51cb36d8672a" ON "penalty_records" ("bookingId") `);
        await queryRunner.query(`ALTER TABLE "penalty_records" ADD CONSTRAINT "FK_fd852fdfd0b11c51cb36d8672aa" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
