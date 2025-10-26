import * as crypto from 'crypto';

const ALGO = 'aes-256-gcm';

export function encryptPrivateKey(plain: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) throw new Error('SYSTEM_ENC_KEY must be 32 bytes (base64)');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // store as base64 iv:cipher:tag
  return [iv.toString('base64'), ciphertext.toString('base64'), tag.toString('base64')].join(':');
}

export function decryptPrivateKey(encrypted: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) throw new Error('SYSTEM_ENC_KEY must be 32 bytes (base64)');
  const parts = encrypted.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted payload');
  const iv = Buffer.from(parts[0], 'base64');
  const ciphertext = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return plain;
}
