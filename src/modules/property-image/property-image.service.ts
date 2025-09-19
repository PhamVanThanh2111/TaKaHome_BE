import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PropertyImage } from './entities/property-image.entity';
import { CreatePropertyImageDto } from './dto/create-property-image.dto';
import { UpdatePropertyImageDto } from './dto/update-property-image.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';

@Injectable()
export class PropertyImageService {
  constructor(
    @InjectRepository(PropertyImage)
    private propertyImageRepository: Repository<PropertyImage>,
  ) {}

  async create(
    createPropertyImageDto: CreatePropertyImageDto,
  ): Promise<ResponseCommon<PropertyImage>> {
    const { propertyId, imageUrl } = createPropertyImageDto;
    const propertyImage = this.propertyImageRepository.create({
      imageUrl,
      property: { id: propertyId },
    });
    const saved = await this.propertyImageRepository.save(propertyImage);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async findAll(): Promise<ResponseCommon<PropertyImage[]>> {
    const images = await this.propertyImageRepository.find({
      relations: ['property'],
    });
    return new ResponseCommon(200, 'SUCCESS', images);
  }

  async findOne(id: number): Promise<ResponseCommon<PropertyImage | null>> {
    const image = await this.propertyImageRepository.findOne({
      where: { id: id.toString() },
      relations: ['property'],
    });
    return new ResponseCommon(200, 'SUCCESS', image);
  }

  async update(
    id: number,
    updatePropertyImageDto: UpdatePropertyImageDto,
  ): Promise<ResponseCommon<PropertyImage>> {
    await this.propertyImageRepository.update(id, updatePropertyImageDto);
    const updated = await this.propertyImageRepository.findOne({
      where: { id: id.toString() },
      relations: ['property'],
    });
    if (!updated) {
      throw new Error(`PropertyImage with id ${id} not found`);
    }
    return new ResponseCommon(200, 'SUCCESS', updated);
  }

  async remove(id: number): Promise<ResponseCommon<null>> {
    await this.propertyImageRepository.delete(id);
    return new ResponseCommon(200, 'SUCCESS', null);
  }
}
