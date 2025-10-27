/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as forge from 'node-forge';
import { decryptPrivateKey } from './crypto.util';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RootCAService implements OnModuleInit {
  private readonly logger = new Logger(RootCAService.name);
  private rootPrivateKeyPem: string | null = null;
  private rootCertPem: string | null = null;
  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    try {
      this.loadRootCA();
    } catch (err) {
      this.logger.warn(
        'Root CA not loaded at startup: ' + String(err?.message || err),
      );
    }
  }

  loadRootCA() {
    // Read config via ConfigService (use rootCA config registered in AppModule)
    const cfg = this.configService.get('rootCA') as
      | Record<string, unknown>
      | undefined;
    const systemKey =
      (cfg?.['systemEncKey'] as string) || process.env.SYSTEM_ENC_KEY;
    if (!systemKey)
      throw new Error('SYSTEM_ENC_KEY is required to decrypt Root CA key');

    const encB64 =
      (cfg?.['rootCaKeyEncB64'] as string) ||
      process.env.ROOT_CA_KEY_ENC_B64 ||
      process.env.ROOT_CA_KEY_ENC_BASE64;
    const keyB64 =
      (cfg?.['rootCaKeyB64'] as string) ||
      process.env.ROOT_CA_KEY_B64 ||
      process.env.ROOT_CA_KEY_BASE64;
    const certB64 =
      (cfg?.['rootCaCertB64'] as string) ||
      process.env.ROOT_CA_CERT_B64 ||
      process.env.ROOT_CA_CERT_BASE64;

    if (encB64) {
      // Encrypted key provided as base64 of the .enc file (text). Decode to utf8 string and decrypt.
      const enc = Buffer.from(encB64, 'base64').toString('utf8').trim();
      const pem = decryptPrivateKey(enc, systemKey);
      this.rootPrivateKeyPem = pem;
    } else if (keyB64) {
      // Raw private key provided as base64 of PEM
      const pem = Buffer.from(keyB64, 'base64').toString('utf8');
      this.rootPrivateKeyPem = pem;
    } else {
      const encPath =
        (cfg?.['rootCaEncPath'] as string) ||
        process.env.ROOT_CA_ENC_PATH ||
        path.join(__dirname, '../../../src/certs/root_ca_key.pem.enc');
      if (!fs.existsSync(encPath))
        throw new Error(`Encrypted Root CA key not found: ${encPath}`);
      const enc = fs.readFileSync(encPath, 'utf8').trim();
      const pem = decryptPrivateKey(enc, systemKey);
      this.rootPrivateKeyPem = pem;
    }

    if (certB64) {
      this.rootCertPem = Buffer.from(certB64, 'base64').toString('utf8');
    } else {
      const certPath =
        (cfg?.['rootCaCertPath'] as string) ||
        process.env.ROOT_CA_CERT_PATH ||
        path.join(__dirname, '../../../src/certs/root_ca_cert.pem');
      if (!fs.existsSync(certPath))
        throw new Error(`Root CA cert not found: ${certPath}`);
      this.rootCertPem = fs.readFileSync(certPath, 'utf8');
    }

    this.logger.log('Root CA loaded (from env or file)');
  }

  getRootCertPem(): string {
    if (!this.rootCertPem) throw new Error('Root CA cert not loaded');
    return this.rootCertPem;
  }

  getRootPrivateKeyPem(): string {
    if (!this.rootPrivateKeyPem)
      throw new Error('Root CA private key not loaded');
    return this.rootPrivateKeyPem;
  }

  /**
   * Sign a certificate for a given public key and subject info.
   * Returns certificate PEM.
   */
  signCertificate(opts: {
    publicKeyPem: string;
    subject: { CN?: string; emailAddress?: string; O?: string; C?: string };
    serialNumber?: string;
    days?: number;
  }): string {
    if (!this.rootPrivateKeyPem || !this.rootCertPem) {
      throw new Error('Root CA not loaded');
    }
    const days = opts.days ?? 365;
    const serial =
      opts.serialNumber ?? Math.floor(Math.random() * Date.now()).toString(16);

    const rootPriv = forge.pki.privateKeyFromPem(this.rootPrivateKeyPem);
    const rootCert = forge.pki.certificateFromPem(this.rootCertPem);

    const cert = forge.pki.createCertificate();
    cert.publicKey = forge.pki.publicKeyFromPem(opts.publicKeyPem);
    cert.serialNumber = serial;
    const now = new Date();
    cert.validity.notBefore = now;
    cert.validity.notAfter = new Date(
      now.getTime() + days * 24 * 60 * 60 * 1000,
    );

    const attrs = [] as any[];
    if (opts.subject?.CN)
      attrs.push({ name: 'commonName', value: opts.subject.CN });
    if (opts.subject?.O)
      attrs.push({ name: 'organizationName', value: opts.subject.O });
    if (opts.subject?.C)
      attrs.push({ name: 'countryName', value: opts.subject.C });
    if (opts.subject?.emailAddress)
      attrs.push({ name: 'emailAddress', value: opts.subject.emailAddress });

    cert.setSubject(attrs);
    cert.setIssuer(rootCert.subject.attributes);

    // basicConstraints
    cert.setExtensions([
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true, clientAuth: true },
      { name: 'subjectKeyIdentifier' },
    ]);

    cert.sign(rootPriv, forge.md.sha256.create());
    return forge.pki.certificateToPem(cert);
  }
}
