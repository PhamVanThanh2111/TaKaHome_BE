# Tài liệu tích hợp SmartCA VNPT cho NestJS

## Tổng quan

Tài liệu này hướng dẫn cách tích hợp dịch vụ chữ ký số SmartCA 769 của VNPT vào ứng dụng NestJS, dựa trên phân tích từ project Java SmartCA-769-JAVA.

## Yêu cầu hệ thống

- Node.js >= 16.x
- NestJS >= 9.x
- TypeScript >= 4.x

## Dependencies

```bash
npm install --save @nestjs/common @nestjs/core @nestjs/axios
npm install --save axios
npm install --save class-validator class-transformer
npm install --save uuid
npm install --save crypto-js
npm install --save @types/uuid
```

## Cấu trúc dự án

```
src/
├── smartca/
│   ├── dto/
│   │   ├── smartca-config.dto.ts
│   │   ├── certificate-request.dto.ts
│   │   ├── sign-request.dto.ts
│   │   └── responses/
│   │       ├── certificate-response.dto.ts
│   │       ├── sign-response.dto.ts
│   │       └── transaction-info-response.dto.ts
│   ├── interfaces/
│   │   └── smartca.interface.ts
│   ├── services/
│   │   └── smartca.service.ts
│   ├── controllers/
│   │   └── smartca.controller.ts
│   └── smartca.module.ts
```

## 1. Configuration DTOs

### `src/smartca/dto/smartca-config.dto.ts`

```typescript
import { IsString, IsNotEmpty } from "class-validator";

export class SmartCAConfigDto {
  @IsString()
  @IsNotEmpty()
  sp_id: string;

  @IsString()
  @IsNotEmpty()
  sp_password: string;

  @IsString()
  @IsNotEmpty()
  user_id: string;
}
```

### `src/smartca/dto/certificate-request.dto.ts`

```typescript
import { IsString, IsNotEmpty, IsOptional } from "class-validator";

export class CertificateRequestDto {
  @IsString()
  @IsNotEmpty()
  sp_id: string;

  @IsString()
  @IsNotEmpty()
  sp_password: string;

  @IsString()
  @IsNotEmpty()
  user_id: string;

  @IsString()
  @IsOptional()
  serial_number?: string;

  @IsString()
  @IsNotEmpty()
  transaction_id: string;
}
```

### `src/smartca/dto/sign-request.dto.ts`

```typescript
import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsOptional,
} from "class-validator";
import { Type } from "class-transformer";

export class SignFileDto {
  @IsString()
  @IsNotEmpty()
  data_to_be_signed: string;

  @IsString()
  @IsNotEmpty()
  doc_id: string;

  @IsString()
  @IsNotEmpty()
  file_type: string; // 'pdf' | 'xml'

  @IsString()
  @IsNotEmpty()
  sign_type: string; // 'hash'
}

export class SignRequestDto {
  @IsString()
  @IsNotEmpty()
  sp_id: string;

  @IsString()
  @IsNotEmpty()
  sp_password: string;

  @IsString()
  @IsNotEmpty()
  user_id: string;

  @IsString()
  @IsNotEmpty()
  serial_number: string;

  @IsString()
  @IsNotEmpty()
  transaction_id: string;

  @IsString()
  @IsOptional()
  time_stamp?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SignFileDto)
  sign_files: SignFileDto[];
}
```

## 2. Response DTOs

### `src/smartca/dto/responses/certificate-response.dto.ts`

```typescript
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
```

### `src/smartca/dto/responses/sign-response.dto.ts`

```typescript
export class SignDataDto {
  transaction_id: string;
  tran_code: string;
}

export class SignResponseDto {
  status_code: number;
  message: string;
  data: SignDataDto;
}
```

### `src/smartca/dto/responses/transaction-info-response.dto.ts`

```typescript
export class SignatureDto {
  doc_id: string;
  signature_value: string;
  timestamp_signature: string;
}

export class TransactionDataDto {
  transaction_id: string;
  signatures: SignatureDto[];
}

export class TransactionInfoResponseDto {
  status_code: number;
  message: string;
  data: TransactionDataDto;
}
```

## 3. Interfaces

### `src/smartca/interfaces/smartca.interface.ts`

```typescript
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
}

export interface IXMLSignatureOptions {
  hashAlgorithm?: string;
  signatureId?: string;
  referenceId?: string;
  signingTime?: string;
  tagSigning?: string;
  tagSaveSignature?: string;
}
```

## 4. Service Implementation

### `src/smartca/services/smartca.service.ts`

```typescript
import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { v4 as uuidv4 } from "uuid";
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
import { ISignatureOptions, IXMLSignatureOptions } from "../interfaces";

@Injectable()
export class SmartCAService {
  private readonly logger = new Logger(SmartCAService.name);
  private readonly baseURL = "https://gwsca.vnpt.vn/sca/sp769/v1";

  // Custom HTTPS Agent to handle SSL (similar to Java's initSecureClient)
  private readonly httpsAgent = new Agent({
    rejectUnauthorized: false, // Only for testing - should be true in production
  });

  constructor(private readonly httpService: HttpService) {}

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
        transaction_id: uuidv4(),
      };

      const response = await firstValueFrom(
        this.httpService.post<CertificateResponseDto>(
          `${this.baseURL}/credentials/get_certificate`,
          request,
          {
            headers: {
              "Content-Type": "application/json",
            },
            httpsAgent: this.httpsAgent,
          }
        )
      );

      if (response.status !== 200) {
        this.logger.error("Failed to get certificates", response.data);
        return null;
      }

      const certificates = response.data.data.user_certificates;

      if (certificates.length === 1) {
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

      // Step 3: Send sign request
      const signRequest: SignRequestDto = {
        sp_id: config.sp_id,
        sp_password: config.sp_password,
        user_id: config.user_id,
        serial_number: certificate.serial_number,
        transaction_id: uuidv4(),
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
          }
        )
      );

      if (
        signResponse.status !== 200 ||
        signResponse.data.status_code !== 200
      ) {
        throw new BadRequestException("Sign request failed");
      }

      // Step 4: Poll for signature completion
      const transactionId = signResponse.data.data.transaction_id;
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

      const signRequest: SignRequestDto = {
        sp_id: config.sp_id,
        sp_password: config.sp_password,
        user_id: config.user_id,
        serial_number: certificate.serial_number,
        transaction_id: uuidv4(),
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
          }
        )
      );

      if (
        signResponse.status !== 200 ||
        signResponse.data.status_code !== 200
      ) {
        throw new BadRequestException("XML sign request failed");
      }

      const transactionId = signResponse.data.data.transaction_id;
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
          `Polling transaction status, attempt ${attempts + 1}/${maxAttempts}`
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
            }
          )
        );

        if (response.status === 200 && response.data.message === "SUCCESS") {
          const signatures = response.data.data.signatures;
          if (signatures && signatures.length > 0) {
            return signatures[0].signature_value;
          }
        }

        attempts++;
        if (attempts < maxAttempts) {
          await this.sleep(intervalMs);
        }
      } catch (error) {
        this.logger.error(
          `Error polling transaction ${transactionId}`,
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

    // For now, just return the original buffer
    // In production, implement proper PDF signing logic
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

    // For now, just return the original content
    // In production, implement proper XML signing logic
    return xmlContent;
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
}
```

## 5. Controller

### `src/smartca/controllers/smartca.controller.ts`

```typescript
import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Res,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { SmartCAService } from "../services/smartca.service";
import { SmartCAConfigDto } from "../dto/smartca-config.dto";
import { ISignatureOptions, IXMLSignatureOptions } from "../interfaces";

@Controller("smartca")
export class SmartCAController {
  constructor(private readonly smartcaService: SmartCAService) {}

  @Post("certificates")
  async getCertificates(@Body() config: SmartCAConfigDto) {
    const certificates = await this.smartcaService.getCertificates(config);
    return {
      success: !!certificates,
      data: certificates,
    };
  }

  @Post("sign-pdf")
  @UseInterceptors(FileInterceptor("file"))
  async signPDF(
    @UploadedFile() file: Express.Multer.File,
    @Body() config: SmartCAConfigDto,
    @Body("options") options: string,
    @Res() res: Response
  ) {
    if (!file) {
      throw new BadRequestException("PDF file is required");
    }

    let signatureOptions: ISignatureOptions = {};
    if (options) {
      try {
        signatureOptions = JSON.parse(options);
      } catch (error) {
        // Use default options if parsing fails
      }
    }

    const signedPdfBuffer = await this.smartcaService.signPDF(
      config,
      file.buffer,
      signatureOptions
    );

    if (signedPdfBuffer) {
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="signed_${file.originalname}"`,
      });
      res.send(signedPdfBuffer);
    } else {
      throw new BadRequestException("Failed to sign PDF");
    }
  }

  @Post("sign-xml")
  async signXML(
    @Body("config") config: SmartCAConfigDto,
    @Body("xmlContent") xmlContent: string,
    @Body("options") options: IXMLSignatureOptions = {}
  ) {
    if (!xmlContent) {
      throw new BadRequestException("XML content is required");
    }

    const signedXml = await this.smartcaService.signXML(
      config,
      xmlContent,
      options
    );

    return {
      success: !!signedXml,
      data: signedXml,
    };
  }
}
```

## 6. Module

### `src/smartca/smartca.module.ts`

```typescript
import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { SmartCAService } from "./services/smartca.service";
import { SmartCAController } from "./controllers/smartca.controller";

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  providers: [SmartCAService],
  controllers: [SmartCAController],
  exports: [SmartCAService],
})
export class SmartCAModule {}
```

## 7. Environment Configuration

### `.env`

```env
# SmartCA Configuration
SMARTCA_SP_ID=your_sp_id_here
SMARTCA_SP_PASSWORD=your_sp_password_here
SMARTCA_BASE_URL=https://gwsca.vnpt.vn/sca/sp769/v1

# Security
NODE_ENV=development
```

### `src/config/smartca.config.ts`

```typescript
export const smartcaConfig = {
  baseUrl: process.env.SMARTCA_BASE_URL || "https://gwsca.vnpt.vn/sca/sp769/v1",
  defaultSpId: process.env.SMARTCA_SP_ID,
  defaultSpPassword: process.env.SMARTCA_SP_PASSWORD,
  timeout: 30000,
  maxPollAttempts: 24,
  pollIntervalMs: 10000,
};
```

## 8. Usage Examples

### Client-side POST request examples:

```javascript
// Get certificates
const certificatesResponse = await fetch("/smartca/certificates", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    sp_id: "your_sp_id",
    sp_password: "your_sp_password",
    user_id: "user_id",
  }),
});

// Sign PDF
const formData = new FormData();
formData.append("file", pdfFile);
formData.append("sp_id", "your_sp_id");
formData.append("sp_password", "your_sp_password");
formData.append("user_id", "user_id");
formData.append(
  "options",
  JSON.stringify({
    page: 1,
    rectangle: "10,10,250,100",
    visibleType: 3,
    fullName: "Nguyen Van A",
    fontSize: 10,
  })
);

const signedPdfResponse = await fetch("/smartca/sign-pdf", {
  method: "POST",
  body: formData,
});

// Sign XML
const xmlResponse = await fetch("/smartca/sign-xml", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    config: {
      sp_id: "your_sp_id",
      sp_password: "your_sp_password",
      user_id: "user_id",
    },
    xmlContent: "<xml>...</xml>",
    options: {
      hashAlgorithm: "SHA256",
      signatureId: "signature-id",
      referenceId: "SigningData",
      signingTime: "2023-07-27T08:33:31",
      tagSigning: "DLHDon",
      tagSaveSignature: "NBan12",
    },
  }),
});
```

## 9. Testing

### `src/smartca/smartca.service.spec.ts`

```typescript
import { Test, TestingModule } from "@nestjs/testing";
import { HttpModule } from "@nestjs/axios";
import { SmartCAService } from "./services/smartca.service";

describe("SmartCAService", () => {
  let service: SmartCAService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule],
      providers: [SmartCAService],
    }).compile();

    service = module.get<SmartCAService>(SmartCAService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  // Add more tests as needed
});
```

## 10. Production Considerations

### Security:

- **Enable SSL verification** in production (`rejectUnauthorized: true`)
- **Store credentials securely** (environment variables, secrets management)
- **Implement proper error handling** and logging
- **Add rate limiting** to prevent abuse

### Performance:

- **Implement caching** for certificates
- **Use connection pooling** for HTTP requests
- **Add request timeout handling**
- **Consider using queues** for long-running sign operations

### Monitoring:

- **Add health checks**
- **Implement metrics collection**
- **Log all transactions** for audit trails
- **Set up alerts** for failed operations

## 11. Additional Libraries Needed

For production implementation, consider adding these libraries:

```bash
# PDF signing
npm install --save node-signpdf pdf-lib

# XML signing
npm install --save xmldsigjs node-forge

# File handling
npm install --save multer
npm install --save @types/multer

# Configuration management
npm install --save @nestjs/config

# Validation
npm install --save class-validator class-transformer

# Logging
npm install --save winston nest-winston
```

## Kết luận

Tài liệu này cung cấp framework cơ bản để tích hợp SmartCA VNPT vào ứng dụng NestJS. Các implementation cụ thể cho PDF và XML signing cần được bổ sung với các thư viện chuyên dụng tùy theo yêu cầu cụ thể của dự án.

Hãy nhớ test kỹ trong môi trường development trước khi deploy production, và luôn tuân thủ các best practices về security khi xử lý certificates và credentials.
