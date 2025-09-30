import { Injectable, Logger } from "@nestjs/common";
import { SignedDocumentMetadataDto } from "../dto/webhook";

export interface NotificationPayload {
  userId: string;
  docId: string;
  transactionId: string;
  status: 'signed' | 'failed';
  message: string;
  signedAt?: Date;
  originalFileName: string;
  fileType: string;
}

@Injectable()
export class SmartCANotificationService {
  private readonly logger = new Logger(SmartCANotificationService.name);

  /**
   * Gửi thông báo khi file đã được ký xong
   */
  async notifySigningCompleted(metadata: SignedDocumentMetadataDto): Promise<void> {
    try {
      const payload: NotificationPayload = {
        userId: metadata.user_id || '',
        docId: metadata.doc_id,
        transactionId: metadata.transaction_id,
        status: 'signed',
        message: `File "${metadata.original_filename}" đã được ký số thành công`,
        signedAt: metadata.signed_at,
        originalFileName: metadata.original_filename,
        fileType: metadata.file_type
      };

      // TODO: Integrate với notification module của hệ thống
      await this.sendNotification(payload);

      this.logger.log(`Notification sent for signed document: ${metadata.doc_id}`);
    } catch (error) {
      this.logger.error(`Failed to send notification for ${metadata.doc_id}:`, error);
    }
  }

  /**
   * Gửi thông báo khi quá trình ký thất bại
   */
  async notifySigningFailed(
    docId: string, 
    transactionId: string, 
    userId: string, 
    originalFileName: string, 
    error: string
  ): Promise<void> {
    try {
      const payload: NotificationPayload = {
        userId,
        docId,
        transactionId,
        status: 'failed',
        message: `Ký số file "${originalFileName}" thất bại: ${error}`,
        originalFileName,
        fileType: 'unknown'
      };

      await this.sendNotification(payload);

      this.logger.log(`Failure notification sent for document: ${docId}`);
    } catch (error) {
      this.logger.error(`Failed to send failure notification for ${docId}:`, error);
    }
  }

  /**
   * Gửi thông báo thực tế
   */
  private async sendNotification(payload: NotificationPayload): Promise<void> {
    // TODO: Implement actual notification logic
    // Có thể gửi qua:
    // - WebSocket để realtime notification
    // - Email
    // - Push notification
    // - Database notification table
    // - Queue system (Redis/RabbitMQ)

    this.logger.log(`Sending notification to user ${payload.userId}:`, {
      docId: payload.docId,
      status: payload.status,
      message: payload.message
    });

    // Placeholder: Log notification thay vì gửi thực tế
    // Trong production, implement logic gửi notification thực tế ở đây
  }

  /**
   * Gửi thông báo qua WebSocket (placeholder)
   */
  private async sendWebSocketNotification(payload: NotificationPayload): Promise<void> {
    // TODO: Integrate với WebSocket gateway
    this.logger.log(`WebSocket notification for user ${payload.userId}:`, payload);
  }

  /**
   * Gửi email notification (placeholder)
   */
  private async sendEmailNotification(payload: NotificationPayload): Promise<void> {
    // TODO: Integrate với email service
    this.logger.log(`Email notification for user ${payload.userId}:`, payload);
  }

  /**
   * Lưu notification vào database (placeholder)
   */
  private async saveNotificationToDatabase(payload: NotificationPayload): Promise<void> {
    // TODO: Integrate với notification entity/repository
    this.logger.log(`Database notification for user ${payload.userId}:`, payload);
  }
}