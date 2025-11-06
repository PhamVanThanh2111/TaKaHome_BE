import { MigrationInterface, QueryRunner } from "typeorm";

export class AddResetPasswordToken1762438962343 implements MigrationInterface {
    name = 'AddResetPasswordToken1762438962343'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "certificate_key" DROP CONSTRAINT "FK_certificate_key_user"`);
        await queryRunner.query(`ALTER TABLE "account" ADD "resetPasswordToken" character varying(500)`);
        await queryRunner.query(`ALTER TYPE "public"."invoice_servicetype_enum" RENAME TO "invoice_servicetype_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."invoice_item_servicetype_enum" AS ENUM('ELECTRICITY', 'WATER', 'PARKING', 'INTERNET', 'CLEANING', 'SECURITY', 'RENT', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "invoice_item" ALTER COLUMN "serviceType" TYPE "public"."invoice_item_servicetype_enum" USING "serviceType"::"text"::"public"."invoice_item_servicetype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."invoice_servicetype_enum_old"`);
        await queryRunner.query(`ALTER TABLE "certificate_key" ADD CONSTRAINT "FK_831b94a30ccbda6b0d565ac6934" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "certificate_key" DROP CONSTRAINT "FK_831b94a30ccbda6b0d565ac6934"`);
        await queryRunner.query(`CREATE TYPE "public"."invoice_servicetype_enum_old" AS ENUM('ELECTRICITY', 'WATER', 'PARKING', 'INTERNET', 'CLEANING', 'SECURITY', 'RENT', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "invoice_item" ALTER COLUMN "serviceType" TYPE "public"."invoice_servicetype_enum_old" USING "serviceType"::"text"::"public"."invoice_servicetype_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."invoice_item_servicetype_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."invoice_servicetype_enum_old" RENAME TO "invoice_servicetype_enum"`);
        await queryRunner.query(`ALTER TABLE "account" DROP COLUMN "resetPasswordToken"`);
        await queryRunner.query(`ALTER TABLE "certificate_key" ADD CONSTRAINT "FK_certificate_key_user" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
