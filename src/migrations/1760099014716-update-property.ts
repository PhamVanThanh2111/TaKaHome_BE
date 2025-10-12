import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateProperty1760099014716 implements MigrationInterface {
    name = 'UpdateProperty1760099014716'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "floor" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "rooms" text array NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "propertyId" uuid, CONSTRAINT "PK_16a0823530c5b0dd226b8a96ee1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "room_type" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "bedrooms" integer NOT NULL DEFAULT '1', "bathrooms" integer NOT NULL DEFAULT '1', "area" numeric(10,2) NOT NULL, "price" numeric(15,2) NOT NULL, "deposit" numeric(15,2) NOT NULL, "count" integer NOT NULL DEFAULT '1', "locations" text array NOT NULL, "images" text array NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "description" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "propertyId" uuid, CONSTRAINT "PK_abd0f8a4c8a444a84fa2b343353" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "property" ADD "province" character varying`);
        await queryRunner.query(`ALTER TABLE "property" ADD "district" character varying`);
        await queryRunner.query(`ALTER TABLE "property" ADD "block" character varying`);
        await queryRunner.query(`ALTER TABLE "property" ADD "floor" character varying`);
        await queryRunner.query(`ALTER TABLE "property" ADD "unit" character varying`);
        await queryRunner.query(`ALTER TABLE "property" ADD "furnishing" character varying`);
        await queryRunner.query(`ALTER TABLE "property" ADD "legalDoc" character varying`);
        await queryRunner.query(`ALTER TABLE "property" ADD "deposit" integer`);
        await queryRunner.query(`ALTER TABLE "property" ADD "heroImage" character varying`);
        await queryRunner.query(`ALTER TABLE "property" ADD "images" text array`);
        await queryRunner.query(`ALTER TYPE "public"."property_type_enum" RENAME TO "property_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."property_type_enum" AS ENUM('HOUSING', 'APARTMENT', 'BOARDING')`);
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "type" TYPE "public"."property_type_enum" USING "type"::"text"::"public"."property_type_enum"`);
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "type" SET DEFAULT 'HOUSING'`);
        await queryRunner.query(`DROP TYPE "public"."property_type_enum_old"`);
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "address" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "floor" ADD CONSTRAINT "FK_6979ffeebc1da40fb0442eec70c" FOREIGN KEY ("propertyId") REFERENCES "property"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "room_type" ADD CONSTRAINT "FK_d39f8507f26c31a196f64df8d67" FOREIGN KEY ("propertyId") REFERENCES "property"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "room_type" DROP CONSTRAINT "FK_d39f8507f26c31a196f64df8d67"`);
        await queryRunner.query(`ALTER TABLE "floor" DROP CONSTRAINT "FK_6979ffeebc1da40fb0442eec70c"`);
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "address" SET NOT NULL`);
        await queryRunner.query(`CREATE TYPE "public"."property_type_enum_old" AS ENUM('HOUSE', 'APARTMENT', 'BUSINESS_PREMISES', 'LAND', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "type" TYPE "public"."property_type_enum_old" USING "type"::"text"::"public"."property_type_enum_old"`);
        await queryRunner.query(`ALTER TABLE "property" ALTER COLUMN "type" SET DEFAULT 'HOUSE'`);
        await queryRunner.query(`DROP TYPE "public"."property_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."property_type_enum_old" RENAME TO "property_type_enum"`);
        await queryRunner.query(`ALTER TABLE "property" DROP COLUMN "images"`);
        await queryRunner.query(`ALTER TABLE "property" DROP COLUMN "heroImage"`);
        await queryRunner.query(`ALTER TABLE "property" DROP COLUMN "deposit"`);
        await queryRunner.query(`ALTER TABLE "property" DROP COLUMN "legalDoc"`);
        await queryRunner.query(`ALTER TABLE "property" DROP COLUMN "furnishing"`);
        await queryRunner.query(`ALTER TABLE "property" DROP COLUMN "unit"`);
        await queryRunner.query(`ALTER TABLE "property" DROP COLUMN "floor"`);
        await queryRunner.query(`ALTER TABLE "property" DROP COLUMN "block"`);
        await queryRunner.query(`ALTER TABLE "property" DROP COLUMN "district"`);
        await queryRunner.query(`ALTER TABLE "property" DROP COLUMN "province"`);
        await queryRunner.query(`DROP TABLE "room_type"`);
        await queryRunner.query(`DROP TABLE "floor"`);
    }

}
