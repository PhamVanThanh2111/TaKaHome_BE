import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordResponseDto {
  @ApiProperty({
    example: 200,
    description: 'Status code',
  })
  statusCode: number;

  @ApiProperty({
    example: 'SUCCESS',
    description: 'Message',
  })
  message: string;

  @ApiProperty({
    example: {
      message: 'Password reset successful!',
    },
    description: 'Data',
  })
  data: {
    message: string;
  };
}
