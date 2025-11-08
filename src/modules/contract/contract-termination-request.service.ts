import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { addMonths, differenceInMonths, format } from 'date-fns';
import {
  ContractTerminationRequest,
  TerminationRequestedBy,
  TerminationRequestStatus,
} from './entities/contract-termination-request.entity';
import { Contract } from './entities/contract.entity';
import { CreateTerminationRequestDto } from './dto/create-termination-request.dto';
import { RespondTerminationRequestDto } from './dto/respond-termination-request.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { ContractStatusEnum } from '../common/enums/contract-status.enum';

@Injectable()
export class ContractTerminationRequestService {
  private readonly logger = new Logger(ContractTerminationRequestService.name);

  constructor(
    @InjectRepository(ContractTerminationRequest)
    private terminationRequestRepository: Repository<ContractTerminationRequest>,
    @InjectRepository(Contract)
    private contractRepository: Repository<Contract>,
  ) {}

  /**
   * Tạo yêu cầu hủy hợp đồng
   * @param dto - Thông tin yêu cầu hủy
   * @param userId - ID của người tạo yêu cầu
   * @returns Yêu cầu hủy hợp đồng vừa tạo
   */
  async createTerminationRequest(
    dto: CreateTerminationRequestDto,
    userId: string,
  ): Promise<ResponseCommon<ContractTerminationRequest>> {
    // 1. Kiểm tra hợp đồng có tồn tại không
    const contract = await this.contractRepository.findOne({
      where: { id: dto.contractId },
      relations: ['tenant', 'landlord'],
    });

    if (!contract) {
      throw new NotFoundException('Không tìm thấy hợp đồng');
    }

    // 2. Kiểm tra người yêu cầu có phải là tenant hoặc landlord không
    const isTenant = contract.tenant.id === userId;
    const isLandlord = contract.landlord.id === userId;

    if (!isTenant && !isLandlord) {
      throw new ForbiddenException(
        'Bạn không có quyền tạo yêu cầu hủy hợp đồng này',
      );
    }

    // 3. Kiểm tra hợp đồng có đang hoạt động không
    if (contract.status !== ContractStatusEnum.ACTIVE) {
      throw new BadRequestException(
        'Chỉ có thể hủy hợp đồng đang hoạt động',
      );
    }

    // 4. Kiểm tra đã có yêu cầu hủy nào đang chờ xử lý chưa
    const existingRequest = await this.terminationRequestRepository.findOne({
      where: {
        contractId: dto.contractId,
        status: TerminationRequestStatus.PENDING,
      },
    });

    if (existingRequest) {
      throw new BadRequestException(
        'Đã có yêu cầu hủy hợp đồng đang chờ xử lý',
      );
    }

    // 5. Validate requestedEndMonth format và logic
    this.validateRequestedEndMonth(dto.requestedEndMonth, contract.endDate);

    // 6. Tạo yêu cầu hủy hợp đồng
    const terminationRequest = this.terminationRequestRepository.create({
      contractId: dto.contractId,
      requestedById: userId,
      requestedByRole: isTenant
        ? TerminationRequestedBy.TENANT
        : TerminationRequestedBy.LANDLORD,
      requestedEndMonth: dto.requestedEndMonth,
      reason: dto.reason,
      status: TerminationRequestStatus.PENDING,
    });

    const saved = await this.terminationRequestRepository.save(
      terminationRequest,
    );

    this.logger.log(
      `Yêu cầu hủy hợp đồng được tạo: ${saved.id} cho hợp đồng ${dto.contractId}`,
    );

    return new ResponseCommon(
      201,
      'Tạo yêu cầu hủy hợp đồng thành công',
      saved,
    );
  }

  /**
   * Validate tháng muốn kết thúc hợp đồng
   * - Phải có format YYYY-MM
   * - Phải lớn hơn tháng hiện tại ít nhất 2 tháng (để đảm bảo thanh toán thêm 1 tháng)
   * - Không được vượt quá endDate hiện tại của contract
   */
  private validateRequestedEndMonth(
    requestedEndMonth: string,
    contractEndDate: Date,
  ): void {
    // Parse requestedEndMonth
    const [yearStr, monthStr] = requestedEndMonth.split('-');
    const requestedYear = parseInt(yearStr, 10);
    const requestedMonth = parseInt(monthStr, 10);

    if (
      isNaN(requestedYear) ||
      isNaN(requestedMonth) ||
      requestedMonth < 1 ||
      requestedMonth > 12
    ) {
      throw new BadRequestException(
        'requestedEndMonth không hợp lệ. Format: YYYY-MM (ví dụ: 2025-07)',
      );
    }

    // Lấy tháng hiện tại (ngày đầu tiên của tháng hiện tại)
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Tạo date cho tháng được yêu cầu (ngày đầu tiên của tháng đó)
    const requestedMonthStart = new Date(requestedYear, requestedMonth - 1, 1);

    // Kiểm tra requestedMonthStart không được vượt quá endDate của contract
    if (requestedMonthStart > contractEndDate) {
      throw new BadRequestException(
        `Tháng kết thúc yêu cầu (${format(requestedMonthStart, 'MM/yyyy')}) không được vượt quá ` +
          `ngày kết thúc hiện tại của hợp đồng (${format(contractEndDate, 'dd/MM/yyyy')}). `
      );
    }

    // Tính số tháng chênh lệch sử dụng date-fns
    const monthsDiff = differenceInMonths(
      requestedMonthStart,
      currentMonthStart,
    );

    // Phải lớn hơn ít nhất 2 tháng
    // Ví dụ: Hiện tại tháng 5/2025, muốn kết thúc ở tháng 7/2025
    // => monthsDiff = 2 (hợp lệ, vì tháng 6 là tháng thanh toán cuối cùng)
    if (monthsDiff < 2) {
      // Tính tháng tối thiểu được phép (tháng hiện tại + 2)
      const minAllowedMonth = addMonths(currentMonthStart, 2);
      const minAllowedMonthFormatted = format(minAllowedMonth, 'MM/yyyy');

      throw new BadRequestException(
        `Tháng kết thúc hợp đồng phải sau tháng hiện tại ít nhất 2 tháng. ` +
          `Hiện tại là ${format(currentMonthStart, 'MM/yyyy')}, bạn chọn ${format(requestedMonthStart, 'MM/yyyy')}. ` +
          `Vui lòng chọn tháng từ ${minAllowedMonthFormatted} trở đi.`,
      );
    }
  }

  /**
   * Phản hồi yêu cầu hủy hợp đồng (approve hoặc reject)
   * @param requestId - ID của yêu cầu hủy
   * @param dto - Thông tin phản hồi
   * @param userId - ID của người phản hồi
   */
  async respondToTerminationRequest(
    requestId: string,
    dto: RespondTerminationRequestDto,
    userId: string,
  ): Promise<ResponseCommon<ContractTerminationRequest>> {
    // 1. Tìm yêu cầu hủy
    const request = await this.terminationRequestRepository.findOne({
      where: { id: requestId },
      relations: ['contract', 'contract.tenant', 'contract.landlord'],
    });

    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu hủy hợp đồng');
    }

    // 2. Kiểm tra trạng thái
    if (request.status !== TerminationRequestStatus.PENDING) {
      throw new BadRequestException(
        'Yêu cầu hủy này đã được xử lý hoặc không còn hiệu lực',
      );
    }

    // 3. Kiểm tra người phản hồi có phải là bên còn lại không
    const isTenant = request.contract.tenant.id === userId;
    const isLandlord = request.contract.landlord.id === userId;

    if (!isTenant && !isLandlord) {
      throw new ForbiddenException(
        'Bạn không có quyền phản hồi yêu cầu hủy này',
      );
    }

    // Người phản hồi phải là bên còn lại (không phải người tạo yêu cầu)
    const isRequestedByTenant =
      request.requestedByRole === TerminationRequestedBy.TENANT;
    if (
      (isRequestedByTenant && isTenant) ||
      (!isRequestedByTenant && isLandlord)
    ) {
      throw new ForbiddenException(
        'Bạn không thể phản hồi yêu cầu hủy do chính bạn tạo ra',
      );
    }

    // 4. Cập nhật trạng thái
    request.status = dto.status;
    request.approvedById = userId;
    request.respondedAt = new Date();
    if (dto.responseNote) {
      request.responseNote = dto.responseNote;
    }

    const updated = await this.terminationRequestRepository.save(request);

    // 5. Nếu được approve, cập nhật endDate của hợp đồng
    if (dto.status === TerminationRequestStatus.APPROVED) {
      // Chuyển đổi requestedEndMonth (format: 'YYYY-MM') thành endDate (ngày đầu tiên của tháng đó)
      // Ví dụ: '2025-07' -> 2025-07-01 00:00:00
      const [yearStr, monthStr] = request.requestedEndMonth.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      // Tạo Date object cho ngày đầu tiên của tháng (month-1 vì Date sử dụng 0-11)
      const newEndDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));

      // Cập nhật endDate của contract
      request.contract.endDate = newEndDate;
      await this.contractRepository.save(request.contract);

      this.logger.log(
        `Yêu cầu hủy hợp đồng ${requestId} đã được phê duyệt. ` +
          `Hợp đồng ${request.contractId} sẽ kết thúc vào ${newEndDate.toISOString()} (${request.requestedEndMonth})`,
      );
    }

    return new ResponseCommon(
      200,
      dto.status === TerminationRequestStatus.APPROVED
        ? 'Đã chấp nhận yêu cầu hủy hợp đồng'
        : 'Đã từ chối yêu cầu hủy hợp đồng',
      updated,
    );
  }

  /**
   * Hủy yêu cầu hủy hợp đồng (người tạo có thể hủy yêu cầu của mình)
   */
  async cancelTerminationRequest(
    requestId: string,
    userId: string,
  ): Promise<ResponseCommon<ContractTerminationRequest>> {
    const request = await this.terminationRequestRepository.findOne({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu hủy hợp đồng');
    }

    if (request.requestedById !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền hủy yêu cầu này',
      );
    }

    if (request.status !== TerminationRequestStatus.PENDING) {
      throw new BadRequestException(
        'Chỉ có thể hủy yêu cầu đang chờ xử lý',
      );
    }

    request.status = TerminationRequestStatus.CANCELLED;
    const updated = await this.terminationRequestRepository.save(request);

    return new ResponseCommon(
      200,
      'Đã hủy yêu cầu hủy hợp đồng',
      updated,
    );
  }

  /**
   * Lấy danh sách yêu cầu hủy hợp đồng theo hợp đồng
   */
  async getTerminationRequestsByContract(
    contractId: string,
  ): Promise<ResponseCommon<ContractTerminationRequest[]>> {
    const requests = await this.terminationRequestRepository.find({
      where: { contractId },
      relations: ['requestedBy', 'approvedBy'],
      order: { createdAt: 'DESC' },
    });

    return new ResponseCommon(
      200,
      'Lấy danh sách yêu cầu hủy hợp đồng thành công',
      requests,
    );
  }

  /**
   * Lấy danh sách yêu cầu hủy hợp đồng của user (có thể là tenant hoặc landlord)
   */
  async getMyTerminationRequests(
    userId: string,
  ): Promise<ResponseCommon<ContractTerminationRequest[]>> {
    const requests = await this.terminationRequestRepository.find({
      where: [{ requestedById: userId }, { approvedById: userId }],
      relations: [
        'contract',
        'contract.tenant',
        'contract.landlord',
        'contract.property',
        'requestedBy',
        'approvedBy',
      ],
      order: { createdAt: 'DESC' },
    });

    return new ResponseCommon(
      200,
      'Lấy danh sách yêu cầu hủy hợp đồng thành công',
      requests,
    );
  }

  /**
   * Lấy yêu cầu hủy hợp đồng đang chờ xử lý của một hợp đồng
   */
  async getPendingTerminationRequest(
    contractId: string,
  ): Promise<ResponseCommon<ContractTerminationRequest | null>> {
    const request = await this.terminationRequestRepository.findOne({
      where: {
        contractId,
        status: TerminationRequestStatus.PENDING,
      },
      relations: ['requestedBy', 'contract'],
    });

    return new ResponseCommon(
      200,
      request ? 'Tìm thấy yêu cầu hủy hợp đồng' : 'Không có yêu cầu nào đang chờ xử lý',
      request,
    );
  }
}
