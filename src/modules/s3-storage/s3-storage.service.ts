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
  }

  /**
   * Generic file upload helper
   */
  async uploadFile(
    buffer: Buffer,
    key: string,
    contentType = 'application/octet-stream',
    metadata: Record<string, string> = {},
  ): Promise<UploadResult> {
    try {
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new BadRequestException('Invalid file buffer');
      }

      const uploadParams: PutObjectCommandInput = {
        Bucket: this.s3.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          uploadedAt: new Date().toISOString(),
          ...metadata,
        },
        ServerSideEncryption: 'AES256',
        CacheControl: 'private, no-cache',
      };

      const command = new PutObjectCommand(uploadParams);
      const result = await this.s3Client.send(command);

      const url = `https://${this.s3.bucketName}.s3.${this.s3.region}.amazonaws.com/${key}`;

      return {
        key,
        url,
        bucket: this.s3.bucketName,
        etag: result.ETag,
        size: buffer.length,
      };
    } catch (error) {
      console.error('[S3Upload] ❌ uploadFile failed:', error);
      throw new BadRequestException(
        `Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
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

      return uploadResult;
    } catch (error) {
      console.error('[S3Upload] ❌ Upload failed:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      // AWS S3 specific errors
      if (error instanceof Error && error.name === 'NoSuchBucket') {
        throw new BadRequestException(
          `S3 bucket '${this.s3.bucketName}' does not exist`,
        );
      }

      if (error instanceof Error && error.name === 'AccessDenied') {
        throw new BadRequestException(
          'Access denied to S3 bucket. Check AWS credentials and permissions.',
        );
      }

      throw new BadRequestException(
        `Failed to upload PDF to S3: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

      return signedUrl;
    } catch (error) {
      console.error('[S3Download] ❌ Failed to generate signed URL:', error);
      throw new BadRequestException(
        `Failed to generate download URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    } catch (error) {
      console.error('[S3Delete] ❌ Failed to delete PDF:', error);
      throw new BadRequestException(
        `Failed to delete PDF from S3: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

      return keys as string[];
    } catch (error) {
      console.error('[S3List] ❌ Failed to list contract PDFs:', error);
      throw new BadRequestException(
        `Failed to list contract PDFs: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
        const result = await reader.read();
        if (result.done) break;
        if (result.value) {
          chunks.push(result.value as Uint8Array);
        }
      }

      const buffer = Buffer.concat(chunks);

      return buffer;
    } catch (error) {
      console.error('[S3Download] ❌ Failed to download file:', error);
      throw new BadRequestException(
        `Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Upload user avatar to S3
   * Generates structured key: avatar/{userId}/{filename}.{ext}
   */
  async uploadAvatar(
    avatarBuffer: Buffer,
    userId: string,
    originalFilename: string,
    contentType: string = 'image/jpeg',
  ): Promise<UploadResult> {
    try {
      // Validate inputs
      if (!Buffer.isBuffer(avatarBuffer) || avatarBuffer.length === 0) {
        throw new BadRequestException('Invalid avatar buffer provided');
      }

      if (!userId?.trim()) {
        throw new BadRequestException('User ID is required');
      }

      if (!originalFilename?.trim()) {
        throw new BadRequestException('Original filename is required');
      }

      // Validate file type (only images)
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(contentType)) {
        throw new BadRequestException(
          'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.',
        );
      }

      // Extract file extension
      const fileExtension = originalFilename.split('.').pop()?.toLowerCase() || 'jpg';
      
      // Generate unique filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `avatar-${timestamp}.${fileExtension}`;
      
      // Generate structured S3 key
      const key = `avatar/${userId.trim()}/${filename}`;

      // Prepare upload parameters
      const uploadParams: PutObjectCommandInput = {
        Bucket: this.s3.bucketName,
        Key: key,
        Body: avatarBuffer,
        ContentType: contentType,
        ContentDisposition: `inline; filename="${filename}"`,
        Metadata: {
          userId: userId.trim(),
          originalFilename: originalFilename,
          uploadedAt: new Date().toISOString(),
          source: 'avatar-upload',
        },
        // Server-side encryption
        ServerSideEncryption: 'AES256',
        // Cache control for images
        CacheControl: 'public, max-age=31536000', // 1 year cache
      };

      // Upload to S3
      const command = new PutObjectCommand(uploadParams);
      const result = await this.s3Client.send(command);

      // Generate public URL
      const url = `https://${this.s3.bucketName}.s3.${this.s3.region}.amazonaws.com/${key}`;

      const uploadResult: UploadResult = {
        key,
        url,
        bucket: this.s3.bucketName,
        etag: result.ETag,
        size: avatarBuffer.length,
      };

      return uploadResult;
    } catch (error) {
      console.error('[S3Upload] ❌ Avatar upload failed:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      // AWS S3 specific errors
      if (error instanceof Error && error.name === 'NoSuchBucket') {
        throw new BadRequestException(
          `S3 bucket '${this.s3.bucketName}' does not exist`,
        );
      }

      if (error instanceof Error && error.name === 'AccessDenied') {
        throw new BadRequestException(
          'Access denied to S3 bucket. Check AWS credentials and permissions.',
        );
      }

      throw new BadRequestException(
        `Failed to upload avatar to S3: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Delete user avatar from S3
   */
  async deleteAvatar(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.s3.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('[S3Delete] ❌ Failed to delete avatar:', error);
      throw new BadRequestException(
        `Failed to delete avatar from S3: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      return key;
    } catch {
      throw new BadRequestException(`Invalid S3 URL format: ${s3Url}`);
    }
  }
}
