import { registerAs } from '@nestjs/config';

export default registerAs('smartCA', () => ({
  smartcaBaseUrl: process.env.SMARTCA_BASE_URL,
  smartcaSignPath: process.env.SMARTCA_SIGN_PATH,
  smartcaCertPath: process.env.SMARTCA_CERT_PATH,
  smartcaSignStatusTmpl: process.env.SMARTCA_SIGN_STATUS_TMPL,

  smartcaSpId: process.env.SMARTCA_SP_ID,
  smartcaSpPassword: process.env.SMARTCA_SP_PASSWORD,
  smartcaUserId: process.env.SMARTCA_USER_ID,

  oidData: process.env.OID_DATA,
  oidSignedData: process.env.OID_SIGNED_DATA,
  oidContentType: process.env.OID_CONTENT_TYPE,
  oidMessageDigest: process.env.OID_MESSAGE_DIGEST,
  oidSigningTime: process.env.OID_SIGNING_TIME,
  oidSigningCertV2: process.env.OID_SIGNING_CERT_V2,
}));
