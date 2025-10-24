import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument, PDFTextField } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

export enum PdfTemplateType {
  HOP_DONG_CHO_THUE_NHA_NGUYEN_CAN = 'HopDongChoThueNhaNguyenCan',
  HOP_DONG_CHO_THUE_NHA_TRO = 'HopDongChoThueNhaTro',
  PHU_LUC_HOP_DONG_GIA_HAN = 'PhuLucHopDongGiaHan',
}

@Injectable()
export class PdfFillService {
  private readonly logger = new Logger(PdfFillService.name);

  /**
   * Lấy đường dẫn file template theo loại
   */
  private getTemplatePath(templateType: PdfTemplateType): string {
    const fileName = `${templateType}.pdf`;
    return path.join(
      process.cwd(),
      'src',
      'assets',
      'contracts',
      fileName,
    );
  }

  /**
   * Điền thông tin vào PDF template với các field đã định nghĩa sẵn
   */
  async fillPdfTemplate(
    fieldValues: Record<string, string>,
    templateType: PdfTemplateType = PdfTemplateType.HOP_DONG_CHO_THUE_NHA_NGUYEN_CAN,
  ): Promise<Buffer> {
    try {
      // Đường dẫn đến file template
      const templatePath = this.getTemplatePath(templateType);

      // Kiểm tra file tồn tại
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template file not found: ${templatePath}`);
      }

      // Đọc file template
      const templateBytes = fs.readFileSync(templatePath);
      const pdfDoc = await PDFDocument.load(templateBytes);

      // Lấy form từ PDF
      const form = pdfDoc.getForm();

      // Lấy tất cả các fields trong PDF
      const fields = form.getFields();

      this.logger.log(`Found ${fields.length} fields in PDF template: ${templateType}`);

      // Log tên các field để debug
      fields.forEach((field) => {
        const fieldName = field.getName();
        this.logger.log(
          `Field found: ${fieldName} (Type: ${field.constructor.name})`,
        );
      });

      // Điền thông tin vào các field
      Object.entries(fieldValues).forEach(([fieldName, value]) => {
        if (!value) return; // Bỏ qua nếu value là null, undefined hoặc empty string

        try {
          const field = form.getField(fieldName);

          if (field instanceof PDFTextField) {
            // Xử lý tiếng Việt bằng cách encode UTF-8
            const processedValue = this.processVietnameseText(value);
            field.setText(processedValue);
            this.logger.log(
              `✅ Filled field "${fieldName}" with value: ${processedValue}`,
            );
          } else {
            this.logger.warn(`⚠️ Field "${fieldName}" is not a text field`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(`⚠️ Field "${fieldName}" not found in template: ${errorMessage}`);
          // Không throw error, chỉ log warning để tiếp tục với các field khác
        }
      });

      // Flatten form để các field không còn editable
      form.flatten();

      // Lưu PDF đã điền thông tin
      const pdfBytes = await pdfDoc.save();

      this.logger.log(
        `✅ PDF filled successfully, template: ${templateType}, size: ${pdfBytes.length} bytes`,
      );

      return Buffer.from(pdfBytes);
    } catch (error) {
      this.logger.error(`❌ Error filling PDF template (${templateType}):`, error);
      throw error;
    }
  }

  /**
   * Xử lý text tiếng Việt để tương thích với PDF
   * Chuyển đổi ký tự tiếng Việt có dấu thành ký tự Latin không dấu
   */
  private processVietnameseText(text: string): string {
    try {
      // Bảng chuyển đổi ký tự tiếng Việt sang Latin
      const vietnameseMap: Record<string, string> = {
        // Chữ a
        'à': 'a', 'á': 'a', 'ạ': 'a', 'ả': 'a', 'ã': 'a',
        'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ậ': 'a', 'ẩ': 'a', 'ẫ': 'a',
        'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ặ': 'a', 'ẳ': 'a', 'ẵ': 'a',
        'À': 'A', 'Á': 'A', 'Ạ': 'A', 'Ả': 'A', 'Ã': 'A',
        'Â': 'A', 'Ầ': 'A', 'Ấ': 'A', 'Ậ': 'A', 'Ẩ': 'A', 'Ẫ': 'A',
        'Ă': 'A', 'Ằ': 'A', 'Ắ': 'A', 'Ặ': 'A', 'Ẳ': 'A', 'Ẵ': 'A',

        // Chữ e
        'è': 'e', 'é': 'e', 'ẹ': 'e', 'ẻ': 'e', 'ẽ': 'e',
        'ê': 'e', 'ề': 'e', 'ế': 'e', 'ệ': 'e', 'ể': 'e', 'ễ': 'e',
        'È': 'E', 'É': 'E', 'Ẹ': 'E', 'Ẻ': 'E', 'Ẽ': 'E',
        'Ê': 'E', 'Ề': 'E', 'Ế': 'E', 'Ệ': 'E', 'Ể': 'E', 'Ễ': 'E',

        // Chữ i
        'ì': 'i', 'í': 'i', 'ị': 'i', 'ỉ': 'i', 'ĩ': 'i',
        'Ì': 'I', 'Í': 'I', 'Ị': 'I', 'Ỉ': 'I', 'Ĩ': 'I',

        // Chữ o
        'ò': 'o', 'ó': 'o', 'ọ': 'o', 'ỏ': 'o', 'õ': 'o',
        'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ộ': 'o', 'ổ': 'o', 'ỗ': 'o',
        'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ợ': 'o', 'ở': 'o', 'ỡ': 'o',
        'Ò': 'O', 'Ó': 'O', 'Ọ': 'O', 'Ỏ': 'O', 'Õ': 'O',
        'Ô': 'O', 'Ồ': 'O', 'Ố': 'O', 'Ộ': 'O', 'Ổ': 'O', 'Ỗ': 'O',
        'Ơ': 'O', 'Ờ': 'O', 'Ớ': 'O', 'Ợ': 'O', 'Ở': 'O', 'Ỡ': 'O',

        // Chữ u
        'ù': 'u', 'ú': 'u', 'ụ': 'u', 'ủ': 'u', 'ũ': 'u',
        'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ự': 'u', 'ử': 'u', 'ữ': 'u',
        'Ù': 'U', 'Ú': 'U', 'Ụ': 'U', 'Ủ': 'U', 'Ũ': 'U',
        'Ư': 'U', 'Ừ': 'U', 'Ứ': 'U', 'Ự': 'U', 'Ử': 'U', 'Ữ': 'U',

        // Chữ y
        'ỳ': 'y', 'ý': 'y', 'ỵ': 'y', 'ỷ': 'y', 'ỹ': 'y',
        'Ỳ': 'Y', 'Ý': 'Y', 'Ỵ': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y',

        // Chữ đ
        'đ': 'd', 'Đ': 'D'
      };

      // Chuyển đổi từng ký tự
      let result = text;
      for (const [vietnamese, latin] of Object.entries(vietnameseMap)) {
        result = result.replace(new RegExp(vietnamese, 'g'), latin);
      }

      // Normalize Unicode và loại bỏ các ký tự đặc biệt khác
      result = result.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      this.logger.log(`Converted Vietnamese text: "${text}" -> "${result}"`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Warning processing Vietnamese text: ${errorMessage}`);
      return text;
    }
  }

  /**
   * Lấy danh sách các field có trong PDF template
   */
  async getTemplateFields(templateType: PdfTemplateType = PdfTemplateType.HOP_DONG_CHO_THUE_NHA_TRO): Promise<string[]> {
    try {
      const templatePath = this.getTemplatePath(templateType);

      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template file not found: ${templatePath}`);
      }

      const templateBytes = fs.readFileSync(templatePath);
      const pdfDoc = await PDFDocument.load(templateBytes);
      const form = pdfDoc.getForm();
      const fields = form.getFields();

      return fields.map((field) => field.getName());
    } catch (error) {
      this.logger.error(`❌ Error reading PDF template fields (${templateType}):`, error);
      throw error;
    }
  }
}
