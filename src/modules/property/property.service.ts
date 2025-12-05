import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { In, Not, Repository, SelectQueryBuilder } from 'typeorm';
import { Booking } from '../booking/entities/booking.entity';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { PropertyTypeEnum } from '../common/enums/property-type.enum';
import {
  S3StorageService,
  UploadResult,
} from '../s3-storage/s3-storage.service';
import { User } from '../user/entities/user.entity';
import { CreatePropertyDto } from './dto/create-property.dto';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { FilterPropertyWithUrlDto } from './dto/filter-property-with-url.dto';
import { FilterPropertyDto } from './dto/filter-property.dto';
import { UpdateApartmentDto } from './dto/update-apartment.dto';
import { Property } from './entities/property.entity';
import { RoomType } from './entities/room-type.entity';
import { Room } from './entities/room.entity';
import { PropertyOrRoomTypeWithUrl } from './interfaces/property-with-url.interface';
import { RoomTypeEntry } from './interfaces/room-type-entry.interface';
import { PROPERTY_ERRORS } from 'src/common/constants/error-messages.constant';

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
    private configService: ConfigService,
  ) {}

  /**
   * Upload legal document for a Property
   */
  async uploadLegalDocument(
    propertyId: string,
    legalFile: Express.Multer.File | undefined,
  ): Promise<ResponseCommon<{ legalUrl: string }>> {
    // Validate legal file is provided first
    if (!legalFile) {
      throw new BadRequestException('Legal document file is required');
    }

    // Validate property exists
    if (!propertyId) {
      throw new BadRequestException(PROPERTY_ERRORS.PROPERTY_NOT_FOUND);
    }

    const property = await this.propertyRepository.findOne({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException(PROPERTY_ERRORS.PROPERTY_NOT_FOUND);
    }

    // Upload to S3
    const ext = legalFile.originalname.split('.').pop() || 'jpg';
    const key = `properties/${propertyId}/legal/${Date.now()}_legal.${ext}`;
    const res: UploadResult = await this.s3.uploadFile(
      legalFile.buffer,
      key,
      legalFile.mimetype,
    );

    // Update property with legal URL
    property.legalUrl = res.url;
    await this.propertyRepository.save(property);

    return new ResponseCommon(200, 'Legal document uploaded successfully', {
      legalUrl: res.url,
    });
  }

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
      throw new BadRequestException(PROPERTY_ERRORS.ENTITY_ID_REQUIRED);
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
      if (!roomType) throw new NotFoundException(PROPERTY_ERRORS.ROOM_TYPE_NOT_FOUND);
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
    if (!property) throw new NotFoundException(PROPERTY_ERRORS.PROPERTY_NOT_FOUND);
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
        throw new NotFoundException(PROPERTY_ERRORS.PROPERTY_CREATE_FAILED);
      }

      return new ResponseCommon(201, 'Property created successfully', result);
    } catch {
      throw new BadRequestException(PROPERTY_ERRORS.PROPERTY_CREATE_FAILED);
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
   * Optimized: Uses query builder based on type filter
   */
  async filter(
    filterDto: Partial<FilterPropertyDto>,
  ): Promise<ResponseCommon<any>> {
    const { page = 1, limit = 10, sortBy, sortOrder = 'asc', ...filters } = filterDto;

    let nonBoardingProps: Property[] = [];
    let boardingProps: Property[] = [];

    // Determine which query to execute based on filters.type
    if (!filters.type || filters.type === PropertyTypeEnum.BOARDING) {
      // Query boarding properties (will be transformed to RoomTypeEntry)
      const boardingQB = this.propertyRepository
        .createQueryBuilder('property')
        .leftJoinAndSelect('property.rooms', 'rooms')
        .leftJoinAndSelect('rooms.roomType', 'roomType')
        .leftJoinAndSelect('property.landlord', 'landlord')
        .where('property.type = :boardingType', { 
          boardingType: PropertyTypeEnum.BOARDING 
        });

      // Apply filters for boarding properties (RoomType level)
      this.applyBoardingFilters(boardingQB, filters);

      boardingProps = await boardingQB.getMany();
    }

    if (!filters.type || filters.type !== PropertyTypeEnum.BOARDING) {
      // Query non-boarding properties (HOUSING, APARTMENT)
      const nonBoardingQB = this.propertyRepository
        .createQueryBuilder('property')
        .leftJoinAndSelect('property.landlord', 'landlord')
        .where('property.type != :boardingType', { 
          boardingType: PropertyTypeEnum.BOARDING 
        });

      // Apply filters for non-boarding properties
      this.applyPropertyFilters(nonBoardingQB, filters);

      nonBoardingProps = await nonBoardingQB.getMany();
    }

    // Determine which data to use based on type
    let dataToProcess: Array<Property | RoomTypeEntry>;
    
    if (filters.type === PropertyTypeEnum.BOARDING) {
      // For BOARDING
      const roomTypeEntries = this.transformBoardingToRoomTypes(boardingProps, filters);
      dataToProcess = roomTypeEntries;
    } else {
      // For HOUSING/APARTMENT 
      dataToProcess = nonBoardingProps;
    }

    // Apply sorting
    dataToProcess = this.applySorting(dataToProcess, sortBy, sortOrder);

    // Apply pagination
    const totalItems = dataToProcess.length;
    const totalPages = Math.ceil(totalItems / limit);
    const startIndex = (page - 1) * limit;
    const paginatedData = dataToProcess.slice(startIndex, startIndex + limit);

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
      where: { id: id },
      relations: ['rooms', 'rooms.roomType', 'landlord'],
    });
    return new ResponseCommon(200, 'SUCCESS', property);
  }

  async findOneRoomType(id: string): Promise<ResponseCommon<RoomType | null>> {
    const roomType = await this.roomTypeRepository.findOne({
      where: { id: id },
      relations: ['rooms', 'rooms.property', 'rooms.property.landlord'],
    });
    return new ResponseCommon(200, 'SUCCESS', roomType);
  }

  /**
   * Move a Room to another RoomType OR create a new RoomType and move the room into it.
   * Supports two modes:
   * 1. Move to existing RoomType: provide targetRoomTypeId
   * 2. Create new RoomType and move: set createNewRoomType=true and provide new RoomType data
   *
   * Conditions:
   * - room must exist
   * - room.isVisible must be false (hidden)
   * - room must belong to a BOARDING property
   * - caller must be the property's landlord (ownership)
   * - if moving to existing RoomType: target RoomType must belong to the same property
   */
  async moveRoomToRoomType(
    roomId: string,
    moveRoomDto: {
      targetRoomTypeId?: string;
      createNewRoomType?: boolean;
      newRoomTypeName?: string;
      newRoomTypeDescription?: string;
      newRoomTypeBedrooms?: number;
      newRoomTypeBathrooms?: number;
      newRoomTypeArea?: number;
      newRoomTypePrice?: number;
      newRoomTypeDeposit?: number;
      newRoomTypeFurnishing?: string;
    },
    currentUserId: string,
  ): Promise<ResponseCommon<Room>> {
    try {
      // Load room with its property and landlord
      const room = await this.roomRepository.findOne({
        where: { id: roomId },
        relations: ['roomType', 'property', 'property.landlord'],
      });

      if (!room) {
        throw new NotFoundException(PROPERTY_ERRORS.ROOM_NOT_FOUND);
      }

      if (room.isVisible === false) {
        throw new BadRequestException(PROPERTY_ERRORS.ROOM_NOT_OWNED_BY_USER);
      }

      const property = await this.propertyRepository.findOne({
        where: { id: room.property.id },
        relations: ['rooms', 'rooms.roomType', 'landlord'],
      });

      if (!property) {
        throw new NotFoundException(PROPERTY_ERRORS.PARENT_PROPERTY_NOT_FOUND);
      }

      // Check if property is BOARDING type
      if (property.type !== PropertyTypeEnum.BOARDING) {
        throw new BadRequestException(PROPERTY_ERRORS.PROPERTY_NOT_OWNED_BY_USER);
      }

      // Ownership check (landlord must be the caller)
      if (property.landlord && property.landlord.id !== currentUserId) {
        throw new ForbiddenException(PROPERTY_ERRORS.FORBIDDEN_NOT_OWNER);
      }

      let targetRoomType: RoomType;

      // Mode 1: Create new RoomType
      if (moveRoomDto.createNewRoomType === true) {
        // Validate required fields for new RoomType
        if (
          !moveRoomDto.newRoomTypeName ||
          moveRoomDto.newRoomTypeBedrooms === undefined ||
          moveRoomDto.newRoomTypeBathrooms === undefined ||
          moveRoomDto.newRoomTypeArea === undefined ||
          moveRoomDto.newRoomTypePrice === undefined ||
          moveRoomDto.newRoomTypeDeposit === undefined ||
          !moveRoomDto.newRoomTypeFurnishing
        ) {
          throw new BadRequestException(
            PROPERTY_ERRORS.ROOM_TYPE_REQUIRED_FIELDS_MISSING,
          );
        }

        // Create new RoomType
        const newRoomType = this.roomTypeRepository.create({
          name: moveRoomDto.newRoomTypeName,
          description: moveRoomDto.newRoomTypeDescription,
          bedrooms: moveRoomDto.newRoomTypeBedrooms,
          bathrooms: moveRoomDto.newRoomTypeBathrooms,
          area: moveRoomDto.newRoomTypeArea,
          price: moveRoomDto.newRoomTypePrice,
          deposit: moveRoomDto.newRoomTypeDeposit,
          furnishing: moveRoomDto.newRoomTypeFurnishing,
          images: [],
          heroImage: '',
        });

        targetRoomType = await this.roomTypeRepository.save(newRoomType);
      }
      // Mode 2: Move to existing RoomType
      else {
        if (!moveRoomDto.targetRoomTypeId) {
          throw new BadRequestException(
            PROPERTY_ERRORS.TARGET_ROOM_TYPE_ID_REQUIRED,
          );
        }

        // Load target RoomType and ensure it belongs to the same property
        const existingRoomType = await this.roomTypeRepository.findOne({
          where: { id: moveRoomDto.targetRoomTypeId },
          relations: ['rooms', 'rooms.property'],
        });

        if (!existingRoomType) {
          throw new NotFoundException(PROPERTY_ERRORS.TARGET_ROOM_TYPE_NOT_FOUND);
        }

        // Determine if targetRoomType is associated with the same property by
        // checking existing rooms of the property or rooms under the targetRoomType
        const targetBelongsToProperty =
          (property.rooms || []).some(
            (r) => r.roomType && r.roomType.id === moveRoomDto.targetRoomTypeId,
          ) ||
          (existingRoomType.rooms || []).some(
            (r) => r.property && r.property.id === property.id,
          );

        if (!targetBelongsToProperty) {
          throw new BadRequestException(
            PROPERTY_ERRORS.TARGET_ROOM_TYPE_NOT_IN_PROPERTY,
          );
        }

        targetRoomType = existingRoomType;
      }

      // Store old RoomType before moving
      const oldRoomType = room.roomType;
      const oldRoomTypeId = oldRoomType?.id;

      // Perform move
      room.roomType = targetRoomType;
      await this.roomRepository.save(room);

      // Check if old RoomType should be deleted (if no rooms depend on it anymore)
      if (oldRoomTypeId && oldRoomTypeId !== targetRoomType.id) {
        // Count remaining rooms using this old RoomType
        const remainingRooms = await this.roomRepository.count({
          where: { roomType: { id: oldRoomTypeId } },
        });

        // If no rooms depend on old RoomType, delete it
        if (remainingRooms === 0) {
          await this.roomTypeRepository.delete(oldRoomTypeId);
          console.log(
            `Deleted RoomType ${oldRoomTypeId} as no rooms depend on it anymore`,
          );
        }
      }

      const result = await this.roomRepository.findOne({
        where: { id: roomId },
        relations: ['roomType', 'property'],
      });

      const message = moveRoomDto.createNewRoomType
        ? 'Room moved to new RoomType successfully'
        : 'Room moved successfully';

      return new ResponseCommon(200, message, result as Room);
    } catch {
      throw new BadRequestException(PROPERTY_ERRORS.ROOM_MOVE_FAILED);
    }
  }

  /**
   * Cập nhật thông tin căn hộ (APARTMENT type)
   * Chỉ cho phép cập nhật các fields phù hợp cho loại APARTMENT
   * @param id - ID của căn hộ
   * @param updateApartmentDto - DTO chứa thông tin cập nhật
   * @returns Căn hộ sau khi cập nhật
   */
  async updateApartment(
    id: string,
    updateApartmentDto: UpdateApartmentDto,
  ): Promise<ResponseCommon<Property>> {
    try {
      // Bước 1: Tìm property hiện tại
      const property = await this.propertyRepository.findOne({
        where: { id: id },
        relations: ['landlord'],
      });

      if (!property) {
        throw new NotFoundException(PROPERTY_ERRORS.PROPERTY_NOT_FOUND);
      }

      // Bước 2: Kiểm tra xem property có phải loại APARTMENT không
      if (property.type !== PropertyTypeEnum.APARTMENT) {
        throw new BadRequestException(PROPERTY_ERRORS.PROPERTY_NOT_OWNED_BY_USER);
      }

      // Bước 2.5: Kiểm tra xem property đang hiển thị (isVisible = true) không
      if (property.isVisible === false) {
        throw new BadRequestException(PROPERTY_ERRORS.ROOM_NOT_OWNED_BY_USER);
      }

      // Bước 3: Cập nhật các fields được phép cho loại APARTMENT
      const allowedFields: (keyof UpdateApartmentDto)[] = [
        'title',
        'description',
        'province',
        'ward',
        'address',
        'block',
        'unit',
        'area',
        'bedrooms',
        'bathrooms',
        'price',
        'deposit',
        'furnishing',
        'legalDoc',
        'heroImage',
        'images',
      ];

      // Lọc và cập nhật chỉ các fields được phép
      allowedFields.forEach((field) => {
        if (updateApartmentDto[field] !== undefined) {
          (property as Record<string, any>)[field] = updateApartmentDto[field];
        }
      });

      // Bước 4: Lưu property đã cập nhật
      await this.propertyRepository.save(property);

      // Bước 5: Tải lại với relations đầy đủ
      const result = await this.propertyRepository.findOne({
        where: { id: id },
        relations: ['landlord'],
      });

      if (!result) {
        throw new NotFoundException(PROPERTY_ERRORS.PROPERTY_UPDATE_FAILED);
      }

      return new ResponseCommon(200, 'Apartment updated successfully', result);
    } catch {
      throw new BadRequestException(PROPERTY_ERRORS.PROPERTY_UPDATE_FAILED);
    }
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
        throw new NotFoundException(PROPERTY_ERRORS.PROPERTY_NOT_FOUND);
      }

      // Step 1.5: Validate if property has active bookings (only when approving)
      await this.validatePropertyBookings(property);

      // Step 2: Update property approval status and visibility
      property.isApproved = true;
      if (
        property.type === PropertyTypeEnum.HOUSING ||
        property.type === PropertyTypeEnum.APARTMENT
      ) {
        property.isVisible = true; // When approved, set visible (isVisible=true means visible)
      }

      await this.propertyRepository.save(property);

      // Step 3: For BOARDING type, update all rooms visibility
      if (property.type === PropertyTypeEnum.BOARDING && property.rooms) {
        const roomUpdatePromises = property.rooms.map((room) => {
          room.isVisible = true; // When approved, rooms become visible (isVisible=true)
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
        throw new NotFoundException(PROPERTY_ERRORS.PROPERTY_APPROVE_FAILED);
      }

      return new ResponseCommon(200, 'Property approved successfully', result);
    } catch {
      throw new BadRequestException(PROPERTY_ERRORS.PROPERTY_APPROVE_FAILED);
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
            property.isVisible = true; // When approved, set visible (isVisible=true means visible)
          }

          await this.propertyRepository.save(property);

          // Step 4: For BOARDING type, update all rooms visibility
          if (property.type === PropertyTypeEnum.BOARDING && property.rooms) {
            const roomUpdatePromises = property.rooms.map((room) => {
              room.isVisible = true; // When approved, rooms become visible (isVisible=true)
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
    } catch {
      throw new BadRequestException(PROPERTY_ERRORS.PROPERTIES_APPROVE_FAILED);
    }
  }

  /**
   * Filter properties with URL for Gemini chatbot
   * Optimized: Uses query builder instead of loading all data
   */
  async filterWithUrl(
    filterDto: Partial<FilterPropertyWithUrlDto>,
  ): Promise<ResponseCommon<any>> {
    const { limit = 10, sortBy, sortOrder = 'asc', ...filters } = filterDto;
    const frontendUrl = this.configService.get<string>('frontend.url');

    // Query non-boarding properties (HOUSING, APARTMENT) - only approved and visible
    const nonBoardingQB = this.propertyRepository
      .createQueryBuilder('property')
      .leftJoinAndSelect('property.landlord', 'landlord')
      .where('property.type != :boardingType', { 
        boardingType: PropertyTypeEnum.BOARDING 
      })
      .andWhere('property.isApproved = :isApproved', { isApproved: true })
      .andWhere('property.isVisible = :isVisible', { isVisible: true });

    // Apply filters for non-boarding properties
    this.applyPropertyFilters(nonBoardingQB, filters);

    // Query boarding properties (will be transformed to RoomTypeEntry) - only approved
    const boardingQB = this.propertyRepository
      .createQueryBuilder('property')
      .leftJoinAndSelect('property.rooms', 'rooms')
      .leftJoinAndSelect('rooms.roomType', 'roomType')
      .leftJoinAndSelect('property.landlord', 'landlord')
      .where('property.type = :boardingType', { 
        boardingType: PropertyTypeEnum.BOARDING 
      })
      .andWhere('property.isApproved = :isApproved', { isApproved: true });

    // Apply filters for boarding properties (RoomType level)
    this.applyBoardingFilters(boardingQB, filters);

    // Execute queries in parallel
    const [nonBoardingProps, boardingProps] = await Promise.all([
      nonBoardingQB.getMany(),
      boardingQB.getMany(),
    ]);

    // Transform boarding properties to RoomTypeEntry format
    const roomTypeEntries = this.transformBoardingToRoomTypes(boardingProps, filters);

    // Combine results
    let combined: Array<Property | RoomTypeEntry> = [
      ...nonBoardingProps,
      ...roomTypeEntries,
    ];

    // Apply sorting
    combined = this.applySorting(combined, sortBy, sortOrder);

    // Apply limit
    const limitedData = combined.slice(0, limit);

    // Add URL to each item
    const dataWithUrl: PropertyOrRoomTypeWithUrl[] = limitedData.map((item) => {
      if (
        (item as Property).type &&
        (item as Property).type !== PropertyTypeEnum.BOARDING
      ) {
        // For Property (HOUSING/APARTMENT)
        const property = item as Property;
        const url = `${frontendUrl}/properties/${property.id}`;
        return {
          ...property,
          url,
        };
      } else {
        // For RoomType
        const roomType = item as RoomTypeEntry;
        const url = `${frontendUrl}/properties/${roomType.id}?type=boarding`;
        return {
          ...roomType,
          url,
        };
      }
    });

    const result = {
      data: dataWithUrl,
      total: dataWithUrl.length,
      message:
        dataWithUrl.length > 0
          ? `Tìm thấy ${dataWithUrl.length} bất động sản phù hợp`
          : 'Không tìm thấy bất động sản nào phù hợp với tiêu chí tìm kiếm',
    };

    return new ResponseCommon(200, 'SUCCESS', result);
  }

  /**
   * Apply filters for non-boarding properties (HOUSING, APARTMENT)
   */
  private applyPropertyFilters(
    qb: SelectQueryBuilder<Property>,
    filters: Partial<FilterPropertyDto | FilterPropertyWithUrlDto>,
  ): void {
    if (filters.fromPrice !== undefined) {
      qb.andWhere('property.price >= :fromPrice', { fromPrice: filters.fromPrice });
    }
    if (filters.toPrice !== undefined) {
      qb.andWhere('property.price <= :toPrice', { toPrice: filters.toPrice });
    }
    if (filters.fromArea !== undefined) {
      qb.andWhere('property.area >= :fromArea', { fromArea: filters.fromArea });
    }
    if (filters.toArea !== undefined) {
      qb.andWhere('property.area <= :toArea', { toArea: filters.toArea });
    }
    if (filters.bedrooms !== undefined) {
      qb.andWhere('property.bedrooms = :bedrooms', { bedrooms: filters.bedrooms });
    }
    if (filters.bathrooms !== undefined) {
      qb.andWhere('property.bathrooms = :bathrooms', { bathrooms: filters.bathrooms });
    }
    if (filters.furnishing) {
      qb.andWhere('property.furnishing = :furnishing', { furnishing: filters.furnishing });
    }
    if (filters.province) {
      qb.andWhere('property.province = :province', { province: filters.province });
    }
    if (filters.ward) {
      qb.andWhere('property.ward = :ward', { ward: filters.ward });
    }
    if (filters.type) {
      qb.andWhere('property.type = :type', { type: filters.type });
    }
    if ('isApproved' in filters && typeof filters.isApproved === 'boolean') {
      qb.andWhere('property.isApproved = :isApproved', { isApproved: filters.isApproved });
    }
    if (filters.q) {
      qb.andWhere(
        '(LOWER(property.title) LIKE :search OR LOWER(property.description) LIKE :search)',
        { search: `%${filters.q.toLowerCase()}%` },
      );
    }
  }

  /**
   * Apply filters for boarding properties (at RoomType level)
   */
  private applyBoardingFilters(
    qb: SelectQueryBuilder<Property>,
    filters: Partial<FilterPropertyDto | FilterPropertyWithUrlDto>,
  ): void {
    if (filters.fromPrice !== undefined) {
      qb.andWhere('roomType.price >= :fromPrice', { fromPrice: filters.fromPrice });
    }
    if (filters.toPrice !== undefined) {
      qb.andWhere('roomType.price <= :toPrice', { toPrice: filters.toPrice });
    }
    if (filters.fromArea !== undefined) {
      qb.andWhere('roomType.area >= :fromArea', { fromArea: filters.fromArea });
    }
    if (filters.toArea !== undefined) {
      qb.andWhere('roomType.area <= :toArea', { toArea: filters.toArea });
    }
    if (filters.bedrooms !== undefined) {
      qb.andWhere('roomType.bedrooms = :bedrooms', { bedrooms: filters.bedrooms });
    }
    if (filters.bathrooms !== undefined) {
      qb.andWhere('roomType.bathrooms = :bathrooms', { bathrooms: filters.bathrooms });
    }
    if (filters.furnishing) {
      qb.andWhere('roomType.furnishing = :furnishing', { furnishing: filters.furnishing });
    }
    if (filters.province) {
      qb.andWhere('property.province = :province', { province: filters.province });
    }
    if (filters.ward) {
      qb.andWhere('property.ward = :ward', { ward: filters.ward });
    }
    if ('isApproved' in filters && typeof filters.isApproved === 'boolean') {
      qb.andWhere('property.isApproved = :isApproved', { isApproved: filters.isApproved });
    }
    if (filters.q) {
      qb.andWhere(
        '(LOWER(roomType.name) LIKE :search OR LOWER(roomType.description) LIKE :search OR LOWER(property.title) LIKE :search OR LOWER(property.description) LIKE :search)',
        { search: `%${filters.q.toLowerCase()}%` },
      );
    }
  }

  /**
   * Transform boarding properties to RoomTypeEntry format
   * Applies additional memory-based filters that can't be done at DB level
   */
  private transformBoardingToRoomTypes(
    boardingProps: Property[],
    filters: Partial<FilterPropertyDto | FilterPropertyWithUrlDto>,
  ): RoomTypeEntry[] {
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

      // Build RoomTypeEntry for each group
      for (const rtId of Object.keys(grouped)) {
        const { roomType, rooms } = grouped[rtId];

        // Additional filters (already filtered by DB query builder, but double-check for edge cases)
        const price = Number(roomType.price) || 0;
        const area = Number(roomType.area) || 0;

        if (filters.fromPrice !== undefined && price < filters.fromPrice) continue;
        if (filters.toPrice !== undefined && price > filters.toPrice) continue;
        if (filters.fromArea !== undefined && area < filters.fromArea) continue;
        if (filters.toArea !== undefined && area > filters.toArea) continue;
        if (filters.bedrooms !== undefined && roomType.bedrooms !== filters.bedrooms) continue;
        if (filters.bathrooms !== undefined && roomType.bathrooms !== filters.bathrooms) continue;
        if (filters.furnishing && roomType.furnishing !== filters.furnishing) continue;

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
            createdAt: prop.createdAt,
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

    return roomTypeEntries;
  }

  /**
   * Apply sorting to combined data (Property and RoomTypeEntry)
   */
  private applySorting(
    data: Array<Property | RoomTypeEntry>,
    sortBy?: 'price' | 'area' | 'createdAt',
    sortOrder: 'asc' | 'desc' = 'asc',
  ): Array<Property | RoomTypeEntry> {
    if (!sortBy) return data;

    return [...data].sort((a, b) => {
      let valueA: number | Date | undefined;
      let valueB: number | Date | undefined;

      // Get values based on sortBy field
      if (sortBy === 'price') {
        valueA =
          (a as Property).type && (a as Property).type !== PropertyTypeEnum.BOARDING
            ? (a as Property).price ?? 0
            : (a as RoomTypeEntry).price ?? 0;
        valueB =
          (b as Property).type && (b as Property).type !== PropertyTypeEnum.BOARDING
            ? (b as Property).price ?? 0
            : (b as RoomTypeEntry).price ?? 0;
      } else if (sortBy === 'area') {
        valueA =
          (a as Property).type && (a as Property).type !== PropertyTypeEnum.BOARDING
            ? (a as Property).area ?? 0
            : (a as RoomTypeEntry).area ?? 0;
        valueB =
          (b as Property).type && (b as Property).type !== PropertyTypeEnum.BOARDING
            ? (b as Property).area ?? 0
            : (b as RoomTypeEntry).area ?? 0;
      } else if (sortBy === 'createdAt') {
        valueA =
          (a as Property).type && (a as Property).type !== PropertyTypeEnum.BOARDING
            ? (a as Property).createdAt
            : (a as RoomTypeEntry).property?.createdAt;
        valueB =
          (b as Property).type && (b as Property).type !== PropertyTypeEnum.BOARDING
            ? (b as Property).createdAt
            : (b as RoomTypeEntry).property?.createdAt;
      }

      // Convert to comparable values
      const compareA = valueA instanceof Date ? valueA.getTime() : (valueA ?? 0);
      const compareB = valueB instanceof Date ? valueB.getTime() : (valueB ?? 0);

      // Apply sort order
      const order = sortOrder === 'desc' ? -1 : 1;

      if (compareA < compareB) return -1 * order;
      if (compareA > compareB) return 1 * order;
      return 0;
    });
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
          throw new BadRequestException(
            PROPERTY_ERRORS.PROPERTY_HAS_ACTIVE_BOOKINGS,
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
        throw new BadRequestException(
          PROPERTY_ERRORS.PROPERTY_HAS_ACTIVE_BOOKINGS,
        );
      }
    }
  }
}
