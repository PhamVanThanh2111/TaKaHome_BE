import { registerAs } from '@nestjs/config';

export default registerAs('rootCA', () => ({
  systemEncKey: process.env.SYSTEM_ENC_KEY,
  rootCaKeyEncB64: process.env.ROOT_CA_KEY_ENC_B64,
  rootCaKeyB64: process.env.ROOT_CA_KEY_B64,
  rootCaCertB64: process.env.ROOT_CA_CERT_B64,
  rootCaEncPath: process.env.ROOT_CA_ENC_PATH,
  rootCaCertPath: process.env.ROOT_CA_CERT_PATH,
}));
