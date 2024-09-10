import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = new DocumentBuilder()
    .setTitle('SQS')
    .setDescription('SQS')
    .setVersion('1.0')
    .addTag('SQS operations') // Add tags to group routes in Swagger UI
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('consumer', app, document);
  await app.listen(3002);
}
bootstrap();
