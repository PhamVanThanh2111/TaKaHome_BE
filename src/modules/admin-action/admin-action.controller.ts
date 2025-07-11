import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { AdminActionService } from './admin-action.service';
import { CreateAdminActionDto } from './dto/create-admin-action.dto';
import { UpdateAdminActionDto } from './dto/update-admin-action.dto';

@Controller('admin-actions')
export class AdminActionController {
  constructor(private readonly adminActionService: AdminActionService) {}

  @Post()
  create(@Body() createAdminActionDto: CreateAdminActionDto) {
    return this.adminActionService.create(createAdminActionDto);
  }

  @Get()
  findAll() {
    return this.adminActionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminActionService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAdminActionDto: UpdateAdminActionDto,
  ) {
    return this.adminActionService.update(+id, updateAdminActionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.adminActionService.remove(+id);
  }
}
