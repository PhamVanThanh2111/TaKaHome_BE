import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateIf,
} from 'class-validator';

export class MoveRoomDto {
  @IsString()
  @IsOptional()
  @ValidateIf((o: MoveRoomDto) => !o.createNewRoomType)
  @ApiPropertyOptional({
    example: 'f17ad8cf-f2f5-4b9c-b6cd-f72193fd44fd',
    description:
      'ID của RoomType đích (bắt buộc nếu createNewRoomType = false hoặc undefined)',
  })
  targetRoomTypeId?: string;

  @IsOptional()
  @ApiPropertyOptional({
    example: false,
    description:
      'true = tạo RoomType mới và chuyển Room vào đó, false/undefined = chuyển vào RoomType có sẵn',
    default: false,
  })
  createNewRoomType?: boolean;

  // Fields cho RoomType mới (chỉ dùng khi createNewRoomType = true)
  @IsString()
  @IsOptional()
  @ValidateIf((o: MoveRoomDto) => o.createNewRoomType === true)
  @IsNotEmpty()
  @ApiPropertyOptional({
    example: 'Phòng VIP có WC riêng',
    description: 'Tên loại phòng mới (bắt buộc nếu createNewRoomType = true)',
  })
  newRoomTypeName?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({
    example: 'Phòng trọ cao cấp với đầy đủ tiện nghi',
    description: 'Mô tả loại phòng mới',
  })
  newRoomTypeDescription?: string;

  @IsNumber()
  @IsOptional()
  @ValidateIf((o: MoveRoomDto) => o.createNewRoomType === true)
  @IsNotEmpty()
  @ApiPropertyOptional({
    example: 1,
    description: 'Số phòng ngủ (bắt buộc nếu createNewRoomType = true)',
  })
  newRoomTypeBedrooms?: number;

  @IsNumber()
  @IsOptional()
  @ValidateIf((o: MoveRoomDto) => o.createNewRoomType === true)
  @IsNotEmpty()
  @ApiPropertyOptional({
    example: 1,
    description: 'Số phòng tắm (bắt buộc nếu createNewRoomType = true)',
  })
  newRoomTypeBathrooms?: number;

  @IsNumber()
  @IsOptional()
  @ValidateIf((o: MoveRoomDto) => o.createNewRoomType === true)
  @IsNotEmpty()
  @ApiPropertyOptional({
    example: 25,
    description: 'Diện tích (m2) (bắt buộc nếu createNewRoomType = true)',
  })
  newRoomTypeArea?: number;

  @IsNumber()
  @IsOptional()
  @ValidateIf((o: MoveRoomDto) => o.createNewRoomType === true)
  @IsNotEmpty()
  @ApiPropertyOptional({
    example: 4500000,
    description: 'Giá thuê (VND/tháng) (bắt buộc nếu createNewRoomType = true)',
  })
  newRoomTypePrice?: number;

  @IsNumber()
  @IsOptional()
  @ValidateIf((o: MoveRoomDto) => o.createNewRoomType === true)
  @IsNotEmpty()
  @ApiPropertyOptional({
    example: 4500000,
    description: 'Tiền cọc (VND) (bắt buộc nếu createNewRoomType = true)',
  })
  newRoomTypeDeposit?: number;

  @IsString()
  @IsOptional()
  @ValidateIf((o: MoveRoomDto) => o.createNewRoomType === true)
  @IsNotEmpty()
  @ApiPropertyOptional({
    example: 'Đầy đủ',
    description: 'Nội thất (bắt buộc nếu createNewRoomType = true)',
  })
  newRoomTypeFurnishing?: string;
}
