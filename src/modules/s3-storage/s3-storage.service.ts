import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import s3Config from '../../config/s3.config';

export interface UploadResult {
  key: string;
  url: string;
  bucket: string;
  etag?: string;
  size: number;
}

export interface UploadContractPdfOptions {
  contractId: string;
  role: 'LANDLORD' | 'TENANT';
  signatureIndex: number;
  metadata?: Record<string, string>;
}

@Injectable()
export class S3StorageService {
  private readonly s3Client: S3Client;

  constructor(
    @Inject(s3Config.KEY)
    private readonly s3: ConfigType<typeof s3Config>,
  ) {
    // Validate S3 configuration
    if (!this.s3.accessKeyId || !this.s3.secretAccessKey) {
      throw new Error(
        'AWS credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in environment variables.',
      );
    }

    if (!this.s3.bucketName) {
      throw new Error(
        'S3 bucket not configured. Please set AWS_S3_BUCKET in environment variables.',
      );
    }

    // Initialize S3 client
    this.s3Client = new S3Client({
      region: this.s3.region,
      credentials: {
        accessKeyId: this.s3.accessKeyId,
        secretAccessKey: this.s3.secretAccessKey,
      },
      ...(this.s3.endpoint && { endpoint: this.s3.endpoint }),
    });

    console.log(
      `✅ S3StorageService initialized - Region: ${this.s3.region}, Bucket: ${this.s3.bucketName}`,
    );
  }

  /**
   * Upload signed contract PDF to S3
   * Generates structured key: contracts/{contractId}/{role}-signed-{timestamp}.pdf
   */
  async uploadContractPdf(
    pdfBuffer: Buffer,
    options: UploadContractPdfOptions,
  ): Promise<UploadResult> {
    try {
      const { contractId, role, signatureIndex, metadata = {} } = options;

      // Validate inputs
      if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
        throw new BadRequestException('Invalid PDF buffer provided');
      }

      if (!contractId?.trim()) {
        throw new BadRequestException('Contract ID is required');
      }

      // Generate structured S3 key
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const key = `contracts/${contractId.trim()}/${role.toLowerCase()}-signed-${timestamp}.pdf`;

      // Prepare upload parameters
      const uploadParams: PutObjectCommandInput = {
        Bucket: this.s3.bucketName,
        Key: key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
        ContentDisposition: `attachment; filename="${role.toLowerCase()}-contract-${contractId}.pdf"`,
        Metadata: {
          contractId: contractId.trim(),
          role: role,
          signatureIndex: signatureIndex.toString(),
          uploadedAt: new Date().toISOString(),
          source: 'smartca-signing',
          ...metadata,
        },
        // Server-side encryption
        ServerSideEncryption: 'AES256',
        // Cache control
        CacheControl: 'private, no-cache',
      };

      console.log(
        `[S3Upload] Uploading ${role} contract PDF: ${key} (${pdfBuffer.length} bytes)`,
      );

      // Upload to S3
      const command = new PutObjectCommand(uploadParams);
      const result = await this.s3Client.send(command);

      // Generate public URL (if bucket allows public access) or signed URL
      const url = `https://${this.s3.bucketName}.s3.${this.s3.region}.amazonaws.com/${key}`;

      const uploadResult: UploadResult = {
        key,
        url,
        bucket: this.s3.bucketName,
        etag: result.ETag,
        size: pdfBuffer.length,
      };

      console.log(
        `[S3Upload] ✅ Upload successful: ${key} (ETag: ${result.ETag})`,
      );

      return uploadResult;
    } catch (error) {
      console.error('[S3Upload] ❌ Upload failed:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      // AWS S3 specific errors
      if (error.name === 'NoSuchBucket') {
        throw new BadRequestException(
          `S3 bucket '${this.s3.bucketName}' does not exist`,
        );
      }

      if (error.name === 'AccessDenied') {
        throw new BadRequestException(
          'Access denied to S3 bucket. Check AWS credentials and permissions.',
        );
      }

      throw new BadRequestException(
        `Failed to upload PDF to S3: ${error.message}`,
      );
    }
  }

  /**
   * Generate a presigned URL for downloading a contract PDF
   */
  async getSignedDownloadUrl(
    key: string,
    expiresInSeconds: number = 3600,
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.s3.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresInSeconds,
      });

      console.log(
        `[S3Download] Generated signed URL for ${key} (expires in ${expiresInSeconds}s)`,
      );

      return signedUrl;
    } catch (error) {
      console.error('[S3Download] ❌ Failed to generate signed URL:', error);
      throw new BadRequestException(
        `Failed to generate download URL: ${error.message}`,
      );
    }
  }

  /**
   * Delete a contract PDF from S3
   */
  async deleteContractPdf(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.s3.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);

      console.log(`[S3Delete] ✅ Deleted contract PDF: ${key}`);
    } catch (error) {
      console.error('[S3Delete] ❌ Failed to delete PDF:', error);
      throw new BadRequestException(
        `Failed to delete PDF from S3: ${error.message}`,
      );
    }
  }

  /**
   * List all contract PDFs for a specific contract ID
   */
  async listContractPdfs(contractId: string): Promise<string[]> {
    try {
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');

      const command = new ListObjectsV2Command({
        Bucket: this.s3.bucketName,
        Prefix: `contracts/${contractId}/`,
      });

      const result = await this.s3Client.send(command);
      const keys = result.Contents?.map((obj) => obj.Key).filter(Boolean) || [];

      console.log(
        `[S3List] Found ${keys.length} PDFs for contract ${contractId}`,
      );

      return keys as string[];
    } catch (error) {
      console.error('[S3List] ❌ Failed to list contract PDFs:', error);
      throw new BadRequestException(
        `Failed to list contract PDFs: ${error.message}`,
      );
    }
  }

  /**
   * Generate a presigned GET URL for temporary access to a file
   * Default expires in 5 minutes (300 seconds)
   */
  async getPresignedGetUrl(
    key: string,
    expiresInSeconds: number = 300,
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.s3.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresInSeconds,
      });

      console.log(
        `[S3GetUrl] Generated presigned GET URL for ${key} (expires in ${expiresInSeconds}s)`,
      );

      return signedUrl;
    } catch (error) {
      console.error(
        '[S3GetUrl] ❌ Failed to generate presigned GET URL:',
        error,
      );
      throw new BadRequestException(
        `Failed to generate presigned GET URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Generate upload URL for frontend to upload files directly to S3
   */
  async generateUploadUrl(
    key: string,
    contentType: string = 'application/pdf',
    expiresInSeconds: number = 3600,
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.s3.bucketName,
        Key: key,
        ContentType: contentType,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresInSeconds,
      });

      console.log(
        `[S3Upload] Generated presigned upload URL for ${key} (expires in ${expiresInSeconds}s)`,
      );

      return signedUrl;
    } catch (error) {
      console.error('[S3Upload] ❌ Failed to generate upload URL:', error);
      throw new BadRequestException(
        `Failed to generate upload URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Download file from S3 as Buffer
   */
  async downloadFile(key: string): Promise<Buffer> {
    try {
      console.log(`[S3Download] Downloading file: ${key}`);

      const command = new GetObjectCommand({
        Bucket: this.s3.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new BadRequestException(`File not found: ${key}`);
      }

      // Convert ReadableStream to Buffer
      const chunks: Uint8Array[] = [];
      const reader = response.Body.transformToWebStream().getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value as Uint8Array);
        }
      }

      const buffer = Buffer.concat(chunks);
      console.log(`[S3Download] ✅ Downloaded ${key}: ${buffer.length} bytes`);

      return buffer;
    } catch (error) {
      console.error('[S3Download] ❌ Failed to download file:', error);
      throw new BadRequestException(
        `Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Extract S3 key from full S3 URL
   */
  extractKeyFromUrl(s3Url: string): string {
    try {
      const url = new URL(s3Url);
      // Remove leading slash
      const key = url.pathname.substring(1);
      console.log(`[S3] Extracted key from URL: ${key}`);
      return key;
    } catch {
      throw new BadRequestException(`Invalid S3 URL format: ${s3Url}`);
    }
  }
}
