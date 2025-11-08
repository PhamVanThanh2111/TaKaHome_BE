import { MigrationInterface, QueryRunner } from "typeorm";

export class ContractTerminationRequest1762609356157 implements MigrationInterface {
    name = 'ContractTerminationRequest1762609356157'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."contract_termination_requests_requestedbyrole_enum" AS ENUM('TENANT', 'LANDLORD')`);
        await queryRunner.query(`CREATE TYPE "public"."contract_termination_requests_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED')`);
        await queryRunner.query(`CREATE TABLE "contract_termination_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "contractId" uuid NOT NULL, "requestedById" uuid NOT NULL, "requestedByRole" "public"."contract_termination_requests_requestedbyrole_enum" NOT NULL, "reason" text, "requestedEndMonth" character varying(7) NOT NULL, "status" "public"."contract_termination_requests_status_enum" NOT NULL DEFAULT 'PENDING', "approvedById" uuid, "respondedAt" TIMESTAMP WITH TIME ZONE, "responseNote" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5e043c96642d0ad78ac0abcbdf7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "contract_termination_requests" ADD CONSTRAINT "FK_e91bbf54c191bc98da43db17009" FOREIGN KEY ("contractId") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "contract_termination_requests" ADD CONSTRAINT "FK_b46d5239820a56143c6d900dbe6" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "contract_termination_requests" ADD CONSTRAINT "FK_f2a6ce999fc4a03aab6b94bb6e3" FOREIGN KEY ("approvedById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contract_termination_requests" DROP CONSTRAINT "FK_f2a6ce999fc4a03aab6b94bb6e3"`);
        await queryRunner.query(`ALTER TABLE "contract_termination_requests" DROP CONSTRAINT "FK_b46d5239820a56143c6d900dbe6"`);
        await queryRunner.query(`ALTER TABLE "contract_termination_requests" DROP CONSTRAINT "FK_e91bbf54c191bc98da43db17009"`);
        await queryRunner.query(`DROP TABLE "contract_termination_requests"`);
        await queryRunner.query(`DROP TYPE "public"."contract_termination_requests_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."contract_termination_requests_requestedbyrole_enum"`);
    }

}
