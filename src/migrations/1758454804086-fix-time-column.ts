import { MigrationInterface, QueryRunner } from 'typeorm';

type TimezoneAssumption = 'UTC' | 'Asia/Ho_Chi_Minh';

export class FixTimeColumns1759000000000 implements MigrationInterface {
  name = 'FixTimeColumns1759000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const renameIfExists = async (
      table: string,
      from: string,
      to: string,
    ): Promise<void> => {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = '${table}'
              AND column_name = '${from}'
          ) AND NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = '${table}'
              AND column_name = '${to}'
          ) THEN
            ALTER TABLE "${table}" RENAME COLUMN "${from}" TO "${to}";
          END IF;
        END
        $$;
      `);
    };

    const toTz = async (
      table: string,
      col: string,
      assume: TimezoneAssumption = 'UTC',
      setDefault = false,
    ): Promise<void> => {
      await queryRunner.query(`
        ALTER TABLE "${table}"
        ALTER COLUMN "${col}" TYPE timestamptz
        USING CASE
          WHEN "${col}" IS NULL THEN NULL
          WHEN pg_typeof("${col}") = 'timestamp without time zone'::regtype THEN "${col}" AT TIME ZONE '${assume}'
          WHEN pg_typeof("${col}") = 'date'::regtype THEN ("${col}"::timestamp) AT TIME ZONE '${assume}'
          ELSE "${col}"
        END;
      `);
      if (setDefault) {
        await queryRunner.query(`
          ALTER TABLE "${table}"
          ALTER COLUMN "${col}" SET DEFAULT CURRENT_TIMESTAMP;
        `);
      } else {
        await queryRunner.query(`
          ALTER TABLE "${table}"
          ALTER COLUMN "${col}" DROP DEFAULT;
        `);
      }
    };

    await renameIfExists('user', 'createAt', 'createdAt');
    await renameIfExists('user', 'updateAt', 'updatedAt');

    const defaultColumns: Array<{
      table: string;
      col: string;
      assume?: TimezoneAssumption;
    }> = [
      { table: 'user', col: 'createdAt' },
      { table: 'user', col: 'updatedAt' },
      { table: 'admin_action', col: 'createdAt' },
      { table: 'maintenance_ticket', col: 'createdAt' },
      { table: 'maintenance_ticket', col: 'updatedAt' },
      { table: 'favorite', col: 'createdAt' },
      { table: 'contract', col: 'createdAt' },
      { table: 'contract', col: 'updatedAt' },
      { table: 'review', col: 'createdAt' },
      { table: 'payment', col: 'createdAt' },
      { table: 'payment', col: 'updatedAt' },
      { table: 'wallets', col: 'createdAt' },
      { table: 'wallets', col: 'updatedAt' },
      { table: 'wallet_transactions', col: 'createdAt' },
      { table: 'chat_message', col: 'createdAt' },
      { table: 'verification', col: 'createdAt' },
      { table: 'property', col: 'createdAt' },
      { table: 'property', col: 'updatedAt' },
      { table: 'notification', col: 'createdAt' },
      { table: 'escrow_accounts', col: 'createdAt' },
      { table: 'escrow_accounts', col: 'updatedAt' },
      { table: 'escrow_transactions', col: 'createdAt' },
      { table: 'report', col: 'createdAt' },
      { table: 'booking', col: 'createdAt' },
      { table: 'booking', col: 'updatedAt' },
      { table: 'invoice', col: 'createdAt' },
      { table: 'invoice', col: 'updatedAt' },
    ];

    for (const { table, col, assume } of defaultColumns) {
      await toTz(table, col, assume ?? 'UTC', true);
    }

    const domainColumns: Array<{
      table: string;
      col: string;
      assume?: TimezoneAssumption;
    }> = [
      { table: 'payment', col: 'paidAt', assume: 'Asia/Ho_Chi_Minh' },
      { table: 'contract', col: 'startDate' },
      { table: 'contract', col: 'endDate' },
      { table: 'invoice', col: 'dueDate' },
      { table: 'wallet_transactions', col: 'completedAt' },
      { table: 'escrow_transactions', col: 'completedAt' },
      { table: 'account', col: 'lastLoginAt' },
      { table: 'booking', col: 'signedAt' },
      { table: 'booking', col: 'escrowDepositDueAt' },
      { table: 'booking', col: 'escrowDepositFundedAt' },
      { table: 'booking', col: 'firstRentDueAt' },
      { table: 'booking', col: 'landlordEscrowDepositDueAt' },
      { table: 'booking', col: 'landlordEscrowDepositFundedAt' },
      { table: 'booking', col: 'firstRentPaidAt' },
      { table: 'booking', col: 'handoverAt' },
      { table: 'booking', col: 'activatedAt' },
      { table: 'booking', col: 'closedAt' },
    ];

    for (const { table, col, assume } of domainColumns) {
      await toTz(table, col, assume ?? 'UTC');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const toNaive = async (
      table: string,
      col: string,
      setDefault = false,
    ): Promise<void> => {
      await queryRunner.query(`
        ALTER TABLE "${table}"
        ALTER COLUMN "${col}" TYPE timestamp
        USING CASE
          WHEN "${col}" IS NULL THEN NULL
          ELSE "${col}" AT TIME ZONE 'UTC'
        END;
      `);
      if (setDefault) {
        await queryRunner.query(`
          ALTER TABLE "${table}"
          ALTER COLUMN "${col}" SET DEFAULT now();
        `);
      } else {
        await queryRunner.query(`
          ALTER TABLE "${table}"
          ALTER COLUMN "${col}" DROP DEFAULT;
        `);
      }
    };

    const defaultColumns: Array<{ table: string; col: string }> = [
      { table: 'invoice', col: 'updatedAt' },
      { table: 'invoice', col: 'createdAt' },
      { table: 'booking', col: 'updatedAt' },
      { table: 'booking', col: 'createdAt' },
      { table: 'report', col: 'createdAt' },
      { table: 'escrow_transactions', col: 'createdAt' },
      { table: 'escrow_accounts', col: 'updatedAt' },
      { table: 'escrow_accounts', col: 'createdAt' },
      { table: 'notification', col: 'createdAt' },
      { table: 'property', col: 'updatedAt' },
      { table: 'property', col: 'createdAt' },
      { table: 'verification', col: 'createdAt' },
      { table: 'chat_message', col: 'createdAt' },
      { table: 'wallet_transactions', col: 'createdAt' },
      { table: 'wallets', col: 'updatedAt' },
      { table: 'wallets', col: 'createdAt' },
      { table: 'payment', col: 'updatedAt' },
      { table: 'payment', col: 'createdAt' },
      { table: 'review', col: 'createdAt' },
      { table: 'contract', col: 'updatedAt' },
      { table: 'contract', col: 'createdAt' },
      { table: 'favorite', col: 'createdAt' },
      { table: 'maintenance_ticket', col: 'updatedAt' },
      { table: 'maintenance_ticket', col: 'createdAt' },
      { table: 'admin_action', col: 'createdAt' },
      { table: 'user', col: 'updatedAt' },
      { table: 'user', col: 'createdAt' },
    ];

    for (const { table, col } of defaultColumns) {
      await toNaive(table, col, true);
    }

    const domainColumns: Array<{ table: string; col: string }> = [
      { table: 'booking', col: 'closedAt' },
      { table: 'booking', col: 'activatedAt' },
      { table: 'booking', col: 'handoverAt' },
      { table: 'booking', col: 'firstRentPaidAt' },
      { table: 'booking', col: 'landlordEscrowDepositFundedAt' },
      { table: 'booking', col: 'landlordEscrowDepositDueAt' },
      { table: 'booking', col: 'firstRentDueAt' },
      { table: 'booking', col: 'escrowDepositFundedAt' },
      { table: 'booking', col: 'escrowDepositDueAt' },
      { table: 'booking', col: 'signedAt' },
      { table: 'account', col: 'lastLoginAt' },
      { table: 'escrow_transactions', col: 'completedAt' },
      { table: 'wallet_transactions', col: 'completedAt' },
      { table: 'invoice', col: 'dueDate' },
      { table: 'contract', col: 'endDate' },
      { table: 'contract', col: 'startDate' },
      { table: 'payment', col: 'paidAt' },
    ];

    for (const { table, col } of domainColumns) {
      await toNaive(table, col);
    }

    const renameIfExists = async (
      table: string,
      from: string,
      to: string,
    ): Promise<void> => {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = '${table}'
              AND column_name = '${from}'
          ) AND NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = '${table}'
              AND column_name = '${to}'
          ) THEN
            ALTER TABLE "${table}" RENAME COLUMN "${from}" TO "${to}";
          END IF;
        END
        $$;
      `);
    };

    await renameIfExists('user', 'updatedAt', 'updateAt');
    await renameIfExists('user', 'createdAt', 'createAt');
  }
}