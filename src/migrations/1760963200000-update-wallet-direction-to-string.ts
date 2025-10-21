import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateWalletDirectionToString1760963200000 implements MigrationInterface {
    name = 'UpdateWalletDirectionToString1760961200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Cập nhật dữ liệu hiện có từ số sang chuỗi
        // 0 -> 'CREDIT', 1 -> 'DEBIT'
        await queryRunner.query(`
            UPDATE wallet_transactions 
            SET direction = CASE 
                WHEN direction = '0' THEN 'CREDIT'
                WHEN direction = '1' THEN 'DEBIT'
                ELSE direction
            END
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Rollback: chuyển từ chuỗi về số
        // 'CREDIT' -> 0, 'DEBIT' -> 1
        await queryRunner.query(`
            UPDATE wallet_transactions 
            SET direction = CASE 
                WHEN direction = 'CREDIT' THEN '0'
                WHEN direction = 'DEBIT' THEN '1'
                ELSE direction
            END
        `);
    }
}