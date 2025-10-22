import { ApiProperty } from '@nestjs/swagger';

export class CccdRecognitionResponseDto {
  @ApiProperty({ 
    description: 'Số CCCD/CMND',
    example: '123456789012'
  })
  id: string;

  @ApiProperty({ 
    description: 'Họ và tên',
    example: 'NGUYỄN VĂN A'
  })
  name: string;

  @ApiProperty({ 
    description: 'Ngày sinh',
    example: '01/01/1990'
  })
  dob: string;

  @ApiProperty({ 
    description: 'Giới tính',
    example: 'Nam'
  })
  sex: string;

  @ApiProperty({ 
    description: 'Quê quán',
    example: 'Hà Nội'
  })
  home: string;

  @ApiProperty({ 
    description: 'Nơi thường trú',
    example: 'Số 1, Đường ABC, Phường XYZ, Quận DEF, Hà Nội'
  })
  address: string;

  @ApiProperty({ 
    description: 'Ngày cấp',
    example: '01/01/2015'
  })
  doe: string;

  @ApiProperty({ 
    description: 'Nơi cấp',
    example: 'Cục Cảnh sát ĐKQL cư trú và DLQG về dân cư'
  })
  poi: string;
}

export class CccdRecognitionErrorDto {
  @ApiProperty({ 
    description: 'Thông báo lỗi',
    example: 'Lỗi trong quá trình xử lý ảnh CCCD'
  })
  error: string;

  @ApiProperty({ 
    description: 'Chi tiết lỗi',
    example: 'Invalid image format'
  })
  details?: string;
}