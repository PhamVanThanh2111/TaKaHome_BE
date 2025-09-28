export class ChainDataDto {
  ca_cert: string;
  root_cert: any;
}

export class UserCertificateDto {
  service_type: string;
  service_name: string;
  cert_id: string;
  cert_data: string;
  cert_subject: string;
  cert_valid_from: string;
  cert_valid_to: string;
  chain_data: ChainDataDto;
  serial_number: string;
  transaction_id: string;
}

export class CertificateDataDto {
  user_certificates: UserCertificateDto[];
}

export class CertificateResponseDto {
  status_code: number;
  message: string;
  data: CertificateDataDto;
}
