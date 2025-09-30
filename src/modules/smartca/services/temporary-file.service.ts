import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as fs from 'fs/promises';
import * as path from 'path';

interface TemporaryFileInfo {
  buffer: Buffer;
  originalName: string;
  fileType: string;
  userId: string;
  docId: string;
  createdAt: Date;
  expiresAt: Date;
}

@Injectable()
export class TemporaryFileService {
  private readonly logger = new Logger(TemporaryFileService.name);
  private readonly tempFilesPath: string;
  private readonly fileCache = new Map<string, TemporaryFileInfo>();
  private readonly CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(private readonly configService: ConfigService) {
    this.tempFilesPath = this.configService.get<string>('SMARTCA_TEMP_FILES_PATH') || 
                        path.join(process.cwd(), 'storage', 'smartca', 'temp-files');
    this.ensureDirectoryExists();
    this.startCleanupTimer();
  }

  /**
   * Lưu file tạm thời trước khi ký
   */
  async storeTemporaryFile(
    fileBuffer: Buffer,
    docId: string,
    originalName: string,
    fileType: string,
    userId: string
  ): Promise<void> {
    const fileInfo: TemporaryFileInfo = {
      buffer: fileBuffer,
      originalName,
      fileType,
      userId,
      docId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.CACHE_EXPIRY_MS)
    };

    // Lưu vào memory cache
    this.fileCache.set(docId, fileInfo);

    // Lưu vào filesystem để backup
    try {
      const filePath = path.join(this.tempFilesPath, `${docId}_original.${fileType}`);
      await fs.writeFile(filePath, fileBuffer);
      
      const metadataPath = path.join(this.tempFilesPath, `${docId}_metadata.json`);
      await fs.writeFile(metadataPath, JSON.stringify({
        originalName,
        fileType,
        userId,
        docId,
        createdAt: fileInfo.createdAt,
        expiresAt: fileInfo.expiresAt
      }, null, 2));

      this.logger.log(`Temporary file stored: ${docId}`);
    } catch (error) {
      this.logger.error(`Failed to store temporary file ${docId}:`, error);
    }
  }

  /**
   * Lấy file tạm thời
   */
  async getTemporaryFile(docId: string): Promise<TemporaryFileInfo | null> {
    // Kiểm tra trong memory cache trước
    const cachedFile = this.fileCache.get(docId);
    if (cachedFile && cachedFile.expiresAt > new Date()) {
      return cachedFile;
    }

    // Nếu không có trong cache, thử load từ filesystem
    try {
      const metadataPath = path.join(this.tempFilesPath, `${docId}_metadata.json`);
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(metadataContent);

      // Kiểm tra expiry
      if (new Date(metadata.expiresAt) <= new Date()) {
        this.logger.log(`Temporary file expired: ${docId}`);
        await this.removeTemporaryFile(docId);
        return null;
      }

      const filePath = path.join(this.tempFilesPath, `${docId}_original.${metadata.fileType}`);
      const buffer = await fs.readFile(filePath);

      const fileInfo: TemporaryFileInfo = {
        buffer,
        originalName: metadata.originalName,
        fileType: metadata.fileType,
        userId: metadata.userId,
        docId: metadata.docId,
        createdAt: new Date(metadata.createdAt),
        expiresAt: new Date(metadata.expiresAt)
      };

      // Lưu lại vào cache
      this.fileCache.set(docId, fileInfo);

      return fileInfo;
    } catch (error) {
      this.logger.error(`Failed to get temporary file ${docId}:`, error);
      return null;
    }
  }

  /**
   * Xóa file tạm thời
   */
  async removeTemporaryFile(docId: string): Promise<void> {
    // Xóa từ cache
    this.fileCache.delete(docId);

    // Xóa từ filesystem
    try {
      const fileInfo = await this.getFileMetadata(docId);
      if (fileInfo) {
        const filePath = path.join(this.tempFilesPath, `${docId}_original.${fileInfo.fileType}`);
        const metadataPath = path.join(this.tempFilesPath, `${docId}_metadata.json`);

        await Promise.all([
          fs.unlink(filePath).catch(() => {}),
          fs.unlink(metadataPath).catch(() => {})
        ]);
      }

      this.logger.log(`Temporary file removed: ${docId}`);
    } catch (error) {
      this.logger.error(`Failed to remove temporary file ${docId}:`, error);
    }
  }

  /**
   * Lấy metadata của file
   */
  private async getFileMetadata(docId: string): Promise<any | null> {
    try {
      const metadataPath = path.join(this.tempFilesPath, `${docId}_metadata.json`);
      const content = await fs.readFile(metadataPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Cleanup expired files
   */
  private async cleanupExpiredFiles(): Promise<void> {
    try {
      const now = new Date();
      
      // Cleanup memory cache
      for (const [docId, fileInfo] of this.fileCache.entries()) {
        if (fileInfo.expiresAt <= now) {
          this.fileCache.delete(docId);
        }
      }

      // Cleanup filesystem
      const files = await fs.readdir(this.tempFilesPath);
      const metadataFiles = files.filter(f => f.endsWith('_metadata.json'));

      for (const metadataFile of metadataFiles) {
        try {
          const metadataPath = path.join(this.tempFilesPath, metadataFile);
          const content = await fs.readFile(metadataPath, 'utf8');
          const metadata = JSON.parse(content);

          if (new Date(metadata.expiresAt) <= now) {
            const docId = metadata.docId;
            await this.removeTemporaryFile(docId);
          }
        } catch (error) {
          this.logger.error(`Error processing metadata file ${metadataFile}:`, error);
        }
      }

      this.logger.log('Temporary files cleanup completed');
    } catch (error) {
      this.logger.error('Error during cleanup:', error);
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    // Cleanup every hour
    setInterval(() => {
      this.cleanupExpiredFiles();
    }, 60 * 60 * 1000);

    // Run initial cleanup after 5 minutes
    setTimeout(() => {
      this.cleanupExpiredFiles();
    }, 5 * 60 * 1000);
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(): Promise<void> {
    try {
      await fs.mkdir(this.tempFilesPath, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create temporary files directory:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalFiles: number;
    expiredFiles: number;
    activeFiles: number;
  } {
    const now = new Date();
    let expiredFiles = 0;
    let activeFiles = 0;

    for (const fileInfo of this.fileCache.values()) {
      if (fileInfo.expiresAt <= now) {
        expiredFiles++;
      } else {
        activeFiles++;
      }
    }

    return {
      totalFiles: this.fileCache.size,
      expiredFiles,
      activeFiles
    };
  }
}