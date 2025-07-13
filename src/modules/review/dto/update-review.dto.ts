import { PartialType } from '@nestjs/mapped-types';
import { CreateReviewDto } from './create-review.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateReviewDto extends PartialType(CreateReviewDto) {
  @ApiPropertyOptional({
    example: '72e75314-54c5-441f-9dbd-4fd3469ea9e0',
    description: 'ID review',
  })
  id?: string;
}
