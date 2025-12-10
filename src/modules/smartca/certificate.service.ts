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
import { CERTIFICATE_ERRORS } from 'src/common/constants/error-messages.constant';

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
    if (!userId) throw new BadRequestException(CERTIFICATE_ERRORS.USER_ID_REQUIRED);
    const systemKey = process.env.SYSTEM_ENC_KEY;
    if (!systemKey)
      throw new BadRequestException(CERTIFICATE_ERRORS.SYSTEM_ENC_KEY_NOT_CONFIGURED);

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
    if (!serialNumber) throw new BadRequestException(CERTIFICATE_ERRORS.SERIAL_NUMBER_REQUIRED);
    const rec = await this.certRepo.findOne({ where: { serialNumber } });
    if (!rec) throw new BadRequestException(CERTIFICATE_ERRORS.CERTIFICATE_NOT_FOUND);
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
    if (!userId) {
      throw new BadRequestException(CERTIFICATE_ERRORS.USER_ID_REQUIRED);
    }
    const user = await this.userService.findOne(userId);
    let rec = await this.certRepo.findOne({ where: { userId } });
    
    // nếu chưa có chứng thư số và tài khoản cũng chưa verify (chưa cập nhật thông tin CCCD) thì thông báo lỗi người dùng phải xác thực CCCD thì mới có thể thực hiện chức năng này
    if (!rec && user.data && !(user.data as any).isVerified) {
      throw new BadRequestException(CERTIFICATE_ERRORS.USER_NOT_VERIFIED_CCCD);
    }
    if (!rec) {
      // Tự động tạo chứng thư số cho người dùng
      try {
        const userResponse = await this.userService.findOne(userId);
        const user = userResponse.data as {
          id: string;
          email: string;
          fullName?: string;
        };
        
        if (!user) {
          throw new BadRequestException(CERTIFICATE_ERRORS.USER_NOT_FOUND);
        }

        // Tạo chứng thư số mới
        await this.generateUserKeyAndCert(userId, {
          fullName: user.fullName,
          email: user.email,
        });

        // Lấy lại certificate vừa tạo
        rec = await this.certRepo.findOne({ where: { userId } });
        
        if (!rec) {
          throw new BadRequestException(CERTIFICATE_ERRORS.GENERATE_CERTIFICATE_FAILED);
        }
      } catch (error) {
        this.logger.error(
          `[signPdfWithUserKey] failed to generate certificate: ${String((error as Error).message || error)}`,
        );
        throw new BadRequestException(
          `Failed to generate certificate: ${String((error as Error).message || error)}`,
        );
      }
    }
    if (rec.revoked) throw new BadRequestException(CERTIFICATE_ERRORS.CERTIFICATE_REVOKED);
    const systemKey = process.env.SYSTEM_ENC_KEY;
    if (!systemKey)
      throw new BadRequestException(CERTIFICATE_ERRORS.SYSTEM_ENC_KEY_NOT_CONFIGURED);
    try {
      const { decryptPrivateKey } = await Promise.resolve(
        require('./crypto.util'),
      );
      const userPrivPem = decryptPrivateKey(rec.privateKeyEncrypted, systemKey);

      // Build PKCS7 detached using node-forge
      const forge = require('node-forge');
      
      // CRITICAL STEP 1: Calculate ByteRange values from /Contents position
      let pdfStr = pdf.toString('latin1');
      
      // Find /Contents <...> position for the specified signature index
      const reContents = /\/Contents\s*<([\s\S]*?)>/g;
      const hits = Array.from(pdfStr.matchAll(reContents));
      if (signatureIndex < 0 || signatureIndex >= hits.length) {
        throw new BadRequestException(`Cannot find signature at index ${signatureIndex}`);
      }
      
      const m = hits[signatureIndex];
      const full = m[0];
      const before = pdfStr.slice(0, m.index);
      const ltPos = before.length + full.indexOf('<'); // '<'
      const gtPos = before.length + full.lastIndexOf('>'); // '>'
      
      const a = 0;
      const b = ltPos;
      const c = gtPos + 1;
      const d = pdf.length - c;
      
      // CRITICAL STEP 2: Write ByteRange into PDF BEFORE calculating digest
      // This ensures digest is calculated on the same content that will be in the final PDF
      pdf = this.smartCAService.writeByteRangeInSigDict(pdf, signatureIndex, [a, b, c, d]);
      pdfStr = pdf.toString('latin1');
      
      // CRITICAL STEP 3: Create content buffer from the two PDF ranges
      const p7 = forge.pkcs7.createSignedData();
      const contentBuffer = forge.util.createBuffer();
      contentBuffer.putBytes(pdf.subarray(a, a + b).toString('binary'));
      contentBuffer.putBytes(pdf.subarray(c, c + d).toString('binary'));
      
      p7.content = contentBuffer;
      p7.detached = true;

      // Validate certificate PEM and private key PEM before attempting to sign
      try {
        if (
          !rec.certificatePem ||
          !rec.certificatePem.includes('-----BEGIN CERTIFICATE-----')
        ) {
          throw new BadRequestException(CERTIFICATE_ERRORS.INVALID_CERTIFICATE_PEM);
        }
        if (!userPrivPem || !userPrivPem.includes('-----BEGIN')) {
          throw new BadRequestException(CERTIFICATE_ERRORS.INVALID_PRIVATE_KEY_PEM);
        }

        const cert = forge.pki.certificateFromPem(rec.certificatePem);
        const privateKey = forge.pki.privateKeyFromPem(userPrivPem);

        // Sanity-check certificate and private key by converting to ASN.1/DER
        try {
          const certAsn1 = forge.pki.certificateToAsn1(cert);
          forge.asn1.toDer(certAsn1).getBytes();
        } catch (cErr) {
          this.logger.error(
            '[signPdfWithUserKey] failed to convert certificate to DER: ' +
              String((cErr as Error).message || cErr),
          );
          this.logger.debug(
            '[signPdfWithUserKey] certificatePem head: ' +
              String((rec.certificatePem || '').slice(0, 400)),
          );
          throw new BadRequestException(CERTIFICATE_ERRORS.CERTIFICATE_PEM_CONVERSION_FAILED);
        }

        try {
          // For private key, attempt to ensure it's parseable
          const pkAsn1 = forge.pki.privateKeyToAsn1(privateKey);
          forge.asn1.toDer(pkAsn1).getBytes();
        } catch (kErr) {
          this.logger.error(
            '[signPdfWithUserKey] failed to convert private key to DER: ' +
              String((kErr as Error).message || kErr),
          );
          this.logger.debug(
            '[signPdfWithUserKey] privatePem head: ' +
              String((userPrivPem || '').slice(0, 400)),
          );
          throw new BadRequestException(CERTIFICATE_ERRORS.CERTIFICATE_PEM_CONVERSION_FAILED);
        }

        p7.addCertificate(cert);
        
        // Calculate messageDigest manually - hash the content buffer (PDF ranges)
        const md2 = forge.md.sha256.create();
        md2.update(contentBuffer.bytes());
        const contentDigest = md2.digest();
        
        // Add signer with manual messageDigest
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
              value: contentDigest,
            },
            {
              type: forge.pki.oids.signingTime,
              value: new Date(),
            },
          ],
        });

        p7.sign({ detached: true });

        // Convert to DER and base64
        try {
          const asn1 = p7.toAsn1();
          if (!asn1) {
            this.logger.error(
              '[signPdfWithUserKey] p7.toAsn1() returned falsy value',
            );
            throw new BadRequestException(CERTIFICATE_ERRORS.ASN1_STRUCTURE_MISSING);
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

          // embed into pdf via SmartCAService.embedCmsAtIndex if available, otherwise return cms
          if (
            this.smartCAService &&
            typeof this.smartCAService.embedCmsAtIndex === 'function'
          ) {
            this.smartCAService.embedCmsAtIndex(pdf, cmsB64, signatureIndex);
            return { success: true, cmsBase64: cmsB64 };
          }
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
          throw new BadRequestException(CERTIFICATE_ERRORS.CMS_CREATION_FAILED);
        }
      } catch (parseErr) {
        this.logger.error(
          '[CertificateService] [signPdfWithUserKey] error: ' +
            String((parseErr as Error).message || parseErr),
        );
        // rethrow as BadRequest for clearer client error
        throw new BadRequestException(CERTIFICATE_ERRORS.CERTIFICATE_INFO_EXTRACTION_FAILED);
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

  /**
   * Get Root CA certificate PEM (for signature verification)
   */
  public getRootCertPem(): string {
    return this.rootCA.getRootCertPem();
  }
}
