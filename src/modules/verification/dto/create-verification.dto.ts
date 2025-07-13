import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';
import { VerificationTypeEnum } from '../../common/enums/verification-type.enum';
import { ApiProperty } from '@nestjs/swagger';
import { StatusEnum } from 'src/modules/common/enums/status.enum';

export class CreateVerificationDto {
  @IsNotEmpty()
  @ApiProperty({
    example: 'c90e6e31-66b7-46e4-b668-63b3b286a792',
    description: 'ID user cần xác minh',
  })
  userId: string;

  @IsEnum(VerificationTypeEnum)
  @ApiProperty({
    example: VerificationTypeEnum.ID_CARD,
    enum: VerificationTypeEnum,
    description: 'Loại giấy tờ xác minh',
  })
  type: VerificationTypeEnum;

  @IsString()
  @ApiProperty({
    example: 'https://cdn.domain.com/verify/123.pdf',
    description: 'URL file giấy tờ',
  })
  documentUrl: string;

  @IsOptional()
  @ApiProperty({
    example: StatusEnum.PENDING,
    enum: StatusEnum,
    required: false,
    description: 'Trạng thái xác minh',
  })
  status?: StatusEnum;

  @IsOptional()
  @ApiProperty({
    example: 'ffae7a71-47e1-4a94-93d7-02fd6188dbe2',
    required: false,
    description: 'ID admin xác minh (nếu có)',
  })
  verifiedById?: string;
}
