import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class RemovePropertyUtilityTable1678886400000
  implements MigrationInterface
{
  // Tên bảng cần xóa
  private readonly TABLE_NAME = 'property_utility';

  // Tên Foreign Key (Để phục vụ cho rollback)
  private readonly PROPERTY_FK_NAME =
    'FK_property_utility_propertyId_to_property';

  /**
   * Phương thức UP: Xóa bảng (DROP TABLE)
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Lệnh DROP TABLE sẽ xóa bảng property_utility
    await queryRunner.dropTable(this.TABLE_NAME);
    console.log(`✅ Table '${this.TABLE_NAME}' has been dropped successfully.`);
  }

  /**
   * Phương thức DOWN: Tạo lại bảng (CREATE TABLE) để rollback
   * Lưu ý: Nếu bạn không có nhu cầu rollback thì có thể để trống phương thức này.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Tạo lại bảng property_utility
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
            name: 'name',
            type: 'character varying',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'character varying',
            isNullable: true,
          },
          {
            name: 'propertyId',
            type: 'uuid',
            isNullable: true,
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
