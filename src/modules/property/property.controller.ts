import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { JwtUser } from '../core/auth/strategies/jwt.strategy';
import { ApprovePropertiesDto } from './dto/approve-properties.dto';
import { CreatePropertyDto } from './dto/create-property.dto';
import { FilterPropertyWithUrlDto } from './dto/filter-property-with-url.dto';
import { FilterPropertyDto } from './dto/filter-property.dto';
import { MoveRoomDto } from './dto/move-room.dto';
import { PropertyResponseDto } from './dto/property-response.dto';
import { UpdateApartmentDto } from './dto/update-apartment.dto';
import { UploadPropertyImagesDto } from './dto/upload-property-images.dto';
import { Property } from './entities/property.entity';
import { RoomType } from './entities/room-type.entity';
import { RoomTypeEntry } from './interfaces/room-type-entry.interface';
import { PropertyService } from './property.service';

@Controller('properties')
@Throttle({ default: { limit: 1000, ttl: 60000 } })
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

  @Get('filter-with-url')
  @ApiOperation({
    summary: 'Filter properties with URL for chatbot',
    description:
      'Filter properties và trả về kèm URL để truy cập, dành cho Gemini chatbot',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Trả về danh sách bất động sản với URL',
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
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  price: { type: 'number' },
                  area: { type: 'number' },
                  bedrooms: { type: 'number' },
                  bathrooms: { type: 'number' },
                  province: { type: 'string' },
                  ward: { type: 'string' },
                  address: { type: 'string' },
                  url: {
                    type: 'string',
                    description: 'URL để truy cập bất động sản',
                  },
                },
              },
            },
            total: { type: 'number' },
            message: { type: 'string' },
          },
        },
      },
    },
  })
  filterWithUrl(
    @Query() query: FilterPropertyWithUrlDto,
  ): Promise<ResponseCommon<any>> {
    return this.propertyService.filterWithUrl(query);
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 uploads/phút
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

  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 uploads/phút
  @Post(':id/legal-document')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LANDLORD', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upload legal document (sổ hồng/sổ đỏ) for property',
    description: 'Upload hình ảnh giấy tờ pháp lý của bất động sản lên S3 và lưu URL vào database',
  })
  @ApiResponse({ 
    status: HttpStatus.OK,
    description: 'Upload legal document thành công',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: { type: 'string', example: 'Legal document uploaded successfully' },
        data: {
          type: 'object',
          properties: {
            legalUrl: { type: 'string', example: 'https://s3.amazonaws.com/bucket/properties/xxx/legal/document.jpg' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Không có file hoặc property không tồn tại',
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'legalDocument', maxCount: 1 },
    ]),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        legalDocument: { 
          type: 'string', 
          format: 'binary',
          description: 'Hình ảnh giấy tờ pháp lý (sổ hồng, sổ đỏ)',
        },
      },
      required: ['legalDocument'],
    },
  })
  uploadLegalDocument(
    @Param('id') id: string,
    @UploadedFiles()
    files: {
      legalDocument?: Express.Multer.File[];
    },
  ): Promise<ResponseCommon<{ legalUrl: string }>> {
    const legalDocument = files?.legalDocument?.[0];
    return this.propertyService.uploadLegalDocument(id, legalDocument);
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

  @Patch('apartment/:id')
  @ApiOperation({
    summary: 'Cập nhật thông tin căn hộ (APARTMENT type)',
    description:
      'API riêng cho cập nhật thông tin căn hộ, chỉ cho phép các fields phù hợp với loại APARTMENT',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: PropertyResponseDto,
    description: 'Cập nhật thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Property không phải loại APARTMENT hoặc request không hợp lệ',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy property với ID này',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LANDLORD')
  updateApartment(
    @Param('id') id: string,
    @Body() updateApartmentDto: UpdateApartmentDto,
  ) {
    return this.propertyService.updateApartment(id, updateApartmentDto);
  }

  @Patch('rooms/:id/move')
  @ApiOperation({
    summary:
      'Di chuyển một Room sang RoomType khác HOẶC tạo RoomType mới (chỉ LANDLORD/ADMIN). Yêu cầu room.isVisible = true',
    description:
      'Hỗ trợ 2 chế độ: 1) Chuyển vào RoomType có sẵn (truyền targetRoomTypeId), 2) Tạo RoomType mới và chuyển Room vào đó (set createNewRoomType=true và truyền thông tin RoomType mới)',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LANDLORD')
  moveRoom(
    @Param('id') id: string,
    @Body() moveRoomDto: MoveRoomDto,
    @CurrentUser() currentUser: JwtUser,
  ) {
    return this.propertyService.moveRoomToRoomType(
      id,
      moveRoomDto,
      currentUser.id,
    );
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
