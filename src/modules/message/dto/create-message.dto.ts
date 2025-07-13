import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateMessageDto {
  @IsNotEmpty()
  @ApiProperty({
    example: '72e75314-54c5-441f-9dbd-4fd3469ea9e0',
    description: 'ID người gửi (sender)',
  })
  senderId: string;

  @IsNotEmpty()
  @ApiProperty({
    example: 'a17ee20d-cae4-422f-bf8c-11a8c0de4f32',
    description: 'ID người nhận (receiver)',
  })
  receiverId: string;

  @IsNotEmpty()
  @ApiProperty({
    example: 'e320aa67-b53b-4c4a-bd50-31e8b312defa',
    description: 'ID property (nếu có)',
  })
  propertyId: string;

  @IsString()
  @ApiProperty({
    example: 'Xin chào, tôi muốn hỏi thêm về căn hộ này!',
    description: 'Nội dung tin nhắn',
  })
  content: string;
}
