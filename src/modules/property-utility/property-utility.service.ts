import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PropertyUtility } from './entities/property-utility.entity';
import { CreatePropertyUtilityDto } from './dto/create-property-utility.dto';
import { UpdatePropertyUtilityDto } from './dto/update-property-utility.dto';

@Injectable()
export class PropertyUtilityService {
  constructor(
    @InjectRepository(PropertyUtility)
    private propertyUtilityRepository: Repository<PropertyUtility>,
  ) {}

  async create(
    createPropertyUtilityDto: CreatePropertyUtilityDto,
  ): Promise<PropertyUtility> {
    const { propertyId, name, description } = createPropertyUtilityDto;
    const propertyUtility = this.propertyUtilityRepository.create({
      name,
      description,
      property: { id: propertyId },
    });
    return this.propertyUtilityRepository.save(propertyUtility);
  }

  async findAll(): Promise<PropertyUtility[]> {
    return this.propertyUtilityRepository.find({ relations: ['property'] });
  }

  async findOne(id: number): Promise<PropertyUtility | null> {
    return this.propertyUtilityRepository.findOne({
      where: { id: id.toString() },
      relations: ['property'],
    });
  }

  async update(
    id: number,
    updatePropertyUtilityDto: UpdatePropertyUtilityDto,
  ): Promise<PropertyUtility> {
    await this.propertyUtilityRepository.update(id, updatePropertyUtilityDto);
    const updated = await this.findOne(id);
    if (!updated) {
      throw new Error(`PropertyUtility with id ${id} not found`);
    }
    return updated;
  }

  async remove(id: number): Promise<void> {
    await this.propertyUtilityRepository.delete(id);
  }
}
