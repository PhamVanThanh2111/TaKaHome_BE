import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for face verification
 */
export class FaceVerificationResponseDto {
  @ApiProperty({
    description: 'Hai ảnh có cùng 1 người hay không (ngưỡng 80%)',
    example: true,
  })
  isMatch: boolean;

  @ApiProperty({
    description: 'Độ giống nhau của 2 ảnh (%)',
    example: 85.5,
    minimum: 0,
    maximum: 100,
  })
  similarity: number;

  @ApiProperty({
    description: 'Cả 2 ảnh có phải là ảnh CMND/CCCD không',
    example: false,
  })
  isBothImgIDCard: boolean;
}

/**
 * Error DTO for face verification
 */
export class FaceVerificationErrorDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Thông báo lỗi',
    example: 'Không nhận dạng được khuôn mặt',
  })
  message: string;

  @ApiProperty({
    description: 'Mã lỗi từ FPT.AI',
    example: 407,
    required: false,
  })
  errorCode?: number;
}
