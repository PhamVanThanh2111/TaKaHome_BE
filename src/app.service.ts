import { Injectable } from '@nestjs/common';
import { ResponseCommon } from './common/dto/response.dto';

@Injectable()
export class AppService {
  getHello(): ResponseCommon<string> {
    return new ResponseCommon(200, 'SUCCESS', 'Hello World!');
  }
}
