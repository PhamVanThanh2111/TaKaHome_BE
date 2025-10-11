import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './entities/property.entity';
import { Floor } from './entities/floor.entity';
import { RoomType } from './entities/room-type.entity';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { PropertyTypeEnum } from '../common/enums/property-type.enum';

@Injectable()
export class PropertyService {
  constructor(
    @InjectRepository(Property)
    private propertyRepository: Repository<Property>,
    @InjectRepository(Floor)
    private floorRepository: Repository<Floor>,
    @InjectRepository(RoomType)
    private roomTypeRepository: Repository<RoomType>,
  ) {}

  async create(
    createPropertyDto: CreatePropertyDto,
    landlordId: string,
  ): Promise<ResponseCommon<Property>> {
    try {
      const { floors, roomTypes, ...propertyData } = createPropertyDto;

      // Create and save the main property first
      const property = this.propertyRepository.create({
        ...propertyData,
        landlord: { id: landlordId },
      });
      const savedProperty = await this.propertyRepository.save(property);

      // Handle floors for BOARDING type
      if (
        floors &&
        floors.length > 0 &&
        createPropertyDto.type === PropertyTypeEnum.BOARDING
      ) {
        const floorEntities = floors.map((floorDto) => {
          return this.floorRepository.create({
            ...floorDto,
            property: savedProperty,
          });
        });
        await this.floorRepository.save(floorEntities);
      }

      // Handle room types for BOARDING type
      if (
        roomTypes &&
        roomTypes.length > 0 &&
        createPropertyDto.type === PropertyTypeEnum.BOARDING
      ) {
        const roomTypeEntities = roomTypes.map((roomTypeDto) => {
          return this.roomTypeRepository.create({
            ...roomTypeDto,
            property: savedProperty,
          });
        });
        await this.roomTypeRepository.save(roomTypeEntities);
      }

      // Fetch the complete property with relationships for response
      const completeProperty = await this.propertyRepository.findOne({
        where: { id: savedProperty.id },
        relations: ['floors', 'roomTypes', 'landlord'],
      });

      return new ResponseCommon(
        200,
        'SUCCESS',
        completeProperty || savedProperty,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Error creating property: ${message}`);
    }
  }

  async findAll(): Promise<ResponseCommon<Property[]>> {
    const properties = await this.propertyRepository.find({
      relations: ['floors', 'roomTypes', 'landlord'],
    });
    return new ResponseCommon(200, 'SUCCESS', properties);
  }

  async findOne(id: number): Promise<ResponseCommon<Property | null>> {
    const property = await this.propertyRepository.findOne({
      where: { id: id.toString() },
      relations: ['floors', 'roomTypes', 'landlord'],
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
