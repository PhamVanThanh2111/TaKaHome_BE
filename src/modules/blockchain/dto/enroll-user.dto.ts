import { IsString, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EnrollUserDto {
  @ApiProperty({
    description: 'User ID to enroll',
    example: '123'
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Blockchain organization name',
    example: 'OrgTenant',
    enum: ['OrgProp', 'OrgTenant', 'OrgLandlord']
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['OrgProp', 'OrgTenant', 'OrgLandlord'])
  orgName: string;

  @ApiProperty({
    description: 'User role',
    example: 'TENANT',
    enum: ['ADMIN', 'TENANT', 'LANDLORD']
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['ADMIN', 'TENANT', 'LANDLORD'])
  role: string;
}
