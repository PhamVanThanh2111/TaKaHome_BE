import { IsNotEmpty, IsString, IsEnum } from 'class-validator';
import { NotificationTypeEnum } from '../../common/enums/notification-type.enum';
import { StatusEnum } from '../../common/enums/status.enum';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNotificationDto {
  @IsNotEmpty()
  @ApiProperty({
    example: 'a17ee20d-cae4-422f-bf8c-11a8c0de4f32',
    description: 'ID user nhận thông báo',
  })
  userId: string;

  @IsEnum(NotificationTypeEnum)
  @ApiProperty({
    example: NotificationTypeEnum.PAYMENT,
    enum: NotificationTypeEnum,
    description: 'Loại thông báo',
  })
  type: NotificationTypeEnum;

  @IsString()
  @ApiProperty({
    example: 'Thanh toán thành công',
    description: 'Tiêu đề thông báo',
  })
  title: string;

  @IsString()
  @ApiProperty({
    example: 'Bạn vừa thanh toán tiền thuê nhà tháng 7',
    description: 'Nội dung thông báo',
  })
  content: string;

  @IsEnum(StatusEnum)
  @ApiProperty({
    example: StatusEnum.PENDING,
    enum: StatusEnum,
    required: false,
    description: 'Trạng thái thông báo',
  })
  status?: StatusEnum;
}
