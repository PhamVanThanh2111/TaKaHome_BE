import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PropertyUtility } from './entities/property-utility.entity';
import { CreatePropertyUtilityDto } from './dto/create-property-utility.dto';
import { UpdatePropertyUtilityDto } from './dto/update-property-utility.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';

@Injectable()
export class PropertyUtilityService {
  constructor(
    @InjectRepository(PropertyUtility)
    private propertyUtilityRepository: Repository<PropertyUtility>,
  ) {}

  async create(
    createPropertyUtilityDto: CreatePropertyUtilityDto,
  ): Promise<ResponseCommon<PropertyUtility>> {
    const { propertyId, name, description } = createPropertyUtilityDto;
    const propertyUtility = this.propertyUtilityRepository.create({
      name,
      description,
      property: { id: propertyId },
    });
    const saved = await this.propertyUtilityRepository.save(propertyUtility);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async findAll(): Promise<ResponseCommon<PropertyUtility[]>> {
    const utilities = await this.propertyUtilityRepository.find({
      relations: ['property'],
    });
    return new ResponseCommon(200, 'SUCCESS', utilities);
  }

  async findOne(id: number): Promise<ResponseCommon<PropertyUtility | null>> {
    const utility = await this.propertyUtilityRepository.findOne({
      where: { id: id.toString() },
      relations: ['property'],
    });
    return new ResponseCommon(200, 'SUCCESS', utility);
  }

  async update(
    id: number,
    updatePropertyUtilityDto: UpdatePropertyUtilityDto,
  ): Promise<ResponseCommon<PropertyUtility>> {
    await this.propertyUtilityRepository.update(id, updatePropertyUtilityDto);
    const updated = await this.propertyUtilityRepository.findOne({
      where: { id: id.toString() },
      relations: ['property'],
    });
    if (!updated) {
      throw new Error(`PropertyUtility with id ${id} not found`);
    }
    return new ResponseCommon(200, 'SUCCESS', updated);
  }

  async remove(id: number): Promise<ResponseCommon<null>> {
    await this.propertyUtilityRepository.delete(id);
    return new ResponseCommon(200, 'SUCCESS', null);
  }
}
