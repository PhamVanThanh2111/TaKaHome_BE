import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { Property } from './entities/property.entity';
import { Room } from './entities/room.entity';
import { RoomType } from './entities/room-type.entity';
import { User } from '../user/entities/user.entity';
import { Booking } from '../booking/entities/booking.entity';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { CreatePropertyDto } from './dto/create-property.dto';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { PropertyTypeEnum } from '../common/enums/property-type.enum';
import { RoomTypeEntry } from './interfaces/room-type-entry.interface';

@Injectable()
export class PropertyService {
  constructor(
    @InjectRepository(Property)
    private propertyRepository: Repository<Property>,
    @InjectRepository(Room)
    private roomRepository: Repository<Room>,
    @InjectRepository(RoomType)
    private roomTypeRepository: Repository<RoomType>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
  ) {}

  async create(
    createPropertyDto: CreatePropertyDto,
    landlordId: string,
  ): Promise<ResponseCommon<Property>> {
    try {
      const { roomTypes, type, ...basePropertyData } = createPropertyDto;

      // Step 1: Filter fields based on property type and create Property
      const propertyToSave = this.filterPropertyFieldsByType(
        basePropertyData,
        type,
        landlordId,
      );

      const property = this.propertyRepository.create(propertyToSave);
      const savedProperty = await this.propertyRepository.save(property);

      // Step 2: Handle BOARDING specific logic - create RoomTypes and Rooms
      if (type === PropertyTypeEnum.BOARDING && roomTypes) {
        await this.createRoomTypesAndRooms(savedProperty, roomTypes);
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
  ): Promise<void> {
    // Process each roomType with its embedded rooms
    for (const roomTypeDto of roomTypes) {
      // Step 1: Create RoomType (excluding rooms field)
      const { rooms, ...roomTypeData } = roomTypeDto;
      const roomTypeEntity = this.roomTypeRepository.create({
        ...roomTypeData,
      });
      const savedRoomType = await this.roomTypeRepository.save(roomTypeEntity);

      // Step 2: Create Rooms for this RoomType
      if (rooms && rooms.length > 0) {
        const roomEntities = rooms.map((roomDto) => {
          return this.roomRepository.create({
            name: roomDto.name,
            floor: roomDto.floor,
            property,
            roomType: savedRoomType,
          });
        });

        await this.roomRepository.save(roomEntities);
      }
    }
  }

  private filterPropertyFieldsByType(
    propertyData: Omit<CreatePropertyDto, 'roomTypes' | 'type'>,
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

  /**
   * Return a mixed list where HOUSING/APARTMENT properties are returned as-is
   * and BOARDING properties are expanded into their RoomType objects. Each
   * RoomType entry will include minimal parent property info under `property`.
   */
  async findAll(): Promise<ResponseCommon<Array<Property | RoomTypeEntry>>> {
    // 1) Fetch non-boarding properties (HOUSING, APARTMENT)
    const nonBoardingProps = await this.propertyRepository.find({
      where: { type: Not(PropertyTypeEnum.BOARDING) },
      relations: ['landlord'],
    });

    // 2) Fetch boarding properties with rooms and roomType relations
    const boardingProps = await this.propertyRepository.find({
      where: { type: PropertyTypeEnum.BOARDING },
      relations: ['rooms', 'rooms.roomType', 'landlord'],
    });

    // 3) From each boarding property, build RoomType entries
    const roomTypeEntries: RoomTypeEntry[] = [];
    for (const prop of boardingProps) {
      if (!prop.rooms || prop.rooms.length === 0) continue;

      // Group rooms by their roomType id
      const grouped: Record<string, { roomType: RoomType; rooms: Room[] }> = {};
      for (const room of prop.rooms) {
        if (!room.roomType) continue;
        const rtId = room.roomType.id;
        if (!grouped[rtId]) {
          grouped[rtId] = { roomType: room.roomType, rooms: [] };
        }
        grouped[rtId].rooms.push(room);
      }

      // For each group produce an entry that represents the RoomType but
      // includes the parent property minimal info and the rooms of that type
      for (const rtId of Object.keys(grouped)) {
        const { roomType, rooms } = grouped[rtId];

        const entry: RoomTypeEntry = {
          id: roomType.id,
          name: roomType.name,
          bedrooms: roomType.bedrooms,
          bathrooms: roomType.bathrooms,
          area: Number(roomType.area),
          price: Number(roomType.price),
          deposit: Number(roomType.deposit),
          furnishing: roomType.furnishing,
          images: roomType.images,
          description: roomType.description,
          heroImage: roomType.heroImage,
          rooms: rooms.map((r) => ({
            id: r.id,
            name: r.name,
            floor: r.floor,
            isVisible: r.isVisible,
          })),
          property: {
            id: prop.id,
            title: prop.title,
            province: prop.province,
            ward: prop.ward,
            address: prop.address,
            landlord: prop.landlord
              ? {
                  id: prop.landlord.id,
                  name: (prop.landlord as unknown as any).name,
                }
              : undefined,
          },
        };

        roomTypeEntries.push(entry);
      }
    }

    // 4) Combine non-boarding properties and roomType entries
    const combined: Array<Property | RoomTypeEntry> = [];
    combined.push(...nonBoardingProps);
    combined.push(...roomTypeEntries);

    return new ResponseCommon(200, 'SUCCESS', combined);
  }

  async findOne(id: string): Promise<ResponseCommon<Property | null>> {
    const property = await this.propertyRepository.findOne({
      where: { id: id.toString() },
      relations: ['rooms', 'rooms.roomType', 'landlord'],
    });
    return new ResponseCommon(200, 'SUCCESS', property);
  }

  async update(
    id: string,
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

  async remove(id: string): Promise<ResponseCommon<null>> {
    await this.propertyRepository.delete(id);
    return new ResponseCommon(200, 'SUCCESS', null);
  }

  async approveProperty(propertyId: string): Promise<ResponseCommon<Property>> {
    try {
      // Step 1: Find property with rooms relation for BOARDING type
      const property = await this.propertyRepository.findOne({
        where: { id: propertyId },
        relations: ['rooms'],
      });

      if (!property) {
        throw new Error(`Property with id ${propertyId} not found`);
      }

      // Step 1.5: Validate if property has active bookings (only when approving)
      await this.validatePropertyBookings(property);

      // Step 2: Update property approval status and visibility
      property.isApproved = true;
      if (
        property.type === PropertyTypeEnum.HOUSING ||
        property.type === PropertyTypeEnum.APARTMENT
      ) {
        property.isVisible = false; // When approved, set visible (isVisible=false means visible)
      }

      await this.propertyRepository.save(property);

      // Step 3: For BOARDING type, update all rooms visibility
      if (property.type === PropertyTypeEnum.BOARDING && property.rooms) {
        const roomUpdatePromises = property.rooms.map((room) => {
          room.isVisible = false; // When approved, rooms become visible (isVisible=false)
          return this.roomRepository.save(room);
        });

        await Promise.all(roomUpdatePromises);
      }

      // Step 4: Return updated property with relations
      const result = await this.propertyRepository.findOne({
        where: { id: propertyId },
        relations:
          property.type === PropertyTypeEnum.BOARDING
            ? ['rooms', 'rooms.roomType', 'landlord']
            : ['landlord'],
      });

      if (!result) {
        throw new Error('Failed to retrieve updated property');
      }

      return new ResponseCommon(200, 'Property approved successfully', result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Error approving property: ${message}`);
    }
  }

  /**
   * Validate if property has active bookings that would prevent approval
   * @param property Property to validate
   * @throws Error if property has active bookings
   */
  private async validatePropertyBookings(property: Property): Promise<void> {
    if (property.type === PropertyTypeEnum.BOARDING) {
      // For BOARDING: Check if any room has bookings with status != PENDING_LANDLORD
      if (property.rooms && property.rooms.length > 0) {
        const roomIds = property.rooms.map((room) => room.id);

        const activeRoomBookings = await this.bookingRepository.find({
          where: {
            room: { id: In(roomIds) },
            status: Not(BookingStatus.PENDING_LANDLORD),
          },
        });

        if (activeRoomBookings.length > 0) {
          throw new Error(
            'Property này đã từng được Approve và đang có người thuê rồi',
          );
        }
      }
    } else {
      // For HOUSING/APARTMENT: Check if property has bookings with status != PENDING_LANDLORD
      const activePropertyBookings = await this.bookingRepository.find({
        where: {
          property: { id: property.id },
          status: Not(BookingStatus.PENDING_LANDLORD),
        },
      });

      if (activePropertyBookings.length > 0) {
        throw new Error(
          'Property này đã từng được Approve và đang có người thuê rồi',
        );
      }
    }
  }
}
