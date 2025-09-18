import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ResponseCommon } from './common/dto/response.dto';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): ResponseCommon<string> {
    return this.appService.getHello();
  }
}
