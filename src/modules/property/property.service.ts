import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './entities/property.entity';
import { Room } from './entities/room.entity';
import { RoomType } from './entities/room-type.entity';
import { User } from '../user/entities/user.entity';
import { CreatePropertyDto } from './dto/create-property.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { PropertyTypeEnum } from '../common/enums/property-type.enum';

@Injectable()
export class PropertyService {
  constructor(
    @InjectRepository(Property)
    private propertyRepository: Repository<Property>,
    @InjectRepository(Room)
    private roomRepository: Repository<Room>,
    @InjectRepository(RoomType)
    private roomTypeRepository: Repository<RoomType>,
  ) {}

  async create(
    createPropertyDto: CreatePropertyDto,
    landlordId: string,
  ): Promise<ResponseCommon<Property>> {
    try {
      const { rooms, roomTypes, type, ...basePropertyData } = createPropertyDto;

      // Step 1: Filter fields based on property type and create Property
      const propertyToSave = this.filterPropertyFieldsByType(
        basePropertyData,
        type,
        landlordId,
      );

      const property = this.propertyRepository.create(propertyToSave);
      const savedProperty = await this.propertyRepository.save(property);

      // Step 2: Handle BOARDING specific logic - create RoomTypes and Rooms
      if (type === PropertyTypeEnum.BOARDING && roomTypes && rooms) {
        await this.createRoomTypesAndRooms(savedProperty, roomTypes, rooms);
      }

      // Step 3: Return the complete property with relationships
      const relations =
        type === PropertyTypeEnum.BOARDING
          ? ['rooms', 'rooms.roomType', 'landlord']
          : ['landlord'];

      const result = await this.propertyRepository.findOne({
        where: { id: savedProperty.id },
        relations,
      });

      if (!result) {
        throw new Error('Failed to retrieve created property');
      }

      return new ResponseCommon(201, 'Property created successfully', result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Error creating property: ${message}`);
    }
  }

  private async createRoomTypesAndRooms(
    property: Property,
    roomTypes: CreateRoomTypeDto[],
    rooms: CreateRoomDto[],
  ): Promise<void> {
    // Step 1: Create RoomTypes first
    const roomTypeEntities = roomTypes.map((roomTypeDto) => {
      return this.roomTypeRepository.create({
        ...roomTypeDto,
      });
    });

    const savedRoomTypes = await this.roomTypeRepository.save(roomTypeEntities);

    // Step 2: Create Rooms and link them to RoomTypes
    // Logic: Each room will be linked to the corresponding RoomType by index
    // If there are multiple rooms but only one roomType, all rooms link to that roomType
    const roomEntities = rooms.map((roomDto, index) => {
      // Determine which RoomType this room should link to
      const roomTypeIndex =
        savedRoomTypes.length === 1 ? 0 : index % savedRoomTypes.length;
      const linkedRoomType = savedRoomTypes[roomTypeIndex];

      return this.roomRepository.create({
        name: roomDto.name,
        floor: roomDto.floor,
        property,
        roomType: linkedRoomType,
      });
    });

    await this.roomRepository.save(roomEntities);
  }

  private filterPropertyFieldsByType(
    propertyData: Omit<CreatePropertyDto, 'rooms' | 'roomTypes' | 'type'>,
    type: PropertyTypeEnum,
    landlordId: string,
  ): Partial<Property> {
    const baseProperty = {
      ...propertyData,
      type,
      landlord: { id: landlordId } as User,
    };

    switch (type) {
      case PropertyTypeEnum.HOUSING: {
        // HOUSING: Exclude boarding/apartment specific fields
        const {
          electricityPricePerKwh,
          waterPricePerM3,
          unit,
          block,
          ...housingData
        } = baseProperty;
        void electricityPricePerKwh;
        void waterPricePerM3;
        void unit;
        void block;
        return housingData as Partial<Property>;
      }

      case PropertyTypeEnum.APARTMENT: {
        // APARTMENT: Like HOUSING but include block, exclude unit and utility prices
        const {
          electricityPricePerKwh,
          waterPricePerM3,
          unit,
          ...apartmentData
        } = baseProperty;
        void electricityPricePerKwh;
        void waterPricePerM3;
        void unit;
        return apartmentData as Partial<Property>;
      }

      case PropertyTypeEnum.BOARDING: {
        // BOARDING: Exclude fields that will be in RoomType
        const { bedrooms, bathrooms, area, price, deposit, ...boardingData } =
          baseProperty;
        void bedrooms;
        void bathrooms;
        void area;
        void price;
        void deposit;
        return boardingData as Partial<Property>;
      }

      default:
        return baseProperty as Partial<Property>;
    }
  }

  async findAll(): Promise<ResponseCommon<Property[]>> {
    const properties = await this.propertyRepository.find({
      relations: ['rooms', 'roomTypes', 'landlord'],
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
