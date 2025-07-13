import { ApiProperty } from '@nestjs/swagger';
import { NotificationTypeEnum } from '../../common/enums/notification-type.enum';
import { StatusEnum } from '../../common/enums/status.enum';

export class NotificationResponseDto {
  @ApiProperty({ example: 'fd2c7dbb-7031-4d6c-a548-123b12f6e5cd' })
  id: string;

  @ApiProperty({ example: 'a17ee20d-cae4-422f-bf8c-11a8c0de4f32' })
  userId: string;

  @ApiProperty({
    example: NotificationTypeEnum.PAYMENT,
    enum: NotificationTypeEnum,
  })
  type: NotificationTypeEnum;

  @ApiProperty({ example: 'Thanh toán thành công' })
  title: string;

  @ApiProperty({ example: 'Bạn vừa thanh toán tiền thuê nhà tháng 7' })
  content: string;

  @ApiProperty({ example: StatusEnum.PENDING, enum: StatusEnum })
  status: StatusEnum;

  @ApiProperty({
    example: '2024-07-17T09:12:23.000Z',
    description: 'Ngày tạo',
    required: false,
  })
  createdAt?: string;
}
