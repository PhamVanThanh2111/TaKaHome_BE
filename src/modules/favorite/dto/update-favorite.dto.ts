import { PartialType } from '@nestjs/mapped-types';
import { CreateFavoriteDto } from './create-favorite.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateFavoriteDto extends PartialType(CreateFavoriteDto) {
  @ApiPropertyOptional({
    example: 'b432ef6e-12e9-415d-acc8-5cb3c3cc285b',
    description: 'ID favorite',
  })
  id?: string;
}
