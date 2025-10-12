import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEscrowEntity1757261635925 implements MigrationInterface {
  name = 'AddEscrowEntity1757261635925';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "escrow_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "contractId" uuid NOT NULL, "tenantId" uuid NOT NULL, "propertyId" uuid NOT NULL, "currentBalance" bigint NOT NULL DEFAULT '0', "currency" character varying(8) NOT NULL DEFAULT 'VND', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_9ec6843e711f08b14cd1b537480" UNIQUE ("contractId"), CONSTRAINT "PK_4d065b88217295bb812ff7b2af2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b546976662060171c3523ef883" ON "escrow_accounts" ("tenantId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ca36fca710206f888931842f82" ON "escrow_accounts" ("propertyId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "escrow_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "escrowId" uuid NOT NULL, "direction" character varying(10) NOT NULL, "type" character varying(16) NOT NULL, "amount" bigint NOT NULL, "status" character varying(12) NOT NULL DEFAULT 'COMPLETED', "refType" character varying(24), "refId" uuid, "note" character varying(255), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "completedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_529d3ac2fa1b343b7beb59bd945" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8d6f7bcb38124b2da80c1b4dca" ON "escrow_transactions" ("escrowId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "escrow_accounts" ADD CONSTRAINT "FK_9ec6843e711f08b14cd1b537480" FOREIGN KEY ("contractId") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrow_accounts" ADD CONSTRAINT "FK_b546976662060171c3523ef8834" FOREIGN KEY ("tenantId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrow_accounts" ADD CONSTRAINT "FK_ca36fca710206f888931842f825" FOREIGN KEY ("propertyId") REFERENCES "property"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrow_transactions" ADD CONSTRAINT "FK_8d6f7bcb38124b2da80c1b4dca8" FOREIGN KEY ("escrowId") REFERENCES "escrow_accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "escrow_transactions" DROP CONSTRAINT "FK_8d6f7bcb38124b2da80c1b4dca8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrow_accounts" DROP CONSTRAINT "FK_ca36fca710206f888931842f825"`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrow_accounts" DROP CONSTRAINT "FK_b546976662060171c3523ef8834"`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrow_accounts" DROP CONSTRAINT "FK_9ec6843e711f08b14cd1b537480"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8d6f7bcb38124b2da80c1b4dca"`,
    );
    await queryRunner.query(`DROP TABLE "escrow_transactions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ca36fca710206f888931842f82"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b546976662060171c3523ef883"`,
    );
    await queryRunner.query(`DROP TABLE "escrow_accounts"`);
  }
}
