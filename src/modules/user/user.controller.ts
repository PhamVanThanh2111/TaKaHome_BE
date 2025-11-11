import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UploadedFiles,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { UserResponseDto } from './dto/user-response.dto';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import {
  FileInterceptor,
  FileFieldsInterceptor,
} from '@nestjs/platform-express';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { JwtUser } from '../core/auth/strategies/jwt.strategy';
import {
  CccdRecognitionResponseDto,
  CccdRecognitionErrorDto,
} from './dto/cccd-recognition.dto';
import {
  FaceVerificationResponseDto,
  FaceVerificationErrorDto,
} from './dto/face-verification.dto';
import { Throttle } from '@nestjs/throttler';
import { USER_ERRORS } from 'src/common/constants/error-messages.constant';

@Controller('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách user' })
  @ApiResponse({ status: HttpStatus.OK, type: [UserResponseDto] })
  @Roles('ADMIN')
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin user theo id' })
  @ApiResponse({ status: HttpStatus.OK, type: UserResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy user',
  })
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin user' })
  @ApiResponse({ status: HttpStatus.OK, type: UserResponseDto })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa user' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Xóa user thành công',
  })
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }

  @Throttle({ upload: {} })
  @Post('upload-avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiOperation({
    summary: 'Upload avatar cho user hiện tại',
    description:
      'Upload file ảnh avatar lên S3 và cập nhật avatarUrl trong database',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Avatar image file',
    schema: {
      type: 'object',
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'Avatar image file (JPEG, PNG, GIF, WebP)',
        },
      },
      required: ['avatar'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Avatar uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: { type: 'string', example: 'Avatar uploaded successfully' },
        data: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              description: 'Updated user information',
            },
            upload: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'S3 URL of uploaded avatar',
                },
                key: {
                  type: 'string',
                  description: 'S3 key of uploaded avatar',
                },
                size: { type: 'number', description: 'File size in bytes' },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid file type or missing file',
  })
  async uploadAvatar(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(USER_ERRORS.NO_FILE_UPLOADED);
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException(USER_ERRORS.FILE_SIZE_TOO_LARGE);
    }

    // Validate file type
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(USER_ERRORS.INVALID_FILE_TYPE);
    }

    return this.userService.uploadAvatar(
      user.id,
      file.buffer,
      file.originalname,
      file.mimetype,
    );
  }

  @Throttle({ verification: {} })
  @Post('recognize-cccd')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({
    summary: 'Quét thông tin từ ảnh CCCD/CMND',
    description:
      'Upload ảnh CCCD/CMND để trích xuất thông tin cá nhân sử dụng FPT.AI',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'CCCD/CMND image file',
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'CCCD/CMND image file (JPEG, PNG)',
        },
      },
      required: ['image'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'CCCD recognition completed successfully',
    type: CccdRecognitionResponseDto,
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: {
          type: 'string',
          example: 'CCCD recognition completed successfully',
        },
        data: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: '123456789012',
              description: 'Số CCCD/CMND',
            },
            name: {
              type: 'string',
              example: 'NGUYỄN VĂN A',
              description: 'Họ và tên',
            },
            dob: {
              type: 'string',
              example: '01/01/1990',
              description: 'Ngày sinh',
            },
            sex: { type: 'string', example: 'Nam', description: 'Giới tính' },
            home: {
              type: 'string',
              example: 'Hà Nội',
              description: 'Quê quán',
            },
            address: {
              type: 'string',
              example: 'Số 1, Đường ABC, Phường XYZ, Quận DEF, Hà Nội',
              description: 'Nơi thường trú',
            },
            doe: {
              type: 'string',
              example: '01/01/2015',
              description: 'Ngày cấp',
            },
            poi: {
              type: 'string',
              example: 'Cục Cảnh sát ĐKQL cư trú và DLQG về dân cư',
              description: 'Nơi cấp',
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - Invalid file type, missing file, or FPT.AI API error',
    type: CccdRecognitionErrorDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error during CCCD recognition',
  })
  async recognizeCccd(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtUser,
  ) {
    if (!file) {
      throw new BadRequestException(USER_ERRORS.NO_IMAGE_UPLOADED);
    }

    // Validate file size (max 10MB for CCCD images)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException(USER_ERRORS.FILE_SIZE_TOO_LARGE);
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(USER_ERRORS.INVALID_IMAGE_TYPE);
    }

    return this.userService.recognizeCccd(
      file.buffer,
      file.originalname,
      user.id,
    );
  }

  @Throttle({ verification: {} })
  @Post('verify-face-with-cccd')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'faceImage', maxCount: 1 },
      { name: 'cccdImage', maxCount: 1 },
    ]),
  )
  @ApiOperation({
    summary: 'Xác thực gương mặt với CCCD',
    description:
      'Upload ảnh gương mặt và ảnh CCCD để xác thực. Hệ thống sẽ:\n' +
      '1. Trích xuất thông tin từ ảnh CCCD\n' +
      '2. So sánh gương mặt trong 2 ảnh\n' +
      '3. Cập nhật trạng thái xác thực nếu thành công (độ giống >= 80%)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Face image and CCCD image files',
    schema: {
      type: 'object',
      properties: {
        faceImage: {
          type: 'string',
          format: 'binary',
          description: 'Ảnh gương mặt của người dùng (JPEG, PNG)',
        },
        cccdImage: {
          type: 'string',
          format: 'binary',
          description: 'Ảnh CCCD/CMND (JPEG, PNG)',
        },
      },
      required: ['faceImage', 'cccdImage'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Face verification with CCCD completed successfully',
    type: FaceVerificationResponseDto,
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: {
          type: 'string',
          example: 'Xác thực gương mặt và CCCD thành công',
        },
        data: {
          type: 'object',
          properties: {
            isMatch: {
              type: 'boolean',
              example: true,
              description: 'Hai ảnh có cùng 1 người hay không (ngưỡng 80%)',
            },
            similarity: {
              type: 'number',
              example: 85.5,
              description: 'Độ giống nhau của 2 ảnh (%)',
            },
            isBothImgIDCard: {
              type: 'boolean',
              example: false,
              description: 'Cả 2 ảnh có phải là ảnh CMND/CCCD không',
            },
            cccdInfo: {
              type: 'object',
              description: 'Thông tin CCCD đã được trích xuất',
              properties: {
                id: { type: 'string', example: '123456789012' },
                name: { type: 'string', example: 'NGUYỄN VĂN A' },
                dob: { type: 'string', example: '01/01/1990' },
                sex: { type: 'string', example: 'Nam' },
                home: { type: 'string', example: 'Hà Nội' },
                address: {
                  type: 'string',
                  example: 'Số 1, Đường ABC, Phường XYZ',
                },
                doe: { type: 'string', example: '01/01/2015' },
                poi: {
                  type: 'string',
                  example: 'Cục Cảnh sát ĐKQL cư trú và DLQG về dân cư',
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - Invalid file, face not matching, or FPT.AI API error',
    type: FaceVerificationErrorDto,
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example:
            'Khuôn mặt không khớp với ảnh CCCD. Độ giống nhau: 65.25% (yêu cầu >= 80%)',
          description:
            'Chi tiết lỗi: 407 - Không nhận dạng được khuôn mặt, 408 - Ảnh không đúng định dạng, 409 - Số lượng khuôn mặt không hợp lệ',
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error during face verification',
  })
  async verifyFaceWithCccd(
    @UploadedFiles()
    files: {
      faceImage?: Express.Multer.File[];
      cccdImage?: Express.Multer.File[];
    },
    @CurrentUser() user: JwtUser,
  ) {
    // Validate both files are uploaded
    if (!files?.faceImage?.[0]) {
      throw new BadRequestException('Ảnh gương mặt không được tải lên');
    }

    if (!files?.cccdImage?.[0]) {
      throw new BadRequestException('Ảnh CCCD không được tải lên');
    }

    const faceImage = files.faceImage[0];
    const cccdImage = files.cccdImage[0];

    // Validate file sizes (max 10MB each)
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (faceImage.size > maxSize) {
      throw new BadRequestException(
        'Kích thước ảnh gương mặt quá lớn. Tối đa 10MB',
      );
    }

    if (cccdImage.size > maxSize) {
      throw new BadRequestException('Kích thước ảnh CCCD quá lớn. Tối đa 10MB');
    }

    // Validate file types
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];

    if (!allowedMimeTypes.includes(faceImage.mimetype)) {
      throw new BadRequestException(
        'Định dạng ảnh gương mặt không hợp lệ. Chỉ chấp nhận JPEG và PNG.',
      );
    }

    if (!allowedMimeTypes.includes(cccdImage.mimetype)) {
      throw new BadRequestException(
        'Định dạng ảnh CCCD không hợp lệ. Chỉ chấp nhận JPEG và PNG.',
      );
    }

    return this.userService.verifyFaceWithCccd(
      faceImage.buffer,
      cccdImage.buffer,
      faceImage.originalname,
      cccdImage.originalname,
      user.id,
    );
  }
}
