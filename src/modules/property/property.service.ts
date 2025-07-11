import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './entities/property.entity';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

@Injectable()
export class PropertyService {
  constructor(
    @InjectRepository(Property)
    private propertyRepository: Repository<Property>,
  ) {}

  async create(createPropertyDto: CreatePropertyDto): Promise<Property> {
    const property = this.propertyRepository.create(createPropertyDto);
    return this.propertyRepository.save(property);
  }

  async findAll(): Promise<Property[]> {
    return this.propertyRepository.find();
  }

  async findOne(id: number): Promise<Property | null> {
    return this.propertyRepository.findOne({ where: { id: id.toString() } });
  }

  async update(
    id: number,
    updatePropertyDto: UpdatePropertyDto,
  ): Promise<Property> {
    await this.propertyRepository.update(id, updatePropertyDto);
    const updatedProperty = await this.findOne(id);
    if (!updatedProperty) {
      throw new Error(`Property with id ${id} not found`);
    }
    return updatedProperty;
  }

  async remove(id: number): Promise<void> {
    await this.propertyRepository.delete(id);
  }
}
