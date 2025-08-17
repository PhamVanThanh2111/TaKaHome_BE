import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({
    example: 'b7c1cf97-6734-43ae-9a62-0f97b48f5123',
    description: 'User id (uuid)',
  })
  id?: string;
}
