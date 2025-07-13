import { ApiProperty } from '@nestjs/swagger';

export class ReportResponseDto {
  @ApiProperty({ example: '9c6c6b92-913c-4638-a2a6-54f8d3c4e3df' })
  id: string;

  @ApiProperty({ example: '3e4b78fd-24fa-4eac-a08a-236b6d2a9ee7' })
  reporterId: string;

  @ApiProperty({ example: '7c28a830-2341-4f0d-98ea-fb9b3b1f67c9' })
  propertyId: string;

  @ApiProperty({ example: 'Tường nhà bị nứt, cần sửa chữa' })
  content: string;

  @ApiProperty({ example: false })
  resolved: boolean;

  @ApiProperty({
    example: '2024-07-16T13:10:30.000Z',
    description: 'Ngày tạo',
    required: false,
  })
  createdAt?: string;
}
