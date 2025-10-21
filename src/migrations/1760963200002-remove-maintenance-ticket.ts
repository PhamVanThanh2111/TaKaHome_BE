import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

// Định nghĩa Enum Type cho cột status
const MAINTENANCE_TICKET_STATUS_ENUM = 'maintenance_ticket_status_enum';

export class RemoveMaintenanceTicketTable1760963200002
  implements MigrationInterface
{
  // Tên bảng cần xóa
  private readonly TABLE_NAME = 'maintenance_ticket';

  // Tên Foreign Key (Để phục vụ cho rollback)
  private readonly BOOKING_FK_NAME =
    'FK_maintenance_ticket_bookingId_to_booking';

  /**
   * Phương thức UP: Xóa bảng (DROP TABLE)
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Xóa bảng maintenance_ticket
    await queryRunner.dropTable(this.TABLE_NAME);
    // 2. Xóa Enum Type (Quan trọng vì TypeORM không tự động xóa Enum Type khi DROP TABLE)
    await queryRunner.query(`DROP TYPE ${MAINTENANCE_TICKET_STATUS_ENUM}`);
    
    console.log(`✅ Table and Enum Type for '${this.TABLE_NAME}' have been dropped successfully.`);
  }

  /**
   * Phương thức DOWN: Tạo lại bảng (CREATE TABLE) và Enum Type để rollback
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Tạo lại Enum Type trước
    await queryRunner.query(
        `CREATE TYPE ${MAINTENANCE_TICKET_STATUS_ENUM} AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED', 'CANCELED')`
    );

    // 2. Tạo lại bảng maintenance_ticket
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
            name: 'description',
            type: 'text', // Theo ảnh
            isNullable: false,
          },
          {
            name: 'status',
            type: MAINTENANCE_TICKET_STATUS_ENUM, // Sử dụng Enum Type vừa tạo
            isNullable: false,
            default: `'OPEN'`, // Theo ảnh
          },
          {
            name: 'createdAt',
            type: 'timestamptz', // Theo ảnh
            isNullable: false,
            default: 'now()', // Theo ảnh
          },
          {
            name: 'updatedAt',
            type: 'timestamptz', // Theo ảnh
            isNullable: false,
            default: 'now()', // Theo ảnh
          },
          {
            name: 'bookingId',
            type: 'uuid', // Theo ảnh
            isNullable: true, // Theo ảnh
          },
        ],
      }),
      true,
    );

    // 3. Tạo lại Foreign Key cho bookingId
    await queryRunner.createForeignKey(
      this.TABLE_NAME,
      new TableForeignKey({
        columnNames: ['bookingId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'booking',
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
        name: this.BOOKING_FK_NAME,
      }),
    );

    console.log(
      `🔄 Table and Enum Type for '${this.TABLE_NAME}' have been recreated for rollback.`,
    );
  }
}