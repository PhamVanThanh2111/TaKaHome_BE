import { MigrationInterface, QueryRunner } from "typeorm";

export class ContractExtension1760869722984 implements MigrationInterface {
    name = 'ContractExtension1760869722984'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."contract_extensions_status_enum" AS ENUM('PENDING', 'LANDLORD_RESPONDED', 'APPROVED', 'REJECTED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "contract_extensions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "contractId" uuid NOT NULL, "extensionMonths" integer NOT NULL, "newMonthlyRent" integer, "newElectricityPrice" integer, "newWaterPrice" integer, "requestNote" text, "responseNote" text, "status" "public"."contract_extensions_status_enum" NOT NULL DEFAULT 'PENDING', "respondedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4055df3f6494ff30cd6d3e91428" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "contract_extensions" ADD CONSTRAINT "FK_921583f0a6e919291f49d8b9952" FOREIGN KEY ("contractId") REFERENCES "contract"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contract_extensions" DROP CONSTRAINT "FK_921583f0a6e919291f49d8b9952"`);
        await queryRunner.query(`DROP TABLE "contract_extensions"`);
        await queryRunner.query(`DROP TYPE "public"."contract_extensions_status_enum"`);
    }

}
