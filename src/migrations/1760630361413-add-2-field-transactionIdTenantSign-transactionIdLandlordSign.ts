import { MigrationInterface, QueryRunner } from "typeorm";

export class Add2FieldTransactionIdTenantSignTransactionIdLandlordSign1760630361413 implements MigrationInterface {
    name = 'Add2FieldTransactionIdTenantSignTransactionIdLandlordSign1760630361413'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contract" ADD "transactionIdTenantSign" character varying`);
        await queryRunner.query(`ALTER TABLE "contract" ADD "transactionIdLandlordSign" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contract" DROP COLUMN "transactionIdLandlordSign"`);
        await queryRunner.query(`ALTER TABLE "contract" DROP COLUMN "transactionIdTenantSign"`);
    }

}
