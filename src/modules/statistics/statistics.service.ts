import { Injectable, NotFoundException } from '@nestjs/common';
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

export interface LandlordStatistics {
  totalProperties: number;
  totalBooking: number;
  yearsOfParticipation: string;
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

  async getLandlordStatistics(
    landlordId: string,
  ): Promise<ResponseCommon<LandlordStatistics>> {
    // Kiểm tra landlord có tồn tại
    const landlord = await this.userRepository.findOne({
      where: { id: landlordId },
    });
    if (!landlord) {
      throw new NotFoundException('Landlord not found');
    }

    // Đếm tổng số properties của landlord
    const totalProperties = await this.propertyRepository.count({
      where: { landlord: { id: landlordId } },
    });

    // Tìm các booking thành công của properties thuộc về landlord
    const propertiesActiveBookings = await this.bookingRepository.find({
      where: {
        property: { landlord: { id: landlordId } },
        status: Not(
          In([BookingStatus.PENDING_LANDLORD, BookingStatus.REJECTED]),
        ),
      },
      relations: ['property'],
    });

    // Tìm các booking thành công của rooms thuộc về landlord
    const roomsActiveBookings = await this.bookingRepository.find({
      where: {
        room: { property: { landlord: { id: landlordId } } },
        status: Not(
          In([BookingStatus.PENDING_LANDLORD, BookingStatus.REJECTED]),
        ),
      },
      relations: ['room', 'room.property'],
    });

    // Tính tổng số booking thành công
    const totalBooking =
      propertiesActiveBookings.length + roomsActiveBookings.length;

    // Tính số năm tham gia
    const now = new Date();
    const createdAt = new Date(landlord.createdAt);

    // Tính số tháng tổng cộng
    const diffYears = now.getFullYear() - createdAt.getFullYear();
    const diffMonths = now.getMonth() - createdAt.getMonth();
    const totalMonths = Math.max(0, diffYears * 12 + diffMonths);

    let yearsOfParticipation: string;
    if (totalMonths < 1) {
      // Nếu dưới 1 tháng thì hiển thị "Dưới 1 tháng"
      yearsOfParticipation = 'Under 1 month';
    } else if (totalMonths < 12) {
      // Nếu dưới 1 năm thì hiển thị theo tháng
      yearsOfParticipation =
        totalMonths === 1 ? '1 month' : `${totalMonths} months`;
    } else {
      // Nếu từ 1 năm trở lên thì hiển thị theo năm
      const years = Math.floor(totalMonths / 12);
      yearsOfParticipation = years === 1 ? '1 year' : `${years} years`;
    }

    const statistics: LandlordStatistics = {
      totalProperties,
      totalBooking,
      yearsOfParticipation,
    };

    return new ResponseCommon(
      200,
      'Landlord statistics retrieved successfully',
      statistics,
    );
  }
}
