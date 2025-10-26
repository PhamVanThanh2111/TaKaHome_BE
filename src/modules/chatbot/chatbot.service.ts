/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import {
  GoogleGenerativeAI,
  FunctionDeclaration,
  SchemaType,
  FunctionCallingMode,
} from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ChatbotService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.initializeGemini();
  }

  private initializeGemini() {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);

    const searchPropertiesFunction: FunctionDeclaration = {
      name: 'search_properties',
      description:
        'Tìm kiếm và lọc bất động sản theo tiêu chí của người dùng, trả về danh sách kết quả kèm URL để truy cập',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          q: {
            type: SchemaType.STRING,
            description:
              'Khu vực, chỗ ở, từ khóa tìm kiếm, quận hoặc thành phố',
          },
          type: {
            type: SchemaType.STRING,
            description:
              'Loại bất động sản: HOUSING (nhà riêng), APARTMENT (chung cư), BOARDING (nhà trọ)',
          },
          fromPrice: {
            type: SchemaType.NUMBER,
            description: 'Giá tối thiểu (VND)',
          },
          toPrice: {
            type: SchemaType.NUMBER,
            description: 'Giá tối đa (VND)',
          },
          minArea: {
            type: SchemaType.NUMBER,
            description: 'Diện tích tối thiểu (m²)',
          },
          maxArea: {
            type: SchemaType.NUMBER,
            description: 'Diện tích tối đa (m²)',
          },
          bedrooms: {
            type: SchemaType.NUMBER,
            description: 'Số phòng ngủ',
          },
          bathrooms: {
            type: SchemaType.NUMBER,
            description: 'Số phòng tắm',
          },
          sortBy: {
            type: SchemaType.STRING,
            description:
              'Sắp xếp theo: price (giá), area (diện tích), createdAt (ngày tạo)',
          },
          sortOrder: {
            type: SchemaType.STRING,
            description: 'Thứ tự sắp xếp: ASC (tăng dần), DESC (giảm dần)',
          },
          limit: {
            type: SchemaType.NUMBER,
            description: 'Số lượng kết quả tối đa (mặc định: 10)',
          },
        },
        required: [],
      },
    };

    // Khởi tạo model với tool
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [
        {
          functionDeclarations: [searchPropertiesFunction],
        },
      ],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingMode.AUTO,
        },
      },
    });
  }

  /**
   * Xử lý tin nhắn từ người dùng và trả về phản hồi từ Gemini
   */
  async processMessage(message: string): Promise<string> {
    try {
      const chat = this.model.startChat({
        history: [
          {
            role: 'user',
            parts: [
              {
                text: `Bạn là trợ lý tư vấn bất động sản. Khi người dùng nhắc đến TÌM KIẾM/THUÊ/MUA bất động sản, bạn PHẢI gọi function search_properties.
                Các từ khóa cần chú ý: tìm, thuê, mua, nhà trọ, chung cư, nhà riêng, apartment, boarding, housing.
                VÍ DỤ:
                - "tìm nhà trọ 3-5 triệu" → gọi search_properties với propertyType="BOARDING", minPrice=3000000, maxPrice=5000000
                - "thuê chung cư 2 phòng ngủ" → gọi search_properties với propertyType="APARTMENT", bedrooms=2
                Hãy trả lời bằng tiếng Việt và thân thiện.`,
              },
            ],
          },
          {
            role: 'model',
            parts: [
              {
                text: 'Tôi hiểu! Tôi sẽ giúp bạn tìm kiếm bất động sản bằng cách sử dụng function search_properties mỗi khi bạn có yêu cầu tìm kiếm.',
              },
            ],
          },
        ],
      });

      const result = await chat.sendMessage(message);
      const response = result.response;

      // Debug logging
      console.log('🔍 Gemini Response Debug:');
      console.log('- Message:', message);

      // Truy cập function calls đúng cách từ candidates
      const candidates = (response as any).candidates;
      let functionCall = null;

      if (candidates && candidates.length > 0) {
        const parts = candidates[0].content?.parts;
        if (parts && parts.length > 0) {
          for (const part of parts) {
            if (part.functionCall) {
              functionCall = part.functionCall;
              break;
            }
          }
        }
      }

      console.log('- Has functionCall:', !!functionCall);
      if (functionCall) {
        console.log('- FunctionCall name:', (functionCall as any).name);
        console.log(
          '- FunctionCall args:',
          JSON.stringify((functionCall as any).args, null, 2),
        );
      }

      // Xử lý function calls nếu có
      if (functionCall && (functionCall as any).name === 'search_properties') {
        console.log(
          '🔍 Calling search_properties with args:',
          (functionCall as any).args,
        );

        // Gọi API search properties
        const searchResults = await this.searchProperties(
          (functionCall as any).args,
        );

        console.log(
          '🔍 Search results:',
          JSON.stringify(searchResults, null, 2),
        );

        // Gửi kết quả lại cho model để tạo phản hồi
        const functionResponse = {
          functionResponse: {
            name: 'search_properties',
            response: {
              content: searchResults,
            },
          },
        };

        const finalResult = await chat.sendMessage([functionResponse]);
        const finalResponse = finalResult.response.text();
        console.log('🔍 Final response:', finalResponse);
        return finalResponse;
      }

      return response.text();
    } catch (error) {
      console.error('Error processing message:', error);
      return 'Xin lỗi, tôi gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.';
    }
  }

  /**
   * Gọi API search properties
   */
  private async searchProperties(params: any): Promise<any> {
    try {
      const backendUrl = 'http://localhost:3000'; // URL của backend hiện tại
      const apiUrl = `${backendUrl}/properties/filter-with-url`;

      // Map parameters từ Gemini sang API format
      const mappedParams: any = {};

      // Map giá
      if (params.fromPrice) mappedParams.fromPrice = params.fromPrice;
      if (params.minPrice) mappedParams.fromPrice = params.minPrice;
      if (params.toPrice) mappedParams.toPrice = params.toPrice;
      if (params.maxPrice) mappedParams.toPrice = params.maxPrice;

      // Map loại bất động sản
      if (params.type) mappedParams.type = params.type;
      if (params.propertyType) mappedParams.type = params.propertyType;

      // Map diện tích
      if (params.fromArea || params.minArea)
        mappedParams.fromArea = params.fromArea || params.minArea;
      if (params.toArea || params.maxArea)
        mappedParams.toArea = params.toArea || params.maxArea;

      // Map các thuộc tính khác
      if (params.bedrooms) mappedParams.bedrooms = params.bedrooms;
      if (params.bathrooms) mappedParams.bathrooms = params.bathrooms;
      if (params.q) mappedParams.q = params.q;
      if (params.limit) mappedParams.limit = params.limit;
      if (params.sortBy) mappedParams.sortBy = params.sortBy;
      if (params.sortOrder) mappedParams.sortOrder = params.sortOrder;

      // Loại bỏ các tham số undefined/null
      const cleanParams = Object.fromEntries(
        Object.entries(mappedParams).filter(
          ([_, value]) => value !== undefined && value !== null,
        ),
      );

      console.log('🔍 API Call params:', cleanParams);

      const response = await firstValueFrom(
        this.httpService.get(apiUrl, {
          params: cleanParams,
        }),
      );

      return response.data;
    } catch (error) {
      console.error('Error calling search properties API:', error);
      return {
        statusCode: 500,
        message: 'Lỗi khi tìm kiếm bất động sản',
        data: {
          data: [],
          total: 0,
          message: 'Không thể tìm kiếm bất động sản lúc này',
        },
      };
    }
  }

  /**
   * Khởi tạo lại cuộc trò chuyện
   */
  resetChat(): string {
    return 'Cuộc trò chuyện đã được khởi tạo lại. Tôi có thể giúp gì cho bạn?';
  }
}
