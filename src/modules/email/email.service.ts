import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: this.configService.get<string>('SMTP_SECURE') === 'true', // true for 465, false for other ports
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  /**
   * Send reset password email
   */
  async sendResetPasswordEmail(
    to: string,
    resetToken: string,
    userName?: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: `"TakaHome Support" <${this.configService.get<string>('SMTP_USER')}>`,
      to,
      subject: 'Reset Mật Khẩu - TakaHome',
      html: this.getResetPasswordTemplate(resetUrl, userName),
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Reset password email sent to: ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      throw new Error('Không thể gửi email. Vui lòng thử lại sau.');
    }
  }

  /**
   * Reset password email template
   */
  private getResetPasswordTemplate(resetUrl: string, userName?: string): string {
    return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Mật Khẩu</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f4f4f4;
        }
        .container {
          background-color: #ffffff;
          border-radius: 10px;
          padding: 40px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 32px;
          font-weight: bold;
          color: #071658;
          margin-bottom: 10px;
        }
        h1 {
          color: #333;
          font-size: 24px;
          margin-bottom: 20px;
        }
        p {
          margin-bottom: 15px;
          font-size: 16px;
        }
        .button-container {
          text-align: center;
          margin: 30px 0;
        }
        .reset-button {
          display: inline-block;
          padding: 15px 40px;
          background-color: #071658;
          color: #ffffff !important;
          text-decoration: none;
          border-radius: 5px;
          font-weight: bold;
          font-size: 16px;
          transition: background-color 0.3s;
        }
        .reset-button:hover {
          background-color: #071658;
        }
        .warning {
          background-color: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          font-size: 14px;
          color: #666;
          text-align: center;
        }
        .link {
          color: #4CAF50;
          word-break: break-all;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🏠 TakaHome</div>
        </div>
        
        <h1>Yêu cầu đặt lại mật khẩu</h1>
        
        <p>Xin chào ${userName || 'bạn'},</p>
        
        <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản TakaHome của bạn. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
        
        <div class="button-container">
          <a href="${resetUrl}" class="reset-button">Đặt lại mật khẩu</a>
        </div>
        
        <div class="warning">
          <strong>⚠️ Lưu ý quan trọng:</strong>
          <ul>
            <li>Link này chỉ có hiệu lực trong <strong>1 giờ</strong></li>
            <li>Link chỉ có thể sử dụng <strong>một lần</strong></li>
            <li>Không chia sẻ link này với bất kỳ ai</li>
          </ul>
        </div>
        
        <p>Nếu nút bên trên không hoạt động, bạn có thể click vào đường link sau vào trình duyệt:</p>
        <p class="link">${resetUrl}</p>
        
        <div class="footer">
          <p>Email này được gửi tự động, vui lòng không trả lời.</p>
          <p>Nếu bạn cần hỗ trợ, vui lòng liên hệ: <a href="mailto:support@takahome.com">support@takahome.com</a></p>
          <p>&copy; 2025 TakaHome. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }
}
