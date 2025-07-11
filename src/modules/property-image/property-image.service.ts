import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PropertyImage } from './entities/property-image.entity';
import { CreatePropertyImageDto } from './dto/create-property-image.dto';
import { UpdatePropertyImageDto } from './dto/update-property-image.dto';

@Injectable()
export class PropertyImageService {
  constructor(
    @InjectRepository(PropertyImage)
    private propertyImageRepository: Repository<PropertyImage>,
  ) {}

  async create(
    createPropertyImageDto: CreatePropertyImageDto,
  ): Promise<PropertyImage> {
    const { propertyId, imageUrl } = createPropertyImageDto;
    const propertyImage = this.propertyImageRepository.create({
      imageUrl,
      property: { id: propertyId },
    });
    return this.propertyImageRepository.save(propertyImage);
  }

  async findAll(): Promise<PropertyImage[]> {
    return this.propertyImageRepository.find({ relations: ['property'] });
  }

  async findOne(id: number): Promise<PropertyImage | null> {
    return this.propertyImageRepository.findOne({
      where: { id },
      relations: ['property'],
    });
  }

  async update(
    id: number,
    updatePropertyImageDto: UpdatePropertyImageDto,
  ): Promise<PropertyImage> {
    await this.propertyImageRepository.update(
      id,
      updatePropertyImageDto as any,
    );
    const updated = await this.findOne(id);
    if (!updated) {
      throw new Error(`PropertyImage with id ${id} not found`);
    }
    return updated;
  }

  async remove(id: number): Promise<void> {
    await this.propertyImageRepository.delete(id);
  }
}
