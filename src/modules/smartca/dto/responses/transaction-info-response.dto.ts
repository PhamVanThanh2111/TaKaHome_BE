export class SignatureDto {
  doc_id: string;
  signature_value: string;
  timestamp_signature: string;
}

export class TransactionDataDto {
  transaction_id: string;
  signatures: SignatureDto[];
}

export class TransactionInfoResponseDto {
  status_code: number;
  message: string;
  data: TransactionDataDto;
}
