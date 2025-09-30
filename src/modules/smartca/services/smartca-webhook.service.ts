import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { 
  SmartCAWebhookDto, 
  SignedDocumentMetadataDto, 
  SigningStatus 
} from '../dto/webhook';
import { TemporaryFileService } from './temporary-file.service';
import { SmartCANotificationService } from './smartca-notification.service';

@Injectable()
export class SmartCAWebhookService {
  private readonly logger = new Logger(SmartCAWebhookService.name);
  private readonly signedFilesPath: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly temporaryFileService: TemporaryFileService,
    private readonly notificationService: SmartCANotificationService
  ) {
    // Đường dẫn lưu file đã ký
    this.signedFilesPath = this.configService.get<string>('SMARTCA_SIGNED_FILES_PATH') || 
                          path.join(process.cwd(), 'storage', 'smartca', 'signed-files');
    this.ensureDirectoryExists();
  }

  /**
   * Xử lý webhook từ SmartCA
   */
  async handleWebhook(webhookData: SmartCAWebhookDto): Promise<{
    success: boolean;
    message: string;
    processed_files: string[];
  }> {
    try {
      this.logger.log(`Processing webhook for transaction: ${webhookData.transaction_id}`);
      
      // Validate webhook data
      if (!this.validateWebhookData(webhookData)) {
        throw new BadRequestException("Invalid webhook data");
      }

      const processedFiles: string[] = [];

      // Xử lý từng file đã ký
      for (const signedFile of webhookData.signed_files) {
        if (signedFile.signature_value) {
          try {
            const metadata = await this.processSignedFile(
              webhookData,
              signedFile
            );
            processedFiles.push(metadata.doc_id);
            
            this.logger.log(`Successfully processed signed file: ${signedFile.doc_id}`);
          } catch (error) {
            this.logger.error(`Failed to process signed file ${signedFile.doc_id}:`, error);
            // Tiếp tục xử lý file khác
          }
        }
      }

      return {
        success: true,
        message: `Processed ${processedFiles.length} signed files`,
        processed_files: processedFiles
      };

    } catch (error) {
      this.logger.error('Error processing SmartCA webhook:', error);
      throw error;
    }
  }

  /**
   * Xử lý một file đã ký
   */
  private async processSignedFile(
    webhookData: SmartCAWebhookDto,
    signedFile: any
  ): Promise<SignedDocumentMetadataDto> {
    
    // Tìm file gốc từ doc_id (giả sử doc_id chứa thông tin để tìm file)
    const originalFileInfo = await this.findOriginalFile(signedFile.doc_id);
    
    if (!originalFileInfo) {
      throw new Error(`Original file not found for doc_id: ${signedFile.doc_id}`);
    }

    // Tái tạo file đã ký từ signature
    const signedFileBuffer = await this.reconstructSignedFile(
      originalFileInfo.buffer,
      signedFile.signature_value,
      originalFileInfo.fileType
    );

    // Lưu file đã ký
    const signedFilePath = await this.saveSignedFile(
      signedFileBuffer,
      signedFile.doc_id,
      originalFileInfo.originalName,
      originalFileInfo.fileType
    );

    // Tạo metadata
    const metadata: SignedDocumentMetadataDto = {
      doc_id: signedFile.doc_id,
      transaction_id: webhookData.transaction_id || '',
      original_filename: originalFileInfo.originalName,
      file_type: originalFileInfo.fileType,
      status: SigningStatus.SIGNED,
      signed_file_path: signedFilePath,
      signature_value: signedFile.signature_value,
      timestamp_signature: signedFile.timestamp_signature,
      user_id: originalFileInfo.userId,
      signed_at: new Date(),
      file_size: signedFileBuffer.length
    };

    // Lưu metadata (có thể lưu vào database)
    await this.saveSignedFileMetadata(metadata);

    // Gửi notification
    await this.notificationService.notifySigningCompleted(metadata);

    return metadata;
  }

  /**
   * Tái tạo file đã ký từ file gốc và signature
   */
  private async reconstructSignedFile(
    originalBuffer: Buffer,
    signatureValue: string,
    fileType: string
  ): Promise<Buffer> {
    
    if (fileType === 'pdf') {
      // Đối với PDF, áp dụng signature vào file
      return this.applySignatureToPDF(originalBuffer, signatureValue);
    } else if (fileType === 'xml') {
      // Đối với XML, chèn signature vào XML
      const xmlContent = originalBuffer.toString('utf8');
      const signedXml = this.applySignatureToXML(xmlContent, signatureValue);
      return Buffer.from(signedXml, 'utf8');
    }

    throw new Error(`Unsupported file type: ${fileType}`);
  }

  /**
   * Áp dụng signature vào PDF (placeholder implementation)
   */
  private applySignatureToPDF(pdfBuffer: Buffer, signature: string): Buffer {
    // TODO: Implement proper PDF signing logic using libraries like node-signpdf
    this.logger.log("Applying signature to PDF - placeholder implementation");
    
    // Tạm thời trả về buffer gốc với metadata được thêm vào
    // Trong thực tế, cần sử dụng thư viện chuyên dụng để embed signature
    return pdfBuffer;
  }

  /**
   * Áp dụng signature vào XML
   */
  private applySignatureToXML(xmlContent: string, signature: string): string {
    // TODO: Implement proper XML signature insertion
    this.logger.log("Applying signature to XML - placeholder implementation");
    
    // Tạm thời chèn signature vào cuối XML
    const signatureElement = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
      <SignatureValue>${signature}</SignatureValue>
    </Signature>`;
    
    return xmlContent.replace('</root>', `${signatureElement}</root>`) || 
           xmlContent + signatureElement;
  }

  /**
   * Lưu file đã ký vào filesystem
   */
  private async saveSignedFile(
    fileBuffer: Buffer,
    docId: string,
    originalName: string,
    fileType: string
  ): Promise<string> {
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${docId}_${timestamp}_signed.${fileType}`;
    const filePath = path.join(this.signedFilesPath, filename);
    
    await fs.writeFile(filePath, fileBuffer);
    
    this.logger.log(`Signed file saved: ${filePath}`);
    return filePath;
  }

  /**
   * Lưu metadata của file đã ký
   */
  private async saveSignedFileMetadata(metadata: SignedDocumentMetadataDto): Promise<void> {
    // TODO: Lưu vào database thay vì file JSON
    const metadataPath = path.join(
      this.signedFilesPath, 
      'metadata', 
      `${metadata.doc_id}_metadata.json`
    );
    
    await fs.mkdir(path.dirname(metadataPath), { recursive: true });
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    
    this.logger.log(`Metadata saved: ${metadataPath}`);
  }

  /**
   * Tìm file gốc từ doc_id
   */
  private async findOriginalFile(docId: string): Promise<{
    buffer: Buffer;
    originalName: string;
    fileType: string;
    userId: string;
  } | null> {
    
    this.logger.log(`Finding original file for doc_id: ${docId}`);
    
    // Lấy file từ temporary file service
    const tempFile = await this.temporaryFileService.getTemporaryFile(docId);
    
    if (!tempFile) {
      this.logger.error(`Original file not found in temporary storage for doc_id: ${docId}`);
      return null;
    }

    return {
      buffer: tempFile.buffer,
      originalName: tempFile.originalName,
      fileType: tempFile.fileType,
      userId: tempFile.userId
    };
  }

  /**
   * Validate webhook data từ SmartCA
   */
  private validateWebhookData(webhookData: SmartCAWebhookDto): boolean {
    // Validate sp_id
    const expectedSpId = this.configService.get<string>('SMARTCA_SP_ID');
    if (webhookData.sp_id !== expectedSpId) {
      this.logger.error(`Invalid sp_id: ${webhookData.sp_id}`);
      return false;
    }

    // Validate status_code
    if (![200, 201].includes(webhookData.status_code)) {
      this.logger.error(`Invalid status_code: ${webhookData.status_code}`);
      return false;
    }

    return true;
  }

  /**
   * Đảm bảo thư mục lưu file exists
   */
  private async ensureDirectoryExists(): Promise<void> {
    try {
      await fs.mkdir(this.signedFilesPath, { recursive: true });
      await fs.mkdir(path.join(this.signedFilesPath, 'metadata'), { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create signed files directory:', error);
    }
  }

  /**
   * Lấy thông tin file đã ký
   */
  async getSignedFileInfo(docId: string): Promise<SignedDocumentMetadataDto | null> {
    try {
      const metadataPath = path.join(
        this.signedFilesPath, 
        'metadata', 
        `${docId}_metadata.json`
      );
      
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      return JSON.parse(metadataContent);
    } catch (error) {
      this.logger.error(`Failed to get signed file info for ${docId}:`, error);
      return null;
    }
  }

  /**
   * Lấy file đã ký
   */
  async getSignedFile(docId: string): Promise<Buffer | null> {
    try {
      const metadata = await this.getSignedFileInfo(docId);
      if (!metadata || !metadata.signed_file_path) {
        return null;
      }

      return await fs.readFile(metadata.signed_file_path);
    } catch (error) {
      this.logger.error(`Failed to get signed file for ${docId}:`, error);
      return null;
    }
  }
}