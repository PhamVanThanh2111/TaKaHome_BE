import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBillingPeriod1760150285284 implements MigrationInterface {
    name = 'AddBillingPeriod1760150285284'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "penalty_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "contractId" uuid NOT NULL, "bookingId" uuid, "tenantId" character varying(100) NOT NULL, "penaltyType" character varying(50) NOT NULL, "period" character varying(20), "overdueDate" date NOT NULL, "daysPastDue" integer NOT NULL, "originalAmount" numeric(15,2) NOT NULL, "penaltyAmount" numeric(15,2) NOT NULL, "penaltyRate" numeric(5,3) NOT NULL, "reason" character varying(500) NOT NULL, "status" character varying(50) NOT NULL, "blockchainTxHash" character varying(200), "appliedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "appliedBy" character varying(100) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d1139f526110896720949e8bcbd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1fac3a0cb7ed5c158faaa51651" ON "penalty_records" ("contractId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fd852fdfd0b11c51cb36d8672a" ON "penalty_records" ("bookingId") `);
        await queryRunner.query(`CREATE INDEX "IDX_cd4f7dc9f4dc7e79339fde24b5" ON "penalty_records" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c0cbc376b7b73b8c13e0c1b1e4" ON "penalty_records" ("period") `);
        await queryRunner.query(`CREATE INDEX "IDX_191dbdc840a5e6771802c67b24" ON "penalty_records" ("overdueDate") `);
        await queryRunner.query(`ALTER TABLE "invoice" ADD "billingPeriod" character varying(7)`);
        await queryRunner.query(`ALTER TABLE "penalty_records" ADD CONSTRAINT "FK_1fac3a0cb7ed5c158faaa51651c" FOREIGN KEY ("contractId") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "penalty_records" ADD CONSTRAINT "FK_fd852fdfd0b11c51cb36d8672aa" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "penalty_records" DROP CONSTRAINT "FK_fd852fdfd0b11c51cb36d8672aa"`);
        await queryRunner.query(`ALTER TABLE "penalty_records" DROP CONSTRAINT "FK_1fac3a0cb7ed5c158faaa51651c"`);
        await queryRunner.query(`ALTER TABLE "invoice" DROP COLUMN "billingPeriod"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_191dbdc840a5e6771802c67b24"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c0cbc376b7b73b8c13e0c1b1e4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cd4f7dc9f4dc7e79339fde24b5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fd852fdfd0b11c51cb36d8672a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1fac3a0cb7ed5c158faaa51651"`);
        await queryRunner.query(`DROP TABLE "penalty_records"`);
    }

}
