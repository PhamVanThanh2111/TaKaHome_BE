import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ChatbotMessageDto {
  @ApiProperty({
    description: 'Tin nhắn gửi cho chatbot',
    example:
      'Tôi muốn tìm nhà trọ ở quận 1, giá dưới 5 triệu, có wifi và điều hòa',
    maxLength: 1000,
  })
  @IsNotEmpty({ message: 'Tin nhắn không được để trống' })
  @IsString({ message: 'Tin nhắn phải là chuỗi' })
  @MaxLength(1000, { message: 'Tin nhắn không được vượt quá 1000 ký tự' })
  message: string;
}
