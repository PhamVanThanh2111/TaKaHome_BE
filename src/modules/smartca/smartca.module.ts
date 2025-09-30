import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { MulterModule } from "@nestjs/platform-express";
import { SmartCAService } from "./services/smartca.service";
import { SmartCAWebhookService } from "./services/smartca-webhook.service";
import { TemporaryFileService } from "./services/temporary-file.service";
import { SmartCANotificationService } from "./services/smartca-notification.service";
import { SmartCAController } from "./controllers/smartca.controller";

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB file size limit
      },
      fileFilter: (req, file, cb) => {
        // Allow PDF and XML files
        const allowedMimes = [
          'application/pdf',
          'application/xml',
          'text/xml',
          'application/json',
          'text/plain'
        ];
        
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only PDF, XML, JSON and text files are allowed.'), false);
        }
      },
    }),
  ],
  providers: [SmartCAService, SmartCAWebhookService, TemporaryFileService, SmartCANotificationService],
  controllers: [SmartCAController],
  exports: [SmartCAService, SmartCAWebhookService, TemporaryFileService, SmartCANotificationService],
})
export class SmartCAModule {}
