import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveBookingDateInBookingEntity1757171140643 implements MigrationInterface {
    name = 'RemoveBookingDateInBookingEntity1757171140643'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "booking" DROP COLUMN "bookingDate"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "booking" ADD "bookingDate" date NOT NULL`);
    }

}
