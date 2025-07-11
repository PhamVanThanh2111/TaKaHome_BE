import { IsNotEmpty, IsString } from 'class-validator';

export class CreateReportDto {
  @IsNotEmpty()
  reporterId: number;

  @IsNotEmpty()
  propertyId: number;

  @IsString()
  content: string;
}
