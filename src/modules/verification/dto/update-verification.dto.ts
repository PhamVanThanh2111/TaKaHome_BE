import { PartialType } from '@nestjs/mapped-types';
import { CreateVerificationDto } from './create-verification.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatusEnum } from 'src/modules/common/enums/status.enum';

export class UpdateVerificationDto extends PartialType(CreateVerificationDto) {
  @ApiPropertyOptional({
    example: '3ccf4b62-8e02-41d4-93da-c236d72c9283',
    description: 'ID verification',
  })
  id?: string;

  @ApiPropertyOptional({ example: StatusEnum.APPROVED, enum: StatusEnum })
  status?: StatusEnum;
}
