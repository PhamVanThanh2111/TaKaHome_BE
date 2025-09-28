import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumberString } from 'class-validator';

export class ComputeHashDto {
  @ApiPropertyOptional({
    description:
      'Index của placeholder signature muốn tính hash (0-based). Mặc định 0 (Signature1).',
    example: '0',
  })
  @IsOptional()
  @IsNumberString()
  signatureIndex?: string;
}
