import { ApiProperty } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty({ example: 'b432ef6e-12e9-415d-acc8-5cb3c3cc285b' })
  id: string;

  @ApiProperty({ example: '72e75314-54c5-441f-9dbd-4fd3469ea9e0' })
  senderId: string;

  @ApiProperty({ example: 'a17ee20d-cae4-422f-bf8c-11a8c0de4f32' })
  receiverId: string;

  @ApiProperty({ example: 'e320aa67-b53b-4c4a-bd50-31e8b312defa' })
  propertyId: string;

  @ApiProperty({ example: 'Xin chào, tôi muốn hỏi thêm về căn hộ này!' })
  content: string;

  @ApiProperty({
    example: '2024-07-16T10:30:15.000Z',
    description: 'Ngày gửi',
    required: false,
  })
  createdAt?: string;
}
