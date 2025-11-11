/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';
import fptAiConfig from 'src/config/fpt-ai.config';
import { FaceVerificationResponseDto } from './dto/face-verification.dto';

interface FptAiFaceCheckResponse {
  code: string;
  message: string;
  data?: {
    isMatch: boolean;
    similarity: number;
    isBothImgIDCard: boolean;
  };
}

@Injectable()
export class FaceVerificationService {
  private readonly FACE_VERIFICATION_ENDPOINT =
    'https://api.fpt.ai/dmp/checkface/v1';

  constructor(
    @Inject(fptAiConfig.KEY)
    private readonly fptAi: ConfigType<typeof fptAiConfig>,
  ) {}

  async verifyFace(
    faceImageBuffer: Buffer,
    cccdImageBuffer: Buffer,
    faceImageFilename: string,
    cccdImageFilename: string,
  ): Promise<FaceVerificationResponseDto> {
    try {
      // Validate FPT.AI configuration
      if (!this.fptAi.apiKey || this.fptAi.apiKey.trim() === '') {
        console.error('FPT.AI API key not configured or empty');
        throw new BadRequestException(
          'FPT.AI API key not configured. Please set FPT_AI_API_KEY in environment variables.',
        );
      }

      // Validate image buffers
      if (!Buffer.isBuffer(faceImageBuffer) || faceImageBuffer.length === 0) {
        throw new BadRequestException('Invalid face image buffer provided');
      }

      if (!Buffer.isBuffer(cccdImageBuffer) || cccdImageBuffer.length === 0) {
        throw new BadRequestException('Invalid CCCD image buffer provided');
      }

      // Validate file types
      const validateFileType = (filename: string, type: 'face' | 'cccd') => {
        const fileExtension = filename.split('.').pop()?.toLowerCase();
        if (!fileExtension || !['jpg', 'jpeg', 'png'].includes(fileExtension)) {
          throw new BadRequestException(
            `Invalid ${type} image file type. Only JPEG and PNG images are allowed.`,
          );
        }
        return fileExtension;
      };

      const faceExt = validateFileType(faceImageFilename, 'face');
      const cccdExt = validateFileType(cccdImageFilename, 'cccd');

      console.log('Starting face verification...');

      // Create FormData with 2 images
      // API expects file[] array with exactly 2 images
      const formData = new FormData();

      // First image: Face photo
      formData.append('file[]', faceImageBuffer, {
        filename: faceImageFilename,
        contentType: `image/${faceExt === 'jpg' ? 'jpeg' : faceExt}`,
      });

      // Second image: CCCD photo
      formData.append('file[]', cccdImageBuffer, {
        filename: cccdImageFilename,
        contentType: `image/${cccdExt === 'jpg' ? 'jpeg' : cccdExt}`,
      });

      // Call FPT.AI Face Verification API
      const response = await axios.post(
        this.FACE_VERIFICATION_ENDPOINT,
        formData,
        {
          headers: {
            'api-key': this.fptAi.apiKey,
            ...formData.getHeaders(),
          },
          timeout: 30000, // 30 seconds timeout
        },
      );

      console.log('FPT.AI Face Verification API response received');

      // Parse response data
      const responseData = response.data as FptAiFaceCheckResponse;

      // Handle response based on code
      const code = parseInt(responseData.code, 10);

      // Handle error codes
      if (code !== 200) {
        let errorMessage = 'Face verification failed';

        switch (code) {
          case 407:
            errorMessage =
              'Không nhận dạng được khuôn mặt trong một hoặc cả hai ảnh';
            break;
          case 408:
            errorMessage = 'Ảnh đầu vào không đúng định dạng';
            break;
          case 409:
            errorMessage =
              'Có nhiều hoặc ít hơn số lượng (2) khuôn mặt cần xác thực';
            break;
          default:
            errorMessage = responseData.message || 'Unknown error from FPT.AI';
        }

        throw new BadRequestException({
          statusCode: 400,
          message: errorMessage,
          errorCode: code,
        });
      }

      // Extract data from successful response
      const data = responseData.data;

      if (!data) {
        throw new BadRequestException('No data returned from FPT.AI API');
      }

      const result: FaceVerificationResponseDto = {
        isMatch: data.isMatch,
        similarity: data.similarity,
        isBothImgIDCard: data.isBothImgIDCard,
      };

      console.log('Face verification completed successfully');
      console.log('Verification Result:', {
        isMatch: result.isMatch,
        similarity: `${result.similarity.toFixed(2)}%`,
        isBothImgIDCard: result.isBothImgIDCard,
      });

      return result;
    } catch (error) {
      console.error('Error during face verification:', error);

      // Handle specific error types
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Handle axios errors
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const responseData = error.response?.data as any;

        // Handle specific HTTP status codes
        if (status === 401) {
          console.error('FPT.AI Authentication failed for face verification');
          throw new BadRequestException(
            'FPT.AI Authentication failed. Please check your API key configuration.',
          );
        }

        if (status === 403) {
          throw new BadRequestException(
            'FPT.AI Access forbidden. Your API key may not have permission for face verification service.',
          );
        }

        if (status === 429) {
          throw new BadRequestException(
            'FPT.AI Rate limit exceeded. Please try again later.',
          );
        }

        const errorMessage = String(
          responseData?.message ||
            error.message ||
            'FPT.AI Face Verification API error',
        );
        throw new BadRequestException(
          `FPT.AI API error (${status || 'Unknown'}): ${errorMessage}`,
        );
      }

      // Handle timeout errors
      if (error instanceof Error && error.message.includes('timeout')) {
        throw new BadRequestException(
          'Face verification timeout. Please try again.',
        );
      }

      // Handle other errors
      throw new BadRequestException(
        `Failed to verify face: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
