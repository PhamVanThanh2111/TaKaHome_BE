import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateAdminActionDto {
  @IsNotEmpty()
  @ApiProperty({
    example: '3f7be1ae-c9d6-43ae-8bcf-145d13238a3e',
    description: 'ID admin thực hiện hành động',
  })
  adminId: string;

  @IsNotEmpty()
  @ApiProperty({
    example: '8b4e613c-6b85-41d5-bde3-ecbc1a7c1785',
    description: 'ID user bị tác động',
  })
  targetId: string;

  @IsString()
  @ApiProperty({
    example: 'BAN_USER',
    description:
      'Kiểu hành động (ví dụ: BAN_USER, UNBAN_USER, VERIFY_PROPERTY)',
  })
  actionType: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    example: 'Vi phạm điều khoản sử dụng',
    required: false,
    description: 'Mô tả chi tiết (nếu có)',
  })
  description?: string;
}
