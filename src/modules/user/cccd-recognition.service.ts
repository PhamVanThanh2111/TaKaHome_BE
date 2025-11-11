 
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';
import fptAiConfig from 'src/config/fpt-ai.config';
import { CccdRecognitionResponseDto } from './dto/cccd-recognition.dto';
import { CCCD_ERRORS } from 'src/common/constants/error-messages.constant';

interface FptAiResponse {
  error_code?: number;
  error_message?: string;
  data?: Array<{
    id?: string;
    name?: string;
    dob?: string;
    sex?: string;
    home?: string;
    address?: string;
    doe?: string;
    poi?: string;
  }>;
}

@Injectable()
export class CccdRecognitionService {
  constructor(
    @Inject(fptAiConfig.KEY)
    private readonly fptAi: ConfigType<typeof fptAiConfig>,
  ) {}

  async recognizeCccd(imageBuffer: Buffer, originalFilename: string): Promise<CccdRecognitionResponseDto> {
    try {
      // Validate FPT.AI configuration
      if (!this.fptAi.apiKey || this.fptAi.apiKey.trim() === '') {
        console.error('FPT.AI API key not configured or empty');
        throw new BadRequestException(CCCD_ERRORS.FPT_AI_API_KEY_NOT_CONFIGURED);
      }

      if (!this.fptAi.endpoint || this.fptAi.endpoint.trim() === '') {
        console.error('FPT.AI endpoint not configured or empty');
        throw new BadRequestException(CCCD_ERRORS.FPT_AI_ENDPOINT_NOT_CONFIGURED);
      }

      // Log configuration (safely)
      console.log('FPT.AI Configuration:', {
        endpoint: this.fptAi.endpoint,
        apiKeySet: !!this.fptAi.apiKey,
        apiKeyPrefix: this.fptAi.apiKey ? this.fptAi.apiKey.substring(0, 6) + '***' : 'NOT_SET'
      });

      // Validate image buffer
      if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
        throw new BadRequestException(CCCD_ERRORS.INVALID_IMAGE_BUFFER);
      }

      // Validate file type (only images)
      const fileExtension = originalFilename.split('.').pop()?.toLowerCase();
      if (!fileExtension || !['jpg', 'jpeg', 'png'].includes(fileExtension)) {
        throw new BadRequestException(CCCD_ERRORS.INVALID_IMAGE_BUFFER);
      }

      console.log(`Starting CCCD recognition for file: ${originalFilename}`);

      // Create FormData to mimic cURL -F "image=@..."
      const formData = new FormData();
      formData.append('image', imageBuffer, {
        filename: originalFilename,
        contentType: `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`,
      });

      // Call FPT.AI API
      const response = await axios.post(this.fptAi.endpoint, formData, {
        headers: {
          'api-key': this.fptAi.apiKey,
          ...formData.getHeaders(),
        },
        timeout: 30000, // 30 seconds timeout
      });

      console.log('FPT.AI API response received');

      // Parse response data
      const responseData = response.data as FptAiResponse;

      // Check if API returned error
      if (responseData.error_code || responseData.error_message) {
        throw new BadRequestException(CCCD_ERRORS.FPT_AI_API_ERROR);
      }

      // Extract data from response
      const data = responseData.data?.[0] || {};
      
      // Map FPT.AI response to our DTO format
      const result: CccdRecognitionResponseDto = {
        id: String(data.id || ''),
        name: String(data.name || ''),
        dob: String(data.dob || ''),
        sex: String(data.sex || ''),
        home: String(data.home || ''),
        address: String(data.address || ''),
        doe: String(data.doe || ''),
        poi: String(data.poi || ''),
      };

      console.log('CCCD recognition completed successfully');
      console.log('Recognized CCCD Data:', result);
      return result;

    } catch (error) {
      console.error('Error during CCCD recognition:', error);

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
          console.error('FPT.AI Authentication failed:', {
            status,
            data: responseData,
            apiKeyUsed: this.fptAi.apiKey
          });
          throw new BadRequestException(CCCD_ERRORS.FPT_AI_API_KEY_NOT_CONFIGURED);
        }
        
        if (status === 403) {
          throw new BadRequestException(CCCD_ERRORS.FPT_AI_API_KEY_NOT_CONFIGURED);
        }
        
        if (status === 429) {
          throw new BadRequestException(CCCD_ERRORS.CCCD_RECOGNITION_ERROR);
        }
        
        throw new BadRequestException(CCCD_ERRORS.FPT_AI_API_ERROR);
      }

      // Handle timeout errors
      if (error instanceof Error && error.message.includes('timeout')) {
        throw new BadRequestException(CCCD_ERRORS.CCCD_RECOGNITION_TIMEOUT);
      }

      // Handle other errors
      throw new BadRequestException(CCCD_ERRORS.CCCD_RECOGNITION_ERROR);
    }
  }
}