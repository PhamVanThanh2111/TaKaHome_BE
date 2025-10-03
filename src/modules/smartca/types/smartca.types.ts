import { plainAddPlaceholder } from '@signpdf/placeholder-plain';

export type PlainAddPlaceholderInput = Parameters<
  typeof plainAddPlaceholder
>[0] & {
  rect?: [number, number, number, number];
  page?: number;
  signatureLength?: number;
};

export type Place = {
  page?: number;
  rect?: [number, number, number, number];
  signatureLength?: number;
  name?: string;
  reason?: string;
  contactInfo?: string;
  location?: string;
};

export type PrepareOptions = Place | { places: Place[] };

export type SmartCASignResponse = any;

export interface SmartCAUserCertificate {
  serial_number?: string;
  cert_status_code?: string; // "VALID" ...
  cert_status?: string; // "Đang hoạt động" ...
  [k: string]: any;
}

export interface SmartCAGetCertResp {
  message?: string;
  data?: { user_certificates?: SmartCAUserCertificate[] };
}
