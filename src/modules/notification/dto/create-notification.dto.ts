import { IsNotEmpty, IsString, IsEnum } from 'class-validator';
import { NotificationTypeEnum } from '../../common/enums/notification-type.enum';
import { StatusEnum } from '../../common/enums/status.enum';

export class CreateNotificationDto {
  @IsNotEmpty()
  userId: string;

  @IsEnum(NotificationTypeEnum)
  type: NotificationTypeEnum;

  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsEnum(StatusEnum)
  status?: StatusEnum;
}
