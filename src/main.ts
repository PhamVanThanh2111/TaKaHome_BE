import './polyfill';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Bật CORS (cho phép frontend kết nối)
  app.enableCors();

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

  const port = process.env.PORT || 3000;

  // ----- Swagger Setup -----
  const config = new DocumentBuilder()
    .setTitle('Real Estate Rental API')
    .setDescription('API for Real Estate Rental platform')
    .setVersion('1.0')
    .addBearerAuth() // Cho phép Authorize bằng JWT Bearer
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);
  // -------------------------

  await app.listen(port);
  console.log(`Swagger is running on http://localhost:${port}/api-docs`);
}

bootstrap().catch((err) => {
  console.error('Error during bootstrap:', err);
});
