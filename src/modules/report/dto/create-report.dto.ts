import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateReportDto {
  @IsOptional()
  @ApiProperty({
    description: 'ID bất động sản',
  })
  propertyId?: string;

  @IsOptional()
  @ApiProperty({
    description: 'ID phòng',
  })
  roomId?: string;

  @IsString()
  @ApiProperty({
    example: 'Tường nhà bị nứt, cần sửa chữa',
    description: 'Nội dung báo cáo',
  })
  content: string;
}
