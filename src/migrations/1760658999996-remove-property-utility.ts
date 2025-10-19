import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class RemovePropertyImageTable1760658999997
  implements MigrationInterface
{
  // Tên bảng cần xóa
  private readonly TABLE_NAME = 'property_image';

  // Tên Foreign Key (Để phục vụ cho rollback)
  private readonly PROPERTY_FK_NAME =
    'FK_property_image_propertyId_to_property';

  /**
   * Phương thức UP: Xóa bảng (DROP TABLE)
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Lệnh DROP TABLE sẽ xóa bảng property_image và tự động xóa Foreign Key.
    await queryRunner.dropTable(this.TABLE_NAME);
    console.log(`✅ Table '${this.TABLE_NAME}' has been dropped successfully.`);
  }

  /**
   * Phương thức DOWN: Tạo lại bảng (CREATE TABLE) để rollback
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Tạo lại bảng property_image
    await queryRunner.createTable(
      new Table({
        name: this.TABLE_NAME,
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: false,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'imageUrl',
            type: 'character varying',
            isNullable: false, // Giả định imageUrl không NULL
          },
          {
            name: 'propertyId',
            type: 'uuid',
            isNullable: true, // Cột propertyId có NULL (như trong ảnh)
          },
        ],
      }),
      true,
    );

    // 2. Tạo lại Foreign Key
    await queryRunner.createForeignKey(
      this.TABLE_NAME,
      new TableForeignKey({
        columnNames: ['propertyId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'property',
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
        name: this.PROPERTY_FK_NAME,
      }),
    );

    console.log(
      `🔄 Table '${this.TABLE_NAME}' has been recreated for rollback.`,
    );
  }
}
