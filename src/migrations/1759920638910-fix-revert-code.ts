import { MigrationInterface, QueryRunner } from "typeorm";

export class FixRevertCode1759920638910 implements MigrationInterface {
    name = 'FixRevertCode1759920638910'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "escrow_transactions" DROP COLUMN "refType"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "escrow_transactions" ADD "refType" character varying(24)`);
    }

}
