import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { PropertyService } from './property.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { PropertyResponseDto } from './dto/property-response.dto';
import { Query } from '@nestjs/common';
import { FilterPropertyDto } from './dto/filter-property.dto';
import { UploadPropertyImagesDto } from './dto/upload-property-images.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { JwtUser } from '../core/auth/strategies/jwt.strategy';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { Property } from './entities/property.entity';
import { RoomTypeEntry } from './interfaces/room-type-entry.interface';
import { RoomType } from './entities/room-type.entity';
import { ApprovePropertiesDto } from './dto/approve-properties.dto';

@Controller('properties')
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo bất động sản mới' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: PropertyResponseDto,
    description: 'Tạo bất động sản thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Request không hợp lệ',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LANDLORD')
  create(
    @Body() createPropertyDto: CreatePropertyDto,
    @CurrentUser() currentUser: JwtUser,
  ) {
    try {
      return this.propertyService.create(createPropertyDto, currentUser.id);
    } catch (error) {
      throw new Error(`Error creating property: ${error}`);
    }
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách bất động sản' })
  @ApiResponse({ status: HttpStatus.OK })
  async findAll(): Promise<ResponseCommon<(Property | RoomTypeEntry)[]>> {
    return this.propertyService.findAll();
  }

  @Get('filter')
  @ApiOperation({
    summary:
      'Filter danh sách bất động sản / roomtypes với phân trang và sắp xếp',
    description:
      'Lọc và tìm kiếm bất động sản/roomtypes với hỗ trợ phân trang và sắp xếp theo giá, diện tích, ngày tạo',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Trả về danh sách bất động sản với thông tin phân trang',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: { type: 'string', example: 'SUCCESS' },
        data: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: { type: 'object' },
            },
            pagination: {
              type: 'object',
              properties: {
                currentPage: { type: 'number' },
                totalPages: { type: 'number' },
                totalItems: { type: 'number' },
                itemsPerPage: { type: 'number' },
                hasNextPage: { type: 'boolean' },
                hasPrevPage: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  })
  filter(@Query() query: FilterPropertyDto): Promise<ResponseCommon<any>> {
    return this.propertyService.filter(query);
  }

  @Post(':id/images')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LANDLORD', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upload hero and gallery images for property or roomtype',
  })
  @ApiResponse({ status: HttpStatus.OK })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'heroImage', maxCount: 1 },
      { name: 'images', maxCount: 20 },
    ]),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        entityType: {
          type: 'string',
          description: 'Property type: HOUSING, APARTMENT, or BOARDING',
          example: 'BOARDING',
        },
        heroImage: { type: 'string', format: 'binary' },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['entityType'],
    },
  })
  uploadImages(
    @Param('id') id: string,
    @Body() body: UploadPropertyImagesDto,
    @UploadedFiles()
    files: {
      heroImage?: Express.Multer.File[];
      images?: Express.Multer.File[];
    },
  ) {
    const entityId = id;
    const heroImage = files?.heroImage?.[0];
    const images = files?.images || [];
    return this.propertyService.uploadImages(
      id,
      entityId,
      body.entityType,
      heroImage,
      images,
    );
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LANDLORD', 'ADMIN')
  @ApiOperation({ summary: 'Lấy danh sách bất động sản của chủ nhà' })
  @ApiResponse({ status: HttpStatus.OK })
  async findAllForLandlord(
    @CurrentUser() currentUser: JwtUser,
  ): Promise<ResponseCommon<Property[]>> {
    return this.propertyService.findAllForLandlord(currentUser.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin bất động sản theo id' })
  @ApiResponse({ status: HttpStatus.OK, type: PropertyResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy bất động sản',
  })
  findOne(@Param('id') id: string) {
    return this.propertyService.findOne(id);
  }

  @Get('/roomtype/:id')
  @ApiOperation({ summary: 'Lấy thông tin roomtype theo id' })
  @ApiResponse({ status: HttpStatus.OK, type: RoomType })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy roomtype',
  })
  findOneRoomType(@Param('id') id: string) {
    return this.propertyService.findOneRoomType(id);
  }

  @Patch('approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Duyệt nhiều properties (ADMIN only)',
    description:
      'ADMIN duyệt nhiều properties. Khi approve = true, properties và rooms (nếu có) sẽ được hiển thị công khai',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Duyệt properties thành công',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: {
          type: 'string',
          example: 'Successfully approved 2 properties',
        },
        data: {
          type: 'object',
          properties: {
            approvedProperties: {
              type: 'array',
              items: { type: 'object' },
              description: 'Danh sách các property đã được duyệt',
            },
            failedIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Danh sách ID các property không thể duyệt',
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Một hoặc nhiều properties không tìm thấy',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Chỉ ADMIN mới có quyền duyệt properties',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  approveProperty(@Body() approvePropertiesDto: ApprovePropertiesDto) {
    return this.propertyService.approveProperties(
      approvePropertiesDto.propertyIds,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin bất động sản' })
  @ApiResponse({ status: HttpStatus.OK, type: PropertyResponseDto })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LANDLORD')
  update(
    @Param('id') id: string,
    @Body() updatePropertyDto: UpdatePropertyDto,
  ) {
    return this.propertyService.update(id, updatePropertyDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa bất động sản' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Xóa bất động sản thành công',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LANDLORD')
  remove(@Param('id') id: string) {
    return this.propertyService.remove(id);
  }
}
