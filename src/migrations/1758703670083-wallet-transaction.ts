import { MigrationInterface, QueryRunner } from "typeorm";

export class WalletTransaction1758703670083 implements MigrationInterface {
    name = 'WalletTransaction1758703670083'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "wallet_transactions" DROP COLUMN "refType"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "wallet_transactions" ADD "refType" character varying(24)`);
    }

}
