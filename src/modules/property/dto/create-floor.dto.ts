import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional } from 'class-validator';

export class CreateFloorDto {
  @IsString()
  @IsOptional()
  @ApiProperty({
    example: 'Tầng trệt',
    description: 'Tên tầng',
  })
  name?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @ApiProperty({
    example: ['A101', 'A102', 'A103', 'A104'],
    description: 'Danh sách phòng trong tầng',
  })
  rooms?: string[];
}
