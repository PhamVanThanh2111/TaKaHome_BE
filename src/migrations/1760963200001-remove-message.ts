import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

// Đổi tên class sao cho phù hợp với thời gian hiện tại hoặc mục đích
// Ví dụ: RemoveMessageTable + [timestamp]
export class RemoveMessageTable1760963200001
  implements MigrationInterface
{
  // Tên bảng cần xóa
  private readonly TABLE_NAME = 'message';

  // Tên các Foreign Key (Để phục vụ cho rollback)
  // Lấy từ ảnh: senderId, receiverId, propertyId
  private readonly SENDER_FK_NAME = 'FK_message_senderId_to_user';
  private readonly RECEIVER_FK_NAME = 'FK_message_receiverId_to_user';
  private readonly PROPERTY_FK_NAME = 'FK_message_propertyId_to_property';

  /**
   * Phương thức UP: Xóa bảng (DROP TABLE)
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Lệnh DROP TABLE sẽ xóa bảng message
    await queryRunner.dropTable(this.TABLE_NAME);
    console.log(`✅ Table '${this.TABLE_NAME}' has been dropped successfully.`);
  }

  /**
   * Phương thức DOWN: Tạo lại bảng (CREATE TABLE) để rollback
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Tạo lại bảng message
    await queryRunner.createTable(
      new Table({
        name: this.TABLE_NAME,
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: false,
            default: 'uuid_generate_v4()', // Theo ảnh
          },
          {
            name: 'content',
            type: 'text', // Theo ảnh
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp', // Theo ảnh
            isNullable: false,
            default: 'now()', // Theo ảnh
          },
          {
            name: 'senderId',
            type: 'uuid', // Theo ảnh
            isNullable: false, // Giả định là bắt buộc, không có trong ảnh nhưng sender phải có
          },
          {
            name: 'receiverId',
            type: 'uuid', // Theo ảnh
            isNullable: false, // Giả định là bắt buộc, không có trong ảnh nhưng receiver phải có
          },
          {
            name: 'propertyId',
            type: 'uuid', // Theo ảnh
            isNullable: true, // Theo ảnh
          },
        ],
      }),
      true,
    );

    // 2. Tạo lại các Foreign Key
    // senderId
    await queryRunner.createForeignKey(
      this.TABLE_NAME,
      new TableForeignKey({
        columnNames: ['senderId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'user',
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
        name: this.SENDER_FK_NAME,
      }),
    );

    // receiverId
    await queryRunner.createForeignKey(
      this.TABLE_NAME,
      new TableForeignKey({
        columnNames: ['receiverId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'user',
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
        name: this.RECEIVER_FK_NAME,
      }),
    );

    // propertyId (có thể NULL)
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