import { Controller } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

import { SmartCAService } from './smartca.service';

@ApiBearerAuth()
@Controller('smartca')
export class SmartCAController {
  constructor(private readonly smartcaService: SmartCAService) {}
}
