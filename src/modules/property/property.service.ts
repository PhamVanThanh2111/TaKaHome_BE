import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './entities/property.entity';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';

@Injectable()
export class PropertyService {
  constructor(
    @InjectRepository(Property)
    private propertyRepository: Repository<Property>,
  ) {}

  async create(
    createPropertyDto: CreatePropertyDto,
    landlordId: string,
  ): Promise<ResponseCommon<Property>> {
    try {
      const property = this.propertyRepository.create({
        ...createPropertyDto,
        landlord: { id: landlordId },
      });
      const saved = await this.propertyRepository.save(property);
      return new ResponseCommon(200, 'SUCCESS', saved);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Error creating property: ${message}`);
    }
  }

  async findAll(): Promise<ResponseCommon<Property[]>> {
    const properties = await this.propertyRepository.find();
    return new ResponseCommon(200, 'SUCCESS', properties);
  }

  async findOne(id: number): Promise<ResponseCommon<Property | null>> {
    const property = await this.propertyRepository.findOne({
      where: { id: id.toString() },
    });
    return new ResponseCommon(200, 'SUCCESS', property);
  }

  async update(
    id: number,
    updatePropertyDto: UpdatePropertyDto,
  ): Promise<ResponseCommon<Property>> {
    await this.propertyRepository.update(id, updatePropertyDto);
    const updatedProperty = await this.propertyRepository.findOne({
      where: { id: id.toString() },
    });
    if (!updatedProperty) {
      throw new Error(`Property with id ${id} not found`);
    }
    return new ResponseCommon(200, 'SUCCESS', updatedProperty);
  }

  async remove(id: number): Promise<ResponseCommon<null>> {
    await this.propertyRepository.delete(id);
    return new ResponseCommon(200, 'SUCCESS', null);
  }
}
