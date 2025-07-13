import { PartialType } from '@nestjs/mapped-types';
import { CreateReportDto } from './create-report.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateReportDto extends PartialType(CreateReportDto) {
  @ApiPropertyOptional({
    example: '9c6c6b92-913c-4638-a2a6-54f8d3c4e3df',
    description: 'ID report',
  })
  id?: string;

  @ApiPropertyOptional({ example: true, description: 'Đã xử lý' })
  resolved?: boolean;
}
