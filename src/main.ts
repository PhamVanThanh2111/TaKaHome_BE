import './polyfill';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';

// Custom Socket.IO Adapter for CORS
class CustomSocketIOAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:3001'],
        credentials: true,
        methods: ['GET', 'POST'],
      },
    });
    return server;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set up WebSocket adapter
  app.useWebSocketAdapter(new CustomSocketIOAdapter(app));

  // Bật CORS (cho phép frontend kết nối)
  app.enableCors({
    origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Dùng ValidationPipe toàn cục cho DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Xóa field thừa khi nhận body
      forbidNonWhitelisted: true, // Báo lỗi nếu có field thừa
      transform: true, // Tự động chuyển đổi type
    }),
  );

  // Nếu muốn tăng payload (cho upload ảnh lớn):
  // app.useBodyParser('json', { limit: '10mb' });

  const port = parseInt(process.env.PORT || '3000', 10);
  const host = '0.0.0.0';

  // ----- Swagger Setup -----
  const config = new DocumentBuilder()
    .setTitle('TakaHome (Real Estate Rental) API')
    .setDescription('API for TakaHome (Real Estate Rental) platform')
    .setVersion('1.0')
    .addBearerAuth() // Cho phép Authorize bằng JWT Bearer
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);
  // -------------------------

  // Graceful shutdown để thấy log khi Railway gửi SIGTERM
  app.enableShutdownHooks();
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    app
      .close()
      .then(() => {
        process.exit(0);
      })
      .catch((err) => {
        console.error('Error during app close:', err);
        process.exit(1);
      });
  });

  await app.listen(port, host);

  const url = await app.getUrl();
  console.log(`App is running on ${url}`);
  console.log(`Swagger is running on ${url.replace(/\/$/, '')}/api-docs`);
}

bootstrap().catch((err) => {
  console.error('Error during bootstrap:', err);
});
