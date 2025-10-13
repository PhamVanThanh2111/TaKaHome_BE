import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreatePropertyChatDto {
  @IsNotEmpty()
  @IsUUID()
  @ApiProperty({
    example: '443e2e1e-d55b-4c0d-8c29-5643fa14cbe7',
    description: 'ID của bất động sản muốn chat về',
  })
  propertyId: string;
}