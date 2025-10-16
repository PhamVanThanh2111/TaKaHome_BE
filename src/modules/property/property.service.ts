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
import { FilterPropertyDto } from './dto/filter-property.dto';
import { PropertyTypeEnum } from '../common/enums/property-type.enum';
import { RoomTypeEntry } from './interfaces/room-type-entry.interface';
import { S3StorageService } from '../s3-storage/s3-storage.service';
import { UploadResult } from '../s3-storage/s3-storage.service';

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
    private s3: S3StorageService,
  ) {}

  /**
   * Upload heroImage and images for a Property or RoomType
   * entityType: BOARDING -> roomtypes/<entityId>/..., otherwise properties/<entityId>/...
   */
  async uploadImages(
    propertyId: string,
    entityId: string,
    entityType: PropertyTypeEnum,
    heroFile: Express.Multer.File | undefined,
    imageFiles: Express.Multer.File[] | undefined,
  ): Promise<ResponseCommon<any>> {
    // Determine base prefix
    const isBoarding = entityType === PropertyTypeEnum.BOARDING;
    const basePrefix = isBoarding ? 'roomtypes' : 'properties';

    // Validate entity exists
    if (!entityId) {
      throw new Error('entityId is required');
    }

    let heroUrl: string | undefined;
    const galleryUrls: string[] = [];

    // Upload hero file if present
    if (heroFile) {
      const ext = heroFile.originalname.split('.').pop() || 'jpg';
      const key = `${basePrefix}/${entityId}/hero/${Date.now()}_hero.${ext}`;
      const res: UploadResult = await this.s3.uploadFile(
        heroFile.buffer,
        key,
        heroFile.mimetype,
      );
      heroUrl = res.url;
    }

    // Upload gallery files
    if (imageFiles && imageFiles.length > 0) {
      for (let i = 0; i < imageFiles.length; i++) {
        const f = imageFiles[i];
        const ext = f.originalname.split('.').pop() || 'jpg';
        const key = `${basePrefix}/${entityId}/gallery/${Date.now()}_${i}.${ext}`;
        const res = await this.s3.uploadFile(f.buffer, key, f.mimetype);
        galleryUrls.push(res.url);
      }
    }

    // Persist to DB
    if (isBoarding) {
      // Update RoomType
      const roomType = await this.roomTypeRepository.findOne({
        where: { id: entityId },
      });
      if (!roomType) throw new Error('RoomType not found');
      if (heroUrl) roomType.heroImage = heroUrl;
      if (galleryUrls.length > 0)
        roomType.images = [...(roomType.images || []), ...galleryUrls];
      await this.roomTypeRepository.save(roomType);
      return new ResponseCommon(200, 'Uploaded RoomType images', roomType);
    }

    // Update Property
    const property = await this.propertyRepository.findOne({
      where: { id: entityId },
    });
    if (!property) throw new Error('Property not found');
    if (heroUrl) property.heroImage = heroUrl;
    if (galleryUrls.length > 0)
      property.images = [...(property.images || []), ...galleryUrls];
    await this.propertyRepository.save(property);

    return new ResponseCommon(200, 'Uploaded Property images', property);
  }

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
        const { electricityPricePerKwh, waterPricePerM3, ...apartmentData } =
          baseProperty;
        void electricityPricePerKwh;
        void waterPricePerM3;
        return apartmentData as Partial<Property>;
      }

      case PropertyTypeEnum.BOARDING: {
        // BOARDING: Exclude fields that will be in RoomType
        const {
          bedrooms,
          bathrooms,
          area,
          price,
          deposit,
          floor,
          ...boardingData
        } = baseProperty;
        void bedrooms;
        void bathrooms;
        void area;
        void price;
        void deposit;
        void floor;
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
            description: prop.description,
            province: prop.province,
            ward: prop.ward,
            address: prop.address,
            isApproved: prop.isApproved,
            landlord: prop.landlord
              ? {
                  id: prop.landlord.id,
                  name: prop.landlord.fullName,
                  email: prop.landlord.email,
                  phone: prop.landlord.phone,
                  isVerified: prop.landlord.isVerified,
                  avatarUrl: prop.landlord.avatarUrl,
                  status: prop.landlord.status,
                  CCCD: prop.landlord.CCCD,
                  createdAt: prop.landlord.createdAt,
                  updatedAt: prop.landlord.updatedAt,
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

  /**
   * Filter combined results (properties and roomType entries) by provided criteria
   */
  async filter(
    filterDto: Partial<FilterPropertyDto>,
  ): Promise<ResponseCommon<any>> {
    const all = (await this.findAll()).data || [];

    const filtered = all.filter((item) => {
      // For Property (HOUSING/APARTMENT) shape
      if (
        (item as Property).type &&
        (item as Property).type !== PropertyTypeEnum.BOARDING
      ) {
        const p = item as Property;
        const price = p.price ?? 0;
        const area = p.area ?? 0;
        const bdr = p.bedrooms ?? 0;
        const bath = p.bathrooms ?? 0;
        const furn = p.furnishing ?? '';

        if (filterDto.fromPrice && price < filterDto.fromPrice) {
          return false;
        }
        if (filterDto.toPrice && price > filterDto.toPrice) {
          return false;
        }
        if (filterDto.fromArea && area < filterDto.fromArea) {
          return false;
        }
        if (filterDto.toArea && area > filterDto.toArea) {
          return false;
        }
        if (filterDto.bedrooms && bdr !== filterDto.bedrooms) {
          return false;
        }
        if (filterDto.bathrooms && bath !== filterDto.bathrooms) {
          return false;
        }
        if (filterDto.furnishing && furn !== filterDto.furnishing) {
          return false;
        }

        if (
          typeof filterDto.isApproved === 'boolean' &&
          p.isApproved !== filterDto.isApproved
        ) {
          return false;
        }

        if (filterDto.province && p.province !== filterDto.province) {
          return false;
        }

        if (filterDto.ward && p.ward !== filterDto.ward) {
          return false;
        }

        if (filterDto.type && p.type !== filterDto.type) {
          return false;
        }

        if (filterDto.q) {
          const searchTerm = filterDto.q.toLowerCase();
          const title = (p.title || '').toLowerCase();
          const description = (p.description || '').toLowerCase();
          if (
            !title.includes(searchTerm) &&
            !description.includes(searchTerm)
          ) {
            return false;
          }
        }

        return true;
      }

      // For RoomTypeEntry shape
      const rt = item as RoomTypeEntry;
      const price = rt.price ?? 0;
      const area = rt.area ?? 0;
      const bdr = rt.bedrooms ?? 0;
      const bath = rt.bathrooms ?? 0;
      const furn = rt.furnishing ?? '';

      if (filterDto.fromPrice && price < filterDto.fromPrice) {
        return false;
      }
      if (filterDto.toPrice && price > filterDto.toPrice) {
        return false;
      }
      if (filterDto.fromArea && area < filterDto.fromArea) {
        return false;
      }
      if (filterDto.toArea && area > filterDto.toArea) {
        return false;
      }
      if (filterDto.bedrooms && bdr !== filterDto.bedrooms) {
        return false;
      }
      if (filterDto.bathrooms && bath !== filterDto.bathrooms) {
        return false;
      }
      if (filterDto.furnishing && furn !== filterDto.furnishing) {
        return false;
      }
      if (
        typeof filterDto.isApproved === 'boolean' &&
        rt.property &&
        rt.property.isApproved !== filterDto.isApproved
      ) {
        return false;
      }

      if (filterDto.province && rt.property?.province !== filterDto.province) {
        return false;
      }

      if (filterDto.ward && rt.property?.ward !== filterDto.ward) {
        return false;
      }

      if (filterDto.type && filterDto.type !== PropertyTypeEnum.BOARDING) {
        return false;
      }

      if (filterDto.q) {
        const searchTerm = filterDto.q.toLowerCase();
        const name = (rt.name || '').toLowerCase();
        const description = (rt.description || '').toLowerCase();
        const propertyTitle = (rt.property?.title || '').toLowerCase();
        const propertyDescription = (
          rt.property?.description || ''
        ).toLowerCase();
        if (
          !name.includes(searchTerm) &&
          !description.includes(searchTerm) &&
          !propertyTitle.includes(searchTerm) &&
          !propertyDescription.includes(searchTerm)
        ) {
          return false;
        }
      }

      return true;
    });

    // Apply sorting if specified
    const sortedData = [...filtered];
    if (filterDto.sortBy) {
      sortedData.sort((a, b) => {
        let valueA: number | Date | undefined;
        let valueB: number | Date | undefined;

        // Get values based on sortBy field
        if (filterDto.sortBy === 'price') {
          if (
            (a as Property).type &&
            (a as Property).type !== PropertyTypeEnum.BOARDING
          ) {
            valueA = (a as Property).price ?? 0;
          } else {
            valueA = (a as RoomTypeEntry).price ?? 0;
          }

          if (
            (b as Property).type &&
            (b as Property).type !== PropertyTypeEnum.BOARDING
          ) {
            valueB = (b as Property).price ?? 0;
          } else {
            valueB = (b as RoomTypeEntry).price ?? 0;
          }
        } else if (filterDto.sortBy === 'area') {
          if (
            (a as Property).type &&
            (a as Property).type !== PropertyTypeEnum.BOARDING
          ) {
            valueA = (a as Property).area ?? 0;
          } else {
            valueA = (a as RoomTypeEntry).area ?? 0;
          }

          if (
            (b as Property).type &&
            (b as Property).type !== PropertyTypeEnum.BOARDING
          ) {
            valueB = (b as Property).area ?? 0;
          } else {
            valueB = (b as RoomTypeEntry).area ?? 0;
          }
        } else if (filterDto.sortBy === 'createdAt') {
          // For Property
          if (
            (a as Property).type &&
            (a as Property).type !== PropertyTypeEnum.BOARDING
          ) {
            valueA = (a as Property).createdAt;
          } else {
            // For RoomTypeEntry - use property's createdAt
            valueA = (a as RoomTypeEntry).property?.createdAt;
          }

          if (
            (b as Property).type &&
            (b as Property).type !== PropertyTypeEnum.BOARDING
          ) {
            valueB = (b as Property).createdAt;
          } else {
            valueB = (b as RoomTypeEntry).property?.createdAt;
          }
        }

        // Convert to comparable values
        const compareA =
          valueA instanceof Date ? valueA.getTime() : (valueA ?? 0);
        const compareB =
          valueB instanceof Date ? valueB.getTime() : (valueB ?? 0);

        // Apply sort order
        const order = filterDto.sortOrder === 'desc' ? -1 : 1;

        if (compareA < compareB) return -1 * order;
        if (compareA > compareB) return 1 * order;
        return 0;
      });
    }

    // Apply pagination
    const page = filterDto.page || 1;
    const limit = filterDto.limit || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    const paginatedData = sortedData.slice(startIndex, endIndex);

    // Prepare pagination metadata
    const totalItems = sortedData.length;
    const totalPages = Math.ceil(totalItems / limit);

    const result = {
      data: paginatedData,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };

    return new ResponseCommon(200, 'SUCCESS', result);
  }

  async findAllForLandlord(
    landlordId: string,
  ): Promise<ResponseCommon<Array<Property>>> {
    const properties = await this.propertyRepository.find({
      where: { landlord: { id: landlordId } },
      relations: ['rooms', 'rooms.roomType', 'landlord'],
    });
    return new ResponseCommon(200, 'SUCCESS', properties);
  }

  async findOne(id: string): Promise<ResponseCommon<Property | null>> {
    const property = await this.propertyRepository.findOne({
      where: { id: id.toString() },
      relations: ['rooms', 'rooms.roomType', 'landlord'],
    });
    return new ResponseCommon(200, 'SUCCESS', property);
  }

  async findOneRoomType(id: string): Promise<ResponseCommon<RoomType | null>> {
    const roomType = await this.roomTypeRepository.findOne({
      where: { id: id.toString() },
      relations: ['rooms', 'rooms.property', 'rooms.property.landlord'],
    });
    return new ResponseCommon(200, 'SUCCESS', roomType);
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

  async approveProperties(propertyIds: string[]): Promise<
    ResponseCommon<{
      approvedProperties: Property[];
      failedIds: string[];
    }>
  > {
    try {
      const approvedProperties: Property[] = [];
      const failedIds: string[] = [];

      // Process each property ID
      for (const propertyId of propertyIds) {
        try {
          // Step 1: Find property with rooms relation for BOARDING type
          const property = await this.propertyRepository.findOne({
            where: { id: propertyId },
            relations: ['rooms'],
          });

          if (!property) {
            failedIds.push(propertyId);
            continue;
          }

          // Step 2: Validate if property has active bookings (only when approving)
          await this.validatePropertyBookings(property);

          // Step 3: Update property approval status and visibility
          property.isApproved = true;
          if (
            property.type === PropertyTypeEnum.HOUSING ||
            property.type === PropertyTypeEnum.APARTMENT
          ) {
            property.isVisible = false; // When approved, set visible (isVisible=false means visible)
          }

          await this.propertyRepository.save(property);

          // Step 4: For BOARDING type, update all rooms visibility
          if (property.type === PropertyTypeEnum.BOARDING && property.rooms) {
            const roomUpdatePromises = property.rooms.map((room) => {
              room.isVisible = false; // When approved, rooms become visible (isVisible=false)
              return this.roomRepository.save(room);
            });

            await Promise.all(roomUpdatePromises);
          }

          // Step 5: Get the updated property with all relations and add to approved list
          const updatedProperty = await this.propertyRepository.findOne({
            where: { id: propertyId },
            relations:
              property.type === PropertyTypeEnum.BOARDING
                ? ['rooms', 'rooms.roomType', 'landlord']
                : ['landlord'],
          });

          if (updatedProperty) {
            approvedProperties.push(updatedProperty);
          }
        } catch (error) {
          // If there's an error with this property, add it to failed list and continue
          failedIds.push(propertyId);
          console.error(`Error approving property ${propertyId}:`, error);
        }
      }

      const result = {
        approvedProperties,
        failedIds,
      };

      return new ResponseCommon(
        200,
        `Successfully approved ${approvedProperties.length} properties`,
        result,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Error approving properties: ${message}`);
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
