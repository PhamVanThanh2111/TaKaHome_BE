import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { PropertyUtilityService } from './property-utility.service';
import { CreatePropertyUtilityDto } from './dto/create-property-utility.dto';
import { UpdatePropertyUtilityDto } from './dto/update-property-utility.dto';

@Controller('property-utilities')
export class PropertyUtilityController {
  constructor(
    private readonly propertyUtilityService: PropertyUtilityService,
  ) {}

  @Post()
  create(@Body() createPropertyUtilityDto: CreatePropertyUtilityDto) {
    return this.propertyUtilityService.create(createPropertyUtilityDto);
  }

  @Get()
  findAll() {
    return this.propertyUtilityService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.propertyUtilityService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePropertyUtilityDto: UpdatePropertyUtilityDto,
  ) {
    return this.propertyUtilityService.update(+id, updatePropertyUtilityDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.propertyUtilityService.remove(+id);
  }
}
