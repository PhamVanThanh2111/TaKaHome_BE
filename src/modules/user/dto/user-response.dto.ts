import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatusEnum } from '../../common/enums/user-status.enum';

export class UserResponseDto {
  @ApiProperty({ 
    example: 'b7c1cf97-6734-43ae-9a62-0f97b48f5123',
    description: 'ID của user'
  })
  id: string;

  @ApiProperty({ 
    example: 'user@example.com',
    description: 'Email của user'
  })
  email: string;

  @ApiPropertyOptional({ 
    example: 'Nguyễn Văn A',
    description: 'Họ tên đầy đủ'
  })
  fullName?: string;

  @ApiPropertyOptional({ 
    example: '0123456789',
    description: 'Số điện thoại'
  })
  phone?: string;

  @ApiProperty({ 
    example: true,
    description: 'Trạng thái xác thực email'
  })
  isVerified: boolean;

  @ApiPropertyOptional({ 
    example: 'https://example.com/avatar.jpg',
    description: 'URL avatar'
  })
  avatarUrl?: string;

  @ApiProperty({ 
    enum: UserStatusEnum,
    example: UserStatusEnum.ACTIVE,
    description: 'Trạng thái tài khoản'
  })
  status: UserStatusEnum;

  @ApiPropertyOptional({ 
    example: '123456789012',
    description: 'Số CCCD'
  })
  CCCD?: string;

  @ApiProperty({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Thời gian tạo tài khoản'
  })
  createdAt: Date;

  @ApiProperty({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Thời gian cập nhật cuối'
  })
  updatedAt: Date;
}
