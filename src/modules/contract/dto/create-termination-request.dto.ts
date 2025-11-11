import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateTerminationRequestDto {
  @ApiProperty({
    description: 'ID của hợp đồng cần hủy',
  })
  @IsNotEmpty()
  @IsString()
  contractId: string;

  @ApiProperty({
    description:
      'Tháng/năm mà người yêu cầu muốn kết thúc hợp đồng (Format: YYYY-MM). ' +
      'Lưu ý: Phải thông báo trước ít nhất 1 tháng. ' +
      'Ví dụ: Hiện tại là tháng 5/2025, muốn kết thúc thì phải từ tháng 7/2025 trở đi (tháng 6 là tháng thanh toán cuối cùng).',
    example: '2025-07',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'requestedEndMonth phải có format YYYY-MM (ví dụ: 2025-07)',
  })
  requestedEndMonth: string;

  @ApiProperty({
    description: 'Lý do muốn hủy hợp đồng',
    example: 'Tôi cần chuyển đi nơi khác do công việc',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
