import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateProperty11760099875139 implements MigrationInterface {
    name = 'UpdateProperty11760099875139'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "property" RENAME COLUMN "district" TO "ward"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "property" RENAME COLUMN "ward" TO "district"`);
    }

}
