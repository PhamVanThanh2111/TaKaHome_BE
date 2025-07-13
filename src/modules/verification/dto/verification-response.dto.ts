import { ApiProperty } from '@nestjs/swagger';
import { VerificationTypeEnum } from '../../common/enums/verification-type.enum';
import { StatusEnum } from '../../common/enums/status.enum';

export class VerificationResponseDto {
  @ApiProperty({ example: '3ccf4b62-8e02-41d4-93da-c236d72c9283' })
  id: string;

  @ApiProperty({ example: 'c90e6e31-66b7-46e4-b668-63b3b286a792' })
  userId: string;

  @ApiProperty({
    example: VerificationTypeEnum.ID_CARD,
    enum: VerificationTypeEnum,
  })
  type: VerificationTypeEnum;

  @ApiProperty({ example: 'https://cdn.domain.com/verify/123.pdf' })
  documentUrl: string;

  @ApiProperty({ example: StatusEnum.PENDING, enum: StatusEnum })
  status: StatusEnum;

  @ApiProperty({
    example: 'ffae7a71-47e1-4a94-93d7-02fd6188dbe2',
    required: false,
  })
  verifiedById?: string;

  @ApiProperty({
    example: '2024-07-17T14:12:40.000Z',
    description: 'Ngày tạo',
    required: false,
  })
  createdAt?: string;
}
