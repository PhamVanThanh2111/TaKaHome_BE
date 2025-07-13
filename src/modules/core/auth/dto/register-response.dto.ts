import { ApiProperty } from '@nestjs/swagger';

export class RegisterResponseDto {
  @ApiProperty({ example: 'Register successful!' })
  message: string;
}
