import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsBooleanString,
  IsNumberString,
  IsString,
} from 'class-validator';

export class EmbedCmsDto {
  @ApiPropertyOptional({
    description: 'Index của placeholder chữ ký (0-based). Mặc định 0.',
    example: '0',
  })
  @IsOptional()
  @IsNumberString()
  signatureIndex?: string;

  @ApiPropertyOptional({
    description: 'CMS/PKCS#7 chuỗi base64 (mặc định dùng field này).',
    example: 'MIIG...==',
  })
  @IsOptional()
  @IsString()
  cmsBase64?: string;

  @ApiPropertyOptional({
    description: 'CMS ở dạng hex (nếu không gửi base64).',
    example: '3082...A0F',
  })
  @IsOptional()
  @IsString()
  cmsHex?: string;

  @ApiPropertyOptional({
    description: 'true nếu cmsHex được sử dụng thay vì cmsBase64',
    example: 'false',
  })
  @IsOptional()
  @IsBooleanString()
  cmsIsHex?: string;
}
