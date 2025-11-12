import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { differenceInMonths } from 'date-fns';
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
import { CONTRACT_ERRORS } from 'src/common/constants/error-messages.constant';

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
      throw new NotFoundException(CONTRACT_ERRORS.CONTRACT_NOT_FOUND);
    }

    // 2. Kiểm tra người yêu cầu có phải là tenant hoặc landlord không
    const isTenant = contract.tenant.id === userId;
    const isLandlord = contract.landlord.id === userId;

    if (!isTenant && !isLandlord) {
      throw new ForbiddenException(
        CONTRACT_ERRORS.TERMINATION_FORBIDDEN_NOT_PARTY,
      );
    }

    // 3. Kiểm tra hợp đồng có đang hoạt động không
    if (contract.status !== ContractStatusEnum.ACTIVE) {
      throw new BadRequestException(
        CONTRACT_ERRORS.TERMINATION_CONTRACT_NOT_ACTIVE,
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
        CONTRACT_ERRORS.TERMINATION_REQUEST_ALREADY_PENDING,
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
        CONTRACT_ERRORS.TERMINATION_INVALID_END_MONTH_FORMAT,
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
        CONTRACT_ERRORS.TERMINATION_END_MONTH_EXCEEDS_CONTRACT,
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
      throw new BadRequestException(
        CONTRACT_ERRORS.TERMINATION_MINIMUM_TWO_MONTHS_REQUIRED,
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
      throw new NotFoundException(CONTRACT_ERRORS.TERMINATION_REQUEST_NOT_FOUND);
    }

    // 2. Kiểm tra trạng thái
    if (request.status !== TerminationRequestStatus.PENDING) {
      throw new BadRequestException(
        CONTRACT_ERRORS.TERMINATION_REQUEST_ALREADY_PROCESSED,
      );
    }

    // 3. Kiểm tra người phản hồi có phải là bên còn lại không
    const isTenant = request.contract.tenant.id === userId;
    const isLandlord = request.contract.landlord.id === userId;

    if (!isTenant && !isLandlord) {
      throw new ForbiddenException(
        CONTRACT_ERRORS.TERMINATION_FORBIDDEN_NOT_OTHER_PARTY,
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
        CONTRACT_ERRORS.TERMINATION_FORBIDDEN_CANNOT_RESPOND_OWN,
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
      // Chuyển đổi requestedEndMonth (format: 'YYYY-MM') thành endDate
      // Giữ nguyên ngày (day) từ endDate hiện tại, chỉ thay đổi tháng/năm
      // Nếu ngày không tồn tại trong tháng mới (ví dụ: 31/01 -> 28/02), lấy ngày cuối cùng của tháng đó
      const [yearStr, monthStr] = request.requestedEndMonth.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      // Lấy ngày từ endDate hiện tại
      const currentEndDate = new Date(request.contract.endDate);
      const dayOfMonth = currentEndDate.getUTCDate();

      // Tính số ngày trong tháng được yêu cầu
      // Tạo date cho ngày đầu tiên của tháng tiếp theo, rồi trừ 1 ngày để lấy ngày cuối cùng
      const lastDayOfRequestedMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

      // Nếu ngày hiện tại vượt quá số ngày của tháng mới, lấy ngày cuối cùng của tháng đó
      const finalDay = Math.min(dayOfMonth, lastDayOfRequestedMonth);

      // Tạo Date object với ngày đã điều chỉnh
      const newEndDate = new Date(Date.UTC(year, month - 1, finalDay, 0, 0, 0, 0));

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
      throw new NotFoundException(CONTRACT_ERRORS.TERMINATION_REQUEST_NOT_FOUND);
    }

    if (request.requestedById !== userId) {
      throw new ForbiddenException(
        CONTRACT_ERRORS.TERMINATION_CANCEL_FORBIDDEN_NOT_CREATOR,
      );
    }

    if (request.status !== TerminationRequestStatus.PENDING) {
      throw new BadRequestException(
        CONTRACT_ERRORS.TERMINATION_CANCEL_ONLY_PENDING,
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
