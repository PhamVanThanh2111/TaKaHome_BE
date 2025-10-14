import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, In, Not } from 'typeorm';
import { Property } from '../property/entities/property.entity';
import { Room } from '../property/entities/room.entity';
import { User } from '../user/entities/user.entity';
import { Booking } from '../booking/entities/booking.entity';
import { PropertyTypeEnum } from '../common/enums/property-type.enum';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { ResponseCommon } from 'src/common/dto/response.dto';

export interface StatisticsOverview {
  totalProperties: number;
  totalRooms: number;
  propertiesForRent: number;
  roomsForRent: number;
  newPropertiesThisMonth: number;
  newRoomsThisMonth: number;
  totalUsers: number;
}

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(Property)
    private propertyRepository: Repository<Property>,
    @InjectRepository(Room)
    private roomRepository: Repository<Room>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
  ) {}

  async getOverview(): Promise<ResponseCommon<StatisticsOverview>> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalProperties = await this.propertyRepository.count({
      where: [
        { type: PropertyTypeEnum.HOUSING },
        { type: PropertyTypeEnum.APARTMENT },
      ],
    });

    const totalRooms = await this.roomRepository.count();

    const activeBookings = await this.bookingRepository.find({
      where: {
        status: Not(
          In([BookingStatus.PENDING_LANDLORD, BookingStatus.REJECTED]),
        ),
      },
      relations: ['property'],
    });

    const propertiesWithActiveBookings = activeBookings
      .filter(
        (booking) =>
          booking.property &&
          (booking.property.type === PropertyTypeEnum.HOUSING ||
            booking.property.type === PropertyTypeEnum.APARTMENT),
      )
      .map((booking) => booking.property.id);

    const propertiesForRent = new Set(propertiesWithActiveBookings).size;

    const activeRoomBookings = await this.bookingRepository.find({
      where: {
        status: Not(
          In([BookingStatus.PENDING_LANDLORD, BookingStatus.REJECTED]),
        ),
      },
      relations: ['room'],
    });

    const roomsWithActiveBookings = activeRoomBookings
      .filter((booking) => booking.room != null)
      .map((booking) => booking.room.id);

    const roomsForRent = new Set(roomsWithActiveBookings).size;

    const newPropertiesThisMonth = await this.propertyRepository.count({
      where: [
        {
          type: PropertyTypeEnum.HOUSING,
          createdAt: MoreThanOrEqual(startOfMonth),
        },
        {
          type: PropertyTypeEnum.APARTMENT,
          createdAt: MoreThanOrEqual(startOfMonth),
        },
      ],
    });

    const newRoomsThisMonth = await this.roomRepository.count({
      where: {
        createdAt: MoreThanOrEqual(startOfMonth),
      },
    });

    const totalUsers = await this.userRepository.count();

    const overview: StatisticsOverview = {
      totalProperties,
      totalRooms,
      propertiesForRent,
      roomsForRent,
      newPropertiesThisMonth,
      newRoomsThisMonth,
      totalUsers,
    };

    return new ResponseCommon(
      200,
      'Statistics overview retrieved successfully',
      overview,
    );
  }
}
