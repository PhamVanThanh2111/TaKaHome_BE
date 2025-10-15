import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class ApprovePropertiesDto {
  @ApiProperty({
    description: 'Mảng các ID của properties cần duyệt',
    type: [String],
  })
  @IsArray()
  @IsNotEmpty({ each: true })
  @IsString({ each: true })
  propertyIds: string[];
}
