export class SignDataDto {
  transaction_id: string;
  tran_code: string;
  sad?: string;
  expired_in?: number;
}

export class SignResponseDto {
  status_code: number;
  message: string;
  data: SignDataDto;
}
