import { PartialType } from '@nestjs/mapped-types';
import { CreateNotificationDto } from './create-notification.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatusEnum } from 'src/modules/common/enums/status.enum';

export class UpdateNotificationDto extends PartialType(CreateNotificationDto) {
  @ApiPropertyOptional({
    example: 'fd2c7dbb-7031-4d6c-a548-123b12f6e5cd',
    description: 'ID notification',
  })
  id?: string;

  @ApiPropertyOptional({ example: StatusEnum.ACTIVE, enum: StatusEnum })
  status?: StatusEnum;
}
