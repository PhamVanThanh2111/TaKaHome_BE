import { Injectable, Logger, BadRequestException, Inject } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import * as crypto from "crypto";
import { Agent } from "https";

import {
  SmartCAConfigDto,
  CertificateRequestDto,
  SignRequestDto,
  SignFileDto,
  CertificateResponseDto,
  SignResponseDto,
  TransactionInfoResponseDto,
  UserCertificateDto,
} from "../dto";
import { ISignatureOptions, IXMLSignatureOptions, ISmartCATHConfig } from "../interfaces/smartca.interface";

@Injectable()
export class SmartCAService {
  private readonly logger = new Logger(SmartCAService.name);
  private readonly baseURL: string;

  // Custom HTTPS Agent to handle SSL (similar to Java's initSecureClient)
  private readonly httpsAgent = new Agent({
    rejectUnauthorized: process.env.NODE_ENV === "production", // false for development, true for production
  });

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    // Determine which URL to use based on environment
    const environment = this.configService.get<string>('SMARTCA_ENVIRONMENT', 'production');
    this.baseURL = environment === 'uat' 
      ? this.configService.get<string>('smartca.uatBaseUrl', 'https://rmgateway.vnptit.vn/sca/sp769/v1')
      : this.configService.get<string>('smartca.baseUrl', 'https://gwsca.vnpt.vn/sca/sp769/v1');
      
    this.logger.log(`SmartCA Service initialized with environment: ${environment}`);
    this.logger.log(`Using base URL: ${this.baseURL}`);
  }

  /**
   * Generate UUID v4 using crypto built-in module
   */
  private generateUUID(): string {
    return crypto.randomUUID();
  }

  /**
   * Get certificates for a user (equivalent to getCertificate769 in Java)
   */
  async getCertificates(
    config: SmartCAConfigDto
  ): Promise<UserCertificateDto | null> {
    try {
      const request: CertificateRequestDto = {
        sp_id: config.sp_id,
        sp_password: config.sp_password,
        user_id: config.user_id,
        transaction_id: this.generateUUID(),
      };

      this.logger.log(`Getting certificates for user: ${config.user_id}`);
       this.logger.log(`Request: ${JSON.stringify(request)}`);
      const response = await firstValueFrom(
        this.httpService.post<CertificateResponseDto>(
          `${this.baseURL}/credentials/get_certificate`,
          request,
          {
            headers: {
              "Content-Type": "application/json",
            },
            httpsAgent: this.httpsAgent,
            timeout: 30000,
          }
        )
      );

      if (response.status !== 200 || response.data.status_code !== 200) {
        this.logger.error("Failed to get certificates", response.data);
        return null;
      }
      this.logger.log(`Response: ${JSON.stringify(response.data)}`);
      const certificates = response.data.data.user_certificates;

      if (certificates.length === 1) {
        this.logger.log(`Found 1 certificate for user ${config.user_id}`);
        return certificates[0];
      } else if (certificates.length > 1) {
        // In a real application, you might want to return all certificates
        // and let the client choose, or implement a selection logic
        this.logger.log(
          `Found ${certificates.length} certificates for user ${config.user_id}`
        );
        certificates.forEach((cert, index) => {
          this.logger.log(
            `Certificate ${index}: ${cert.service_type} - ${cert.serial_number}`
          );
        });

        // Return the first certificate by default
        return certificates[0];
      }

      this.logger.warn(`No certificates found for user ${config.user_id}`);
      return null;
    } catch (error) {
      this.logger.error("Error getting certificates", error.message);
      throw new BadRequestException("Failed to get certificates");
    }
  }

  /**
   * Sign PDF file (equivalent to signHashPdf769 in Java)
   */
  async signPDF(
    config: SmartCAConfigDto,
    fileBuffer: Buffer,
    options: ISignatureOptions = {}
  ): Promise<Buffer | null> {
    try {
      // Step 1: Get certificate
      const certificate = await this.getCertificates(config);
      if (!certificate) {
        throw new BadRequestException("No certificates found for user");
      }

      // Step 2: Create hash from file (simplified - in real implementation,
      // you would use a proper PDF signing library like node-signpdf)
      const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

      this.logger.log(`Creating PDF signature for doc_id: ${options.docId || "default-doc-id"}`);

      // Step 3: Send sign request
      const signRequest: SignRequestDto = {
        sp_id: config.sp_id,
        sp_password: config.sp_password,
        user_id: config.user_id,
        serial_number: certificate.serial_number,
        transaction_id: this.generateUUID(),
        sign_files: [
          {
            data_to_be_signed: hash,
            doc_id: options.docId || "default-doc-id",
            file_type: "pdf",
            sign_type: "hash",
          },
        ],
      };

      const signResponse = await firstValueFrom(
        this.httpService.post<SignResponseDto>(
          `${this.baseURL}/signatures/sign`,
          signRequest,
          {
            headers: {
              "Content-Type": "application/json",
            },
            httpsAgent: this.httpsAgent,
            timeout: 30000,
          }
        )
      );

      if (
        signResponse.status !== 200 ||
        signResponse.data.status_code !== 200
      ) {
        this.logger.error("Sign request failed", signResponse.data);
        throw new BadRequestException("Sign request failed");
      }

      // Step 4: Poll for signature completion
      const transactionId = signResponse.data.data.transaction_id;
      this.logger.log(`Polling for transaction completion: ${transactionId}`);
      
      const signature = await this.pollTransactionStatus(config, transactionId);

      if (signature) {
        // Step 5: Apply signature to PDF (simplified)
        // In real implementation, you would use the signature to create a signed PDF
        return this.applySignatureToPDF(fileBuffer, signature, options);
      }

      return null;
    } catch (error) {
      this.logger.error("Error signing PDF", error.message);
      throw error;
    }
  }

  /**
   * Sign XML file (equivalent to signHashXML769 in Java)
   */
  async signXML(
    config: SmartCAConfigDto,
    xmlContent: string,
    options: IXMLSignatureOptions = {}
  ): Promise<string | null> {
    try {
      const certificate = await this.getCertificates(config);
      if (!certificate) {
        throw new BadRequestException("No certificates found for user");
      }

      // Create hash from XML content
      const hash = crypto.createHash("sha256").update(xmlContent).digest("hex");

      this.logger.log(`Creating XML signature for doc_id: ${options.docId || "default-xml-doc-id"}`);

      const signRequest: SignRequestDto = {
        sp_id: config.sp_id,
        sp_password: config.sp_password,
        user_id: config.user_id,
        serial_number: certificate.serial_number,
        transaction_id: this.generateUUID(),
        sign_files: [
          {
            data_to_be_signed: hash,
            doc_id: options.docId || "default-xml-doc-id",
            file_type: "xml",
            sign_type: "hash",
          },
        ],
      };

      const signResponse = await firstValueFrom(
        this.httpService.post<SignResponseDto>(
          `${this.baseURL}/signatures/sign`,
          signRequest,
          {
            headers: {
              "Content-Type": "application/json",
            },
            httpsAgent: this.httpsAgent,
            timeout: 30000,
          }
        )
      );

      if (
        signResponse.status !== 200 ||
        signResponse.data.status_code !== 200
      ) {
        this.logger.error("XML sign request failed", signResponse.data);
        throw new BadRequestException("XML sign request failed");
      }

      const transactionId = signResponse.data.data.transaction_id;
      this.logger.log(`Polling for XML transaction completion: ${transactionId}`);
      
      const signature = await this.pollTransactionStatus(config, transactionId);

      if (signature) {
        return this.applySignatureToXML(xmlContent, signature, options);
      }

      return null;
    } catch (error) {
      this.logger.error("Error signing XML", error.message);
      throw error;
    }
  }

  /**
   * SmartCA TH (Tích hợp) v2/signatures/sign - Ký số không cần xác nhận qua app
   */
  async signWithSmartCATH(
    config: ISmartCATHConfig,
    fileBuffer: Buffer,
    fileType: 'pdf' | 'xml',
    options: ISignatureOptions | IXMLSignatureOptions = {}
  ): Promise<Buffer | string | null> {
    try {
      // Step 1: Get certificate first
      const certificate = await this.getCertificates(config);
      if (!certificate) {
        throw new BadRequestException("No certificates found for user");
      }

      // Step 2: Create hash from file
      const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

      this.logger.log(`SmartCA TH signing for doc_id: ${options.docId || "default-smartcath-doc-id"}`);

      // Step 3: Send v2/signatures/sign request
      const signRequest = {
        sp_id: config.sp_id,
        sp_password: config.sp_password,
        user_id: config.user_id,
        password: config.password,
        otp: config.otp,
        serial_number: certificate.serial_number,
        transaction_id: this.generateUUID(),
        sign_files: [
          {
            data_to_be_signed: hash,
            doc_id: options.docId || "default-smartcath-doc-id",
            file_type: fileType,
            sign_type: "hash",
          },
        ],
      };

      const signResponse = await firstValueFrom(
        this.httpService.post<SignResponseDto>(
          `${this.baseURL.replace('/v1', '/v2')}/signatures/sign`,
          signRequest,
          {
            headers: {
              "Content-Type": "application/json",
            },
            httpsAgent: this.httpsAgent,
            timeout: 30000,
          }
        )
      );

      if (
        signResponse.status !== 200 ||
        signResponse.data.status_code !== 200
      ) {
        this.logger.error("SmartCA TH sign request failed", signResponse.data);
        throw new BadRequestException("SmartCA TH sign request failed");
      }

      // Step 4: Confirm the transaction with v2/signatures/confirm
      const confirmRequest = {
        sp_id: config.sp_id,
        sp_password: config.sp_password,
        user_id: config.user_id,
        password: config.password,
        sad: signResponse.data.data.sad,
        transaction_id: signResponse.data.data.transaction_id,
      };

      const confirmResponse = await firstValueFrom(
        this.httpService.post<TransactionInfoResponseDto>(
          `${this.baseURL.replace('/v1', '/v2')}/signatures/confirm`,
          confirmRequest,
          {
            headers: {
              "Content-Type": "application/json",
            },
            httpsAgent: this.httpsAgent,
            timeout: 30000,
          }
        )
      );

      if (
        confirmResponse.status !== 200 ||
        confirmResponse.data.status_code !== 200
      ) {
        this.logger.error("SmartCA TH confirm request failed", confirmResponse.data);
        throw new BadRequestException("SmartCA TH confirm request failed");
      }

      // Step 5: Extract signature and apply
      const signatures = confirmResponse.data.data.signatures;
      if (signatures && signatures.length > 0) {
        const signature = signatures[0].signature_value;
        
        if (fileType === 'pdf') {
          return this.applySignatureToPDF(fileBuffer, signature, options as ISignatureOptions);
        } else {
          const xmlContent = fileBuffer.toString('utf8');
          return this.applySignatureToXML(xmlContent, signature, options as IXMLSignatureOptions);
        }
      }

      return null;
    } catch (error) {
      this.logger.error("Error with SmartCA TH signing", error.message);
      throw error;
    }
  }

  /**
   * Poll transaction status (equivalent to getTransInfo769 in Java)
   */
  private async pollTransactionStatus(
    config: SmartCAConfigDto,
    transactionId: string,
    maxAttempts: number = 24,
    intervalMs: number = 10000
  ): Promise<string | null> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        this.logger.log(
          `Polling transaction status, attempt ${attempts + 1}/${maxAttempts} for transaction: ${transactionId}`
        );

        const response = await firstValueFrom(
          this.httpService.post<TransactionInfoResponseDto>(
            `${this.baseURL}/signatures/sign/${transactionId}/status`,
            {},
            {
              headers: {
                "Content-Type": "application/json",
              },
              httpsAgent: this.httpsAgent,
              timeout: 30000,
            }
          )
        );

        if (response.status === 200 && response.data.status_code === 200 && response.data.message === "SUCCESS") {
          const signatures = response.data.data.signatures;
          if (signatures && signatures.length > 0) {
            this.logger.log(`Transaction ${transactionId} completed successfully`);
            return signatures[0].signature_value;
          }
        }

        attempts++;
        if (attempts < maxAttempts) {
          await this.sleep(intervalMs);
        }
      } catch (error) {
        this.logger.error(
          `Error polling transaction ${transactionId} (attempt ${attempts + 1})`,
          error.message
        );
        attempts++;
        if (attempts < maxAttempts) {
          await this.sleep(intervalMs);
        }
      }
    }

    this.logger.error(
      `Transaction ${transactionId} timed out after ${maxAttempts} attempts`
    );
    return null;
  }

  /**
   * Apply signature to PDF (simplified implementation)
   * In production, use libraries like node-signpdf, pdf-lib, etc.
   */
  private async applySignatureToPDF(
    pdfBuffer: Buffer,
    signature: string,
    options: ISignatureOptions
  ): Promise<Buffer> {
    // This is a placeholder implementation
    // In real applications, you would use proper PDF signing libraries
    this.logger.log("Applying signature to PDF - placeholder implementation");
    this.logger.log(`Signature length: ${signature.length}`);

    // For now, just return the original buffer
    // In production, implement proper PDF signing logic
    // You could use libraries like:
    // - node-signpdf
    // - pdf-lib
    // - HummusJS
    return pdfBuffer;
  }

  /**
   * Apply signature to XML
   */
  private async applySignatureToXML(
    xmlContent: string,
    signature: string,
    options: IXMLSignatureOptions
  ): Promise<string> {
    // This is a placeholder implementation
    // In real applications, you would use proper XML signing libraries
    this.logger.log("Applying signature to XML - placeholder implementation");
    this.logger.log(`Signature length: ${signature.length}`);

    // For now, just return the original content
    // In production, implement proper XML signing logic
    // You could use libraries like:
    // - xmldsigjs
    // - node-forge
    // - xml-crypto
    return xmlContent;
  }

  /**
   * Check transaction status manually
   */
  async getTransactionStatus(
    transactionId: string
  ): Promise<TransactionInfoResponseDto | null> {
    try {
      this.logger.log(`Checking transaction status for: ${transactionId}`);

      const response = await firstValueFrom(
        this.httpService.post<TransactionInfoResponseDto>(
          `${this.baseURL}/signatures/sign/${transactionId}/status`,
          {},
          {
            headers: {
              "Content-Type": "application/json",
            },
            httpsAgent: this.httpsAgent,
            timeout: 30000,
          }
        )
      );

      if (response.status === 200) {
        return response.data;
      }

      return null;
    } catch (error) {
      this.logger.error(`Error checking transaction status: ${transactionId}`, error.message);
      return null;
    }
  }

  /**
   * Utility method for sleep/delay
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if string is valid integer
   */
  private isStringInteger(value: string): boolean {
    return /^\d+$/.test(value);
  }

  /**
   * Generate transaction ID
   */
  generateTransactionId(): string {
    return this.generateUUID();
  }

  /**
   * Create hash from buffer
   */
  createHash(data: Buffer): string {
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  /**
   * Validate SmartCA config
   */
  validateConfig(config: SmartCAConfigDto): boolean {
    return !!(config.sp_id && config.sp_password && config.user_id);
  }
}
