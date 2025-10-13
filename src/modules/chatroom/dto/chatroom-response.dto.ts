import { ApiProperty } from '@nestjs/swagger';

export class UserBasicDto {
  @ApiProperty({ example: '81df6c8e-902e-41f6-9d92-9433e4f5c6b7' })
  id: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  fullName: string;

  @ApiProperty({ example: 'nguyenvana@email.com' })
  email: string;
}

export class PropertyBasicDto {
  @ApiProperty({ example: '443e2e1e-d55b-4c0d-8c29-5643fa14cbe7' })
  id: string;

  @ApiProperty({ example: 'Căn hộ cao cấp 2 phòng ngủ' })
  title: string;

  @ApiProperty({ example: '123 Đường ABC, Quận 1, TP.HCM' })
  address: string;
}

export class ChatRoomResponseDto {
  @ApiProperty({ example: '73b3987b-f8bb-4282-9c32-11b48f5e9633' })
  id: string;

  @ApiProperty({ type: UserBasicDto })
  user1: UserBasicDto;

  @ApiProperty({ type: UserBasicDto })
  user2: UserBasicDto;

  @ApiProperty({ type: PropertyBasicDto, required: false })
  property?: PropertyBasicDto;

  @ApiProperty({ 
    example: '2024-01-15T10:30:00.000Z',
    description: 'Thời gian tạo chatroom'
  })
  createdAt: string;

  @ApiProperty({ 
    example: '2024-01-15T14:22:00.000Z',
    description: 'Thời gian cập nhật cuối'
  })
  updatedAt: string;
}
