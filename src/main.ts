import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, raw, urlencoded } from 'express';
import helmet from 'helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser'; 
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  // bodyParser: false — we register body parsers manually so the Stripe webhook
  // route receives a raw Buffer before the JSON parser can consume the stream.
  const app = await NestFactory.create(AppModule, {
    cors: true,
    bodyParser: false,
  });

  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Raw body for Stripe signature verification — must be registered BEFORE json()
  app.use('/api/payments/webhooks/stripe', raw({ type: 'application/json' }));

  // JSON + form body for every other route
  app.use(json());
  app.use(urlencoded({ extended: true }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('E-Commerce API')
    .setDescription('Production-ready NestJS E-Commerce API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Docs: http://localhost:${port}/api/docs`);
}

bootstrap();
