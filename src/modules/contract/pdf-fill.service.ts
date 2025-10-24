import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument, PDFTextField } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PdfFillService {
  private readonly logger = new Logger(PdfFillService.name);

  /**
   * Điền thông tin vào PDF template với các field đã định nghĩa sẵn
   */
  async fillPdfTemplate(fieldValues: Record<string, string>): Promise<Buffer> {
    try {
      // Đường dẫn đến file template
      const templatePath = path.join(
        process.cwd(),
        'src',
        'assets',
        'contracts',
        'hopdongthue-template.pdf',
      );

      // Đọc file template
      const templateBytes = fs.readFileSync(templatePath);
      const pdfDoc = await PDFDocument.load(templateBytes);

      // Lấy form từ PDF
      const form = pdfDoc.getForm();

      // Lấy tất cả các fields trong PDF
      const fields = form.getFields();

      this.logger.log(`Found ${fields.length} fields in PDF template`);

      // Log tên các field để debug
      fields.forEach((field) => {
        const fieldName = field.getName();
        this.logger.log(
          `Field found: ${fieldName} (Type: ${field.constructor.name})`,
        );
      });

      // Điền thông tin vào các field
      Object.entries(fieldValues).forEach(([fieldName, value]) => {
        try {
          const field = form.getField(fieldName);

          if (field instanceof PDFTextField) {
            field.setText(value);
            this.logger.log(
              `✅ Filled field "${fieldName}" with value: ${value}`,
            );
          } else {
            this.logger.warn(`⚠️ Field "${fieldName}" is not a text field`);
          }
        } catch {
          this.logger.warn(`⚠️ Field "${fieldName}" not found in template`);
        }
      });

      // Flatten form để các field không còn editable
      form.flatten();

      // Lưu PDF đã điền thông tin
      const pdfBytes = await pdfDoc.save();

      this.logger.log(
        `✅ PDF filled successfully, size: ${pdfBytes.length} bytes`,
      );

      return Buffer.from(pdfBytes);
    } catch (error) {
      this.logger.error('❌ Error filling PDF template:', error);
      throw error;
    }
  }

  /**
   * Lấy danh sách các field có trong PDF template
   */
  async getTemplateFields(): Promise<string[]> {
    try {
      const templatePath = path.join(
        process.cwd(),
        'src',
        'assets',
        'contracts',
        'HopDongChoThueNhaTro.pdf',
      );

      const templateBytes = fs.readFileSync(templatePath);
      const pdfDoc = await PDFDocument.load(templateBytes);
      const form = pdfDoc.getForm();
      const fields = form.getFields();

      return fields.map((field) => field.getName());
    } catch (error) {
      this.logger.error('❌ Error reading PDF template fields:', error);
      throw error;
    }
  }
}
