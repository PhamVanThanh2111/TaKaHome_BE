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
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UserResponseDto } from './dto/user-response.dto';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { JwtUser } from '../core/auth/strategies/jwt.strategy';
import { CccdRecognitionResponseDto, CccdRecognitionErrorDto } from './dto/cccd-recognition.dto';
import { Throttle } from '@nestjs/throttler';

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
    description: 'Upload file ảnh avatar lên S3 và cập nhật avatarUrl trong database'
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
              description: 'Updated user information'
            },
            upload: {
              type: 'object',
              properties: {
                url: { type: 'string', description: 'S3 URL of uploaded avatar' },
                key: { type: 'string', description: 'S3 key of uploaded avatar' },
                size: { type: 'number', description: 'File size in bytes' }
              }
            }
          }
        }
      }
    }
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
      throw new BadRequestException('No file uploaded');
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size too large. Maximum size is 5MB');
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.',
      );
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
    description: 'Upload ảnh CCCD/CMND để trích xuất thông tin cá nhân sử dụng FPT.AI'
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
        message: { type: 'string', example: 'CCCD recognition completed successfully' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '123456789012', description: 'Số CCCD/CMND' },
            name: { type: 'string', example: 'NGUYỄN VĂN A', description: 'Họ và tên' },
            dob: { type: 'string', example: '01/01/1990', description: 'Ngày sinh' },
            sex: { type: 'string', example: 'Nam', description: 'Giới tính' },
            home: { type: 'string', example: 'Hà Nội', description: 'Quê quán' },
            address: { type: 'string', example: 'Số 1, Đường ABC, Phường XYZ, Quận DEF, Hà Nội', description: 'Nơi thường trú' },
            doe: { type: 'string', example: '01/01/2015', description: 'Ngày cấp' },
            poi: { type: 'string', example: 'Cục Cảnh sát ĐKQL cư trú và DLQG về dân cư', description: 'Nơi cấp' },
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid file type, missing file, or FPT.AI API error',
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
      throw new BadRequestException('No image file uploaded');
    }

    // Validate file size (max 10MB for CCCD images)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size too large. Maximum size is 10MB');
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG and PNG images are allowed for CCCD recognition.',
      );
    }

    return this.userService.recognizeCccd(
      file.buffer,
      file.originalname,
      user.id
    );
  }
}
