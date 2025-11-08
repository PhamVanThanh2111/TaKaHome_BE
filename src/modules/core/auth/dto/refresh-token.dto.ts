import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token',
  })
  @IsNotEmpty({ message: 'Refresh token không được để trống' })
  @IsString()
  refreshToken: string;
}
