import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Res,
  Get,
  Param,
  HttpStatus,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody, ApiBearerAuth } from "@nestjs/swagger";

// Define the Multer type interface
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

import { SmartCAService } from "../services/smartca.service";
import { SmartCAConfigDto } from "../dto/smartca-config.dto";
import { ISignatureOptions, IXMLSignatureOptions, ISmartCATHConfig } from "../interfaces/smartca.interface";

@ApiTags('SmartCA')
@ApiBearerAuth()
@Controller("smartca")
export class SmartCAController {
  constructor(private readonly smartcaService: SmartCAService) {}

  @Post("certificates")
  @ApiOperation({ summary: 'Get user certificates from SmartCA' })
  @ApiResponse({ status: 200, description: 'Certificates retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Bad request or no certificates found' })
  async getCertificates(@Body() config: SmartCAConfigDto) {
    if (!this.smartcaService.validateConfig(config)) {
      throw new BadRequestException("Invalid SmartCA configuration");
    }
    console.log("Config received:", config);
    const certificates = await this.smartcaService.getCertificates(config);
    return {
      success: !!certificates,
      message: certificates ? "Certificates retrieved successfully" : "No certificates found",
      data: certificates,
    };
  }

  @Post("sign-pdf")
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: 'Sign PDF file with SmartCA' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'PDF file and SmartCA configuration',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        sp_id: {
          type: 'string',
          description: 'Service Provider ID',
        },
        sp_password: {
          type: 'string',
          description: 'Service Provider Password',
        },
        user_id: {
          type: 'string',
          description: 'User ID (CCCD/CMND/Passport)',
        },
        options: {
          type: 'string',
          description: 'JSON string of signature options',
        },
      },
      required: ['file', 'sp_id', 'sp_password', 'user_id'],
    },
  })
  @ApiResponse({ status: 200, description: 'PDF signed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request or signing failed' })
  async signPDF(
    @UploadedFile() file: MulterFile,
    @Body() configData: any,
    @Res() res: Response
  ) {
    if (!file) {
      throw new BadRequestException("PDF file is required");
    }

    const config: SmartCAConfigDto = {
      sp_id: configData.sp_id,
      sp_password: configData.sp_password,
      user_id: configData.user_id,
      
    };

    if (!this.smartcaService.validateConfig(config)) {
      throw new BadRequestException("Invalid SmartCA configuration");
    }

    let signatureOptions: ISignatureOptions = {};
    if (configData.options) {
      try {
        signatureOptions = JSON.parse(configData.options);
      } catch (error) {
        // Use default options if parsing fails
      }
    }

    // Set default docId if not provided
    if (!signatureOptions.docId) {
      signatureOptions.docId = `pdf-${Date.now()}`;
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
      res.status(HttpStatus.OK).send(signedPdfBuffer);
    } else {
      throw new BadRequestException("Failed to sign PDF");
    }
  }

  @Post("sign-xml")
  @ApiOperation({ summary: 'Sign XML content with SmartCA' })
  @ApiResponse({ status: 200, description: 'XML signed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request or signing failed' })
  async signXML(
    @Body("config") config: SmartCAConfigDto,
    @Body("xmlContent") xmlContent: string,
    @Body("options") options: IXMLSignatureOptions = {}
  ) {
    if (!xmlContent) {
      throw new BadRequestException("XML content is required");
    }

    if (!this.smartcaService.validateConfig(config)) {
      throw new BadRequestException("Invalid SmartCA configuration");
    }

    // Set default docId if not provided
    if (!options.docId) {
      options.docId = `xml-${Date.now()}`;
    }

    const signedXml = await this.smartcaService.signXML(
      config,
      xmlContent,
      options
    );

    return {
      success: !!signedXml,
      message: signedXml ? "XML signed successfully" : "Failed to sign XML",
      data: signedXml,
    };
  }

  @Post("sign-smartca-th-pdf")
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: 'Sign PDF file with SmartCA TH (integrated signing without app confirmation)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'PDF signed successfully with SmartCA TH' })
  @ApiResponse({ status: 400, description: 'Bad request or signing failed' })
  async signPDFWithSmartCATH(
    @UploadedFile() file: MulterFile,
    @Body() configData: any,
    @Res() res: Response
  ) {
    if (!file) {
      throw new BadRequestException("PDF file is required");
    }

    const config: ISmartCATHConfig = {
      sp_id: configData.sp_id,
      sp_password: configData.sp_password,
      user_id: configData.user_id,
      password: configData.password,
      otp: configData.otp,
    };

    if (!config.password || !config.otp) {
      throw new BadRequestException("Password and OTP are required for SmartCA TH");
    }

    let signatureOptions: ISignatureOptions = {};
    if (configData.options) {
      try {
        signatureOptions = JSON.parse(configData.options);
      } catch (error) {
        // Use default options if parsing fails
      }
    }

    // Set default docId if not provided
    if (!signatureOptions.docId) {
      signatureOptions.docId = `smartca-th-pdf-${Date.now()}`;
    }

    const result = await this.smartcaService.signWithSmartCATH(
      config,
      file.buffer,
      'pdf',
      signatureOptions
    );

    if (result && Buffer.isBuffer(result)) {
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="signed_th_${file.originalname}"`,
      });
      res.status(HttpStatus.OK).send(result);
    } else {
      throw new BadRequestException("Failed to sign PDF with SmartCA TH");
    }
  }

  @Post("sign-smartca-th-xml")
  @ApiOperation({ summary: 'Sign XML content with SmartCA TH (integrated signing without app confirmation)' })
  @ApiResponse({ status: 200, description: 'XML signed successfully with SmartCA TH' })
  @ApiResponse({ status: 400, description: 'Bad request or signing failed' })
  async signXMLWithSmartCATH(
    @Body() body: {
      config: ISmartCATHConfig;
      xmlContent: string;
      options?: IXMLSignatureOptions;
    }
  ) {
    const { config, xmlContent, options = {} } = body;

    if (!xmlContent) {
      throw new BadRequestException("XML content is required");
    }

    if (!config.password || !config.otp) {
      throw new BadRequestException("Password and OTP are required for SmartCA TH");
    }

    // Set default docId if not provided
    if (!options.docId) {
      options.docId = `smartca-th-xml-${Date.now()}`;
    }

    const xmlBuffer = Buffer.from(xmlContent, 'utf8');
    const result = await this.smartcaService.signWithSmartCATH(
      config,
      xmlBuffer,
      'xml',
      options
    );

    return {
      success: !!result,
      message: result ? "XML signed successfully with SmartCA TH" : "Failed to sign XML with SmartCA TH",
      data: result,
    };
  }

  @Get("transaction/:transactionId/status")
  @ApiOperation({ summary: 'Check transaction status' })
  @ApiResponse({ status: 200, description: 'Transaction status retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getTransactionStatus(@Param("transactionId") transactionId: string) {
    const status = await this.smartcaService.getTransactionStatus(transactionId);
    
    return {
      success: !!status,
      message: status ? "Transaction status retrieved successfully" : "Transaction not found",
      data: status,
    };
  }

  @Post("generate-transaction-id")
  @ApiOperation({ summary: 'Generate a unique transaction ID' })
  @ApiResponse({ status: 200, description: 'Transaction ID generated successfully' })
  generateTransactionId() {
    const transactionId = this.smartcaService.generateTransactionId();
    return {
      success: true,
      message: "Transaction ID generated successfully",
      data: {
        transaction_id: transactionId,
      },
    };
  }

  @Post("create-hash")
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: 'Create SHA256 hash from file' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Hash created successfully' })
  @ApiResponse({ status: 400, description: 'File is required' })
  async createHash(@UploadedFile() file: MulterFile) {
    if (!file) {
      throw new BadRequestException("File is required");
    }

    const hash = this.smartcaService.createHash(file.buffer);
    
    return {
      success: true,
      message: "Hash created successfully",
      data: {
        filename: file.originalname,
        size: file.size,
        hash: hash,
      },
    };
  }
}
