import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';
import fptAiConfig from '../../../config/fpt-ai.config';
import { CccdRecognitionResponseDto } from '../dto/cccd-recognition.dto';

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
        throw new BadRequestException('FPT.AI API key not configured. Please set FPT_AI_API_KEY in environment variables.');
      }

      if (!this.fptAi.endpoint || this.fptAi.endpoint.trim() === '') {
        console.error('FPT.AI endpoint not configured or empty');
        throw new BadRequestException('FPT.AI endpoint not configured. Please set FPT_AI_ENDPOINT in environment variables.');
      }

      // Log configuration (safely)
      console.log('FPT.AI Configuration:', {
        endpoint: this.fptAi.endpoint,
        apiKeySet: !!this.fptAi.apiKey,
        apiKeyPrefix: this.fptAi.apiKey ? this.fptAi.apiKey.substring(0, 6) + '***' : 'NOT_SET'
      });

      // Validate image buffer
      if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
        throw new BadRequestException('Invalid image buffer provided');
      }

      // Validate file type (only images)
      const fileExtension = originalFilename.split('.').pop()?.toLowerCase();
      if (!fileExtension || !['jpg', 'jpeg', 'png'].includes(fileExtension)) {
        throw new BadRequestException(
          'Invalid file type. Only JPEG and PNG images are allowed for CCCD recognition.',
        );
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
        throw new BadRequestException(
          `FPT.AI API error: ${responseData.error_message || 'Unknown error'}`,
        );
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
          throw new BadRequestException(
            'FPT.AI Authentication failed. Please check your API key configuration.'
          );
        }
        
        if (status === 403) {
          throw new BadRequestException(
            'FPT.AI Access forbidden. Your API key may not have permission for this service.'
          );
        }
        
        if (status === 429) {
          throw new BadRequestException(
            'FPT.AI Rate limit exceeded. Please try again later.'
          );
        }
        
        const errorMessage = String(
          responseData?.message || 
          responseData?.error_message || 
          error.message || 
          'FPT.AI API error'
        );
        throw new BadRequestException(`FPT.AI API error (${status || 'Unknown'}): ${errorMessage}`);
      }

      // Handle timeout errors
      if (error instanceof Error && error.message.includes('timeout')) {
        throw new BadRequestException('CCCD recognition timeout. Please try again.');
      }

      // Handle other errors
      throw new BadRequestException(
        `Failed to recognize CCCD: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}