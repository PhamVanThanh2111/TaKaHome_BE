/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  Injectable,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CertificateKey } from './entities/certificate-key.entity';
import { SmartCAService } from './smartca.service';
import { RootCAService } from './root-ca.service';
import { encryptPrivateKey } from './crypto.util';
import * as crypto from 'crypto';
import { UserService } from '../user/user.service';

@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name);

  constructor(
    @InjectRepository(CertificateKey)
    private readonly certRepo: Repository<CertificateKey>,
    private readonly rootCA: RootCAService,
    @Inject(forwardRef(() => SmartCAService))
    private readonly smartCAService: SmartCAService,
    private readonly userService: UserService,
  ) {}

  /**
   * Generate user RSA keypair + certificate signed by Root CA and persist encrypted private key
   */
  public async generateUserKeyAndCert(
    userId: string,
    userDetails: { fullName?: string; email?: string },
  ) {
    if (!userId) throw new BadRequestException('userId required');
    const systemKey = process.env.SYSTEM_ENC_KEY;
    if (!systemKey)
      throw new BadRequestException('SYSTEM_ENC_KEY not configured');

    // Generate RSA keypair (2048 for compatibility)
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    // Sign certificate with Root CA
    // đảm bảo cả chuỗi fullName không có khoảng trắng nào
    const fullName = this.removeAccentsAndSpaces(userDetails.fullName?.trim());
    const subject = {
      CN: fullName ?? `user-${userId}`,
      emailAddress: userDetails.email,
    };
    const certPem = this.rootCA.signCertificate({
      publicKeyPem: publicKey,
      subject,
      days: 365,
    });

    // extract serial from certificate (simple parse)
    let serial = null;
    try {
      const forge = require('node-forge');
      const cert = forge.pki.certificateFromPem(certPem);
      serial = cert.serialNumber || null;
    } catch (e) {
      this.logger.warn(
        'Cannot parse serial from cert: ' + String(e?.message || e),
      );
    }

    const encrypted = encryptPrivateKey(privateKey, systemKey);

    // Upsert into CertificateKey table (one-to-one with user)
    let existing = await this.certRepo.findOne({ where: { userId } });
    if (!existing) {
      existing = this.certRepo.create({
        userId,
        privateKeyEncrypted: encrypted,
        certificatePem: certPem,
        serialNumber: serial,
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        revoked: false,
      });
    } else {
      existing.privateKeyEncrypted = encrypted;
      existing.certificatePem = certPem;
      existing.serialNumber = serial;
      existing.issuedAt = new Date();
      existing.expiresAt = new Date(Date.now() + 365 * 24 * 3600 * 1000);
      existing.revoked = false;
      existing.revokedAt = null;
    }

    const saved = await this.certRepo.save(existing);
    return {
      id: saved.id,
      userId: saved.userId,
      certificatePem: saved.certificatePem,
      serialNumber: saved.serialNumber,
      issuedAt: saved.issuedAt,
      expiresAt: saved.expiresAt,
    };
  }

  public async revokeCertificate(serialNumber: string) {
    if (!serialNumber) throw new BadRequestException('serialNumber required');
    const rec = await this.certRepo.findOne({ where: { serialNumber } });
    if (!rec) throw new BadRequestException('certificate not found');
    rec.revoked = true;
    rec.revokedAt = new Date();
    await this.certRepo.save(rec);
    return { ok: true, serialNumber };
  }

  /**
   * Sign a prepared PDF (with placeholder) for a given user using SELF_CA key stored in DB.
   * This will produce a CMS PKCS#7 (detached) and embed into the PDF using SmartCAService.embedCmsAtIndex.
   */
  public async signPdfWithUserKey(
    userId: string,
    pdf: Buffer,
    signatureIndex = 0,
  ) {
    this.logger.debug(
      `[signPdfWithUserKey] start userId=${userId} signatureIndex=${signatureIndex}`,
    );

    if (!userId) {
      this.logger.warn('[signPdfWithUserKey] missing userId');
      throw new BadRequestException('userId is required');
    }

    let rec = await this.certRepo.findOne({ where: { userId } });
    if (!rec) {
      this.logger.warn(
        `[signPdfWithUserKey] no certificate record for user=${userId}, generating new certificate...`,
      );
      
      // Tự động tạo chứng thư số cho người dùng
      try {
        const userResponse = await this.userService.findOne(userId);
        const user = userResponse.data as {
          id: string;
          email: string;
          fullName?: string;
        };
        
        if (!user) {
          throw new BadRequestException(`User with id ${userId} not found`);
        }

        this.logger.debug(
          `[signPdfWithUserKey] generating certificate for user: ${user.fullName || user.email}`,
        );

        // Tạo chứng thư số mới
        await this.generateUserKeyAndCert(userId, {
          fullName: user.fullName,
          email: user.email,
        });

        // Lấy lại certificate vừa tạo
        rec = await this.certRepo.findOne({ where: { userId } });
        
        if (!rec) {
          throw new BadRequestException('Failed to generate certificate for user');
        }

        this.logger.debug(
          `[signPdfWithUserKey] certificate generated successfully for user=${userId}`,
        );
      } catch (error) {
        this.logger.error(
          `[signPdfWithUserKey] failed to generate certificate: ${String((error as Error).message || error)}`,
        );
        throw new BadRequestException(
          `Failed to generate certificate: ${String((error as Error).message || error)}`,
        );
      }
    }
    if (rec.revoked) throw new BadRequestException('Certificate revoked');
    const systemKey = process.env.SYSTEM_ENC_KEY;
    if (!systemKey)
      throw new BadRequestException('SYSTEM_ENC_KEY not configured');
    try {
      this.logger.debug('[signPdfWithUserKey] decrypting private key');
      const t0 = Date.now();
      const { decryptPrivateKey } = await Promise.resolve(
        require('./crypto.util'),
      );
      const userPrivPem = decryptPrivateKey(rec.privateKeyEncrypted, systemKey);
      this.logger.debug(
        `[signPdfWithUserKey] decrypt done in ${Date.now() - t0}ms`,
      );

      // Build PKCS7 detached using node-forge
      this.logger.debug('[signPdfWithUserKey] building PKCS7');
      const forge = require('node-forge');
      const p7 = forge.pkcs7.createSignedData();
      // detached
      p7.content = forge.util.createBuffer('');
      p7.detached = true;

      // Validate certificate PEM and private key PEM before attempting to sign
      try {
        this.logger.debug(
          `[signPdfWithUserKey] certificatePem length=${String(rec.certificatePem?.length ?? 0)}`,
        );
        this.logger.debug(
          `[signPdfWithUserKey] privatePem length=${String(userPrivPem?.length ?? 0)}`,
        );

        if (
          !rec.certificatePem ||
          !rec.certificatePem.includes('-----BEGIN CERTIFICATE-----')
        ) {
          throw new Error('Invalid or missing certificate PEM');
        }
        if (!userPrivPem || !userPrivPem.includes('-----BEGIN')) {
          throw new Error('Invalid or missing private key PEM');
        }

        const cert = forge.pki.certificateFromPem(rec.certificatePem);
        const privateKey = forge.pki.privateKeyFromPem(userPrivPem);

        // Sanity-check certificate and private key by converting to ASN.1/DER
        try {
          const certAsn1 = forge.pki.certificateToAsn1(cert);
          const certDer = forge.asn1.toDer(certAsn1).getBytes();
          this.logger.debug(
            `[signPdfWithUserKey] certificate DER length=${String((certDer || '').length)}`,
          );
        } catch (cErr) {
          this.logger.error(
            '[signPdfWithUserKey] failed to convert certificate to DER: ' +
              String((cErr as Error).message || cErr),
          );
          this.logger.debug(
            '[signPdfWithUserKey] certificatePem head: ' +
              String((rec.certificatePem || '').slice(0, 400)),
          );
          throw new Error(
            'Certificate PEM appears malformed or unsupported by forge',
          );
        }

        try {
          // For private key, attempt to ensure it's parseable
          const pkAsn1 = forge.pki.privateKeyToAsn1(privateKey);
          const pkDer = forge.asn1.toDer(pkAsn1).getBytes();
          this.logger.debug(
            `[signPdfWithUserKey] privateKey DER length=${String((pkDer || '').length)}`,
          );
        } catch (kErr) {
          this.logger.error(
            '[signPdfWithUserKey] failed to convert private key to DER: ' +
              String((kErr as Error).message || kErr),
          );
          this.logger.debug(
            '[signPdfWithUserKey] privatePem head: ' +
              String((userPrivPem || '').slice(0, 400)),
          );
          throw new Error(
            'Private key PEM appears malformed or unsupported by forge',
          );
        }

        p7.addCertificate(cert);
        p7.addSigner({
          key: privateKey,
          certificate: cert,
          digestAlgorithm: forge.pki.oids.sha256,
          authenticatedAttributes: [
            {
              type: forge.pki.oids.contentType,
              value: forge.pki.oids.data,
            },
            {
              type: forge.pki.oids.messageDigest,
            },
            {
              type: forge.pki.oids.signingTime,
              value: new Date(),
            },
          ],
        });

        const t1 = Date.now();
        p7.sign({ detached: true });
        this.logger.debug(
          `[signPdfWithUserKey] p7.sign completed in ${Date.now() - t1}ms`,
        );

        // Convert to DER and base64
        try {
          const asn1 = p7.toAsn1();
          if (!asn1) {
            this.logger.error(
              '[signPdfWithUserKey] p7.toAsn1() returned falsy value',
            );
            throw new Error('p7.toAsn1() returned no ASN.1 structure');
          }
          let der;
          try {
            der = forge.asn1.toDer(asn1).getBytes();
          } catch (innerDerErr) {
            this.logger.error(
              '[signPdfWithUserKey] forge.asn1.toDer failed: ' +
                String((innerDerErr as Error).message || innerDerErr),
            );
            // dump small snippet for debugging
            try {
              const asn1Str = JSON.stringify(asn1, (_k, v) =>
                typeof v === 'string' && v.length > 200
                  ? v.slice(0, 200) + '...[truncated]'
                  : v,
              );
              this.logger.debug(
                '[signPdfWithUserKey] asn1 (truncated): ' +
                  asn1Str.slice(0, 2000),
              );
            } catch (jErr) {
              this.logger.debug(
                '[signPdfWithUserKey] asn1 JSON stringify failed: ' +
                  String((jErr as Error).message || jErr),
              );
            }
            throw innerDerErr;
          }

          const cmsB64 = Buffer.from(der, 'binary').toString('base64');

          // success
          this.logger.debug(
            `[signPdfWithUserKey] CMS size (base64)=${cmsB64.length}`,
          );

          // embed into pdf via SmartCAService.embedCmsAtIndex if available, otherwise return cms
          if (
            this.smartCAService &&
            typeof this.smartCAService.embedCmsAtIndex === 'function'
          ) {
            this.logger.debug('[signPdfWithUserKey] embedding CMS into PDF');
            this.smartCAService.embedCmsAtIndex(pdf, cmsB64, signatureIndex);
            this.logger.debug('[signPdfWithUserKey] embedding done');
            // Return CMS only
            this.logger.debug(
              '[signPdfWithUserKey] returning CMS base64 only (not signedPdf)',
            );
            return { success: true, cmsBase64: cmsB64 };
          }

          this.logger.debug(
            '[signPdfWithUserKey] returning CMS base64 (no embedding available)',
          );
          return { success: true, cmsBase64: cmsB64 };
        } catch (derErr) {
          this.logger.error(
            '[signPdfWithUserKey] DER conversion error: ' +
              String((derErr as Error).message || derErr),
          );
          // include snippets for debugging
          this.logger.debug(
            '[signPdfWithUserKey] certificatePem head: ' +
              String((rec.certificatePem || '').slice(0, 200)),
          );
          this.logger.debug(
            '[signPdfWithUserKey] privatePem head: ' +
              String((userPrivPem || '').slice(0, 200)),
          );
          throw new BadRequestException(
            'Failed to build CMS: invalid DER produced',
          );
        }
      } catch (parseErr) {
        this.logger.error(
          '[CertificateService] [signPdfWithUserKey] error: ' +
            String((parseErr as Error).message || parseErr),
        );
        // rethrow as BadRequest for clearer client error
        throw new BadRequestException(
          'Certificate or private key invalid or malformed: ' +
            String((parseErr as Error).message || parseErr),
        );
      }
    } catch (err) {
      this.logger.error(
        '[signPdfWithUserKey] error: ' + String((err as Error).message || err),
      );
      throw err;
    }
  }

  // ----- helpers -----
  removeAccentsAndSpaces(str) {
    str = str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');

    return str.replace(/\s/g, '');
  }
}
