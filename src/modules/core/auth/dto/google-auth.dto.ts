import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleAuthCallbackDto {
  @ApiProperty({
    description: 'Authorization code từ Google',
    example: '4/0AdLIrYeabcdefghijklmnopqrstuvwxyz',
  })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class GoogleAuthResponseDto {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Thông tin account',
  })
  account: {
    id: string;
    email: string;
    roles: string[];
    isVerified: boolean;
    user: {
      id: string;
      fullName: string;
      avatarUrl?: string;
      status: string;
      CCCD?: string;
      phone?: string;
    };
    createdAt: Date;
    updatedAt: Date;
  };

  @ApiProperty({
    description: 'Trạng thái tài khoản (new hoặc existing)',
    example: 'new',
  })
  accountStatus: 'new' | 'existing';
}