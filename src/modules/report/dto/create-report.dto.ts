import { IsNotEmpty, IsString } from 'class-validator';

export class CreateReportDto {
  @IsNotEmpty()
  reporterId: string;

  @IsNotEmpty()
  propertyId: string;

  @IsString()
  content: string;
}
