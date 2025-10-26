import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ChatbotMessageDto } from './dto/chatbot-message.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';

@ApiTags('Chatbot')
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post('message')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Gửi tin nhắn cho Gemini chatbot',
    description:
      'Gửi tin nhắn cho AI chatbot để tư vấn bất động sản. Bot sẽ tự động tìm kiếm và trả về danh sách bất động sản phù hợp kèm URL.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Phản hồi từ chatbot',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: { type: 'string', example: 'SUCCESS' },
        data: {
          type: 'object',
          properties: {
            response: {
              type: 'string',
              example:
                'Tôi đã tìm thấy 5 căn nhà phù hợp với yêu cầu của bạn...',
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Tin nhắn không hợp lệ',
  })
  async sendMessage(
    @Body() chatbotMessageDto: ChatbotMessageDto,
  ): Promise<ResponseCommon<{ response: string }>> {
    try {
      const response = await this.chatbotService.processMessage(
        chatbotMessageDto.message,
      );

      return new ResponseCommon(HttpStatus.OK, 'SUCCESS', {
        response,
      });
    } catch {
      return new ResponseCommon(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'Lỗi khi xử lý tin nhắn',
        {
          response:
            'Xin lỗi, tôi gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.',
        },
      );
    }
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Khởi tạo lại cuộc trò chuyện',
    description: 'Reset lại cuộc trò chuyện với chatbot',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cuộc trò chuyện đã được khởi tạo lại',
  })
  resetChat(): ResponseCommon<{ response: string }> {
    const response = this.chatbotService.resetChat();

    return new ResponseCommon(HttpStatus.OK, 'SUCCESS', {
      response,
    });
  }
}
