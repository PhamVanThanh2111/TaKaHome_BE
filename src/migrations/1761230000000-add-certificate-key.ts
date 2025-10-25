import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCertificateKey1761230000000 implements MigrationInterface {
  name = 'AddCertificateKey1761230000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "certificate_key" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "private_key_encrypted" text NOT NULL, "certificate_pem" text NOT NULL, "serial_number" character varying(255), "issued_at" TIMESTAMP WITH TIME ZONE, "expires_at" TIMESTAMP WITH TIME ZONE, "revoked" boolean NOT NULL DEFAULT false, "revoked_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_certificate_key_id" PRIMARY KEY ("id"))`);
    await queryRunner.query(`ALTER TABLE "certificate_key" ADD CONSTRAINT "UQ_certificate_key_user_id" UNIQUE ("user_id")`);
    await queryRunner.query(`ALTER TABLE "certificate_key" ADD CONSTRAINT "FK_certificate_key_user" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "certificate_key" DROP CONSTRAINT "FK_certificate_key_user"`);
    await queryRunner.query(`ALTER TABLE "certificate_key" DROP CONSTRAINT "UQ_certificate_key_user_id"`);
    await queryRunner.query(`DROP TABLE "certificate_key"`);
  }
}
