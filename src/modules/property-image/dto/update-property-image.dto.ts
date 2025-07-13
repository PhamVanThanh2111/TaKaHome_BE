import { PartialType } from '@nestjs/mapped-types';
import { CreatePropertyImageDto } from './create-property-image.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePropertyImageDto extends PartialType(
  CreatePropertyImageDto,
) {
  @ApiPropertyOptional({
    example: 'b8ef15c7-9db1-4b9f-8c44-420b4b9e9877',
    description: 'ID image',
  })
  id?: string;
}
