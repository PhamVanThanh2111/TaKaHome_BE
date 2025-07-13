import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: 'b7c1cf97-6734-43ae-9a62-0f97b48f5123' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'Nguyễn Văn A', required: false })
  fullName?: string;

  @ApiProperty({ example: '0123456789', required: false })
  phone?: string;

  @ApiProperty({ example: true })
  isVerified: boolean;
}
