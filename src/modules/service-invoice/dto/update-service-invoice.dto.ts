import { PartialType } from '@nestjs/swagger';
import { CreateServiceInvoiceDto } from './create-service-invoice.dto';

export class UpdateServiceInvoiceDto extends PartialType(CreateServiceInvoiceDto) {}