import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateReportDto {
  @IsNotEmpty()
  @ApiProperty({
    example: '7c28a830-2341-4f0d-98ea-fb9b3b1f67c9',
    description: 'ID bất động sản',
  })
  propertyId: string;

  @IsString()
  @ApiProperty({
    example: 'Tường nhà bị nứt, cần sửa chữa',
    description: 'Nội dung báo cáo',
  })
  content: string;
}
