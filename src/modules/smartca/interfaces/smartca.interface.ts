export interface ISmartCAConfig {
  sp_id: string;
  sp_password: string;
  user_id: string;
}

export interface ISignatureOptions {
  page?: number;
  rectangle?: string;
  imageSrc?: string;
  visibleType?: number;
  fullName?: string;
  fontSize?: number;
  fontColor?: string;
  docId?: string;
  originalFileName?: string;
}

export interface IXMLSignatureOptions {
  hashAlgorithm?: string;
  signatureId?: string;
  referenceId?: string;
  signingTime?: string;
  tagSigning?: string;
  tagSaveSignature?: string;
  docId?: string;
  originalFileName?: string;
}

export interface ISmartCATHConfig extends ISmartCAConfig {
  password: string; // Mật khẩu đăng nhập của thuê bao
  otp: string; // Mã OTP của thuê bao
}
