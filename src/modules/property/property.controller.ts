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
} from '@nestjs/common';
import { PropertyService } from './property.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PropertyResponseDto } from './dto/property-response.dto';
import { Query } from '@nestjs/common';
import { FilterPropertyDto } from './dto/filter-property.dto';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { JwtUser } from '../core/auth/strategies/jwt.strategy';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { Property } from './entities/property.entity';
import { RoomTypeEntry } from './interfaces/room-type-entry.interface';

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
  @ApiOperation({ summary: 'Filter danh sách bất động sản / roomtypes' })
  @ApiResponse({ status: HttpStatus.OK })
  filter(@Query() query: FilterPropertyDto): Promise<ResponseCommon<any[]>> {
    return this.propertyService.filter(query);
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

  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Duyệt property (ADMIN only)',
    description:
      'ADMIN duyệt property. Khi approve = true, property và rooms (nếu có) sẽ được hiển thị công khai',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: PropertyResponseDto,
    description: 'Duyệt property thành công',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy property',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Chỉ ADMIN mới có quyền duyệt property',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  approveProperty(@Param('id') id: string) {
    return this.propertyService.approveProperty(id);
  }
}
