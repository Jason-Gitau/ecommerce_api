import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, raw, urlencoded } from 'express';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT || '1mb';
const ENABLE_SWAGGER =
  process.env.ENABLE_SWAGGER === 'true' || process.env.NODE_ENV !== 'production';

async function setupSwagger(app: Awaited<ReturnType<typeof NestFactory.create>>) {
  if (!ENABLE_SWAGGER) {
    return;
  }

  const { SwaggerModule, DocumentBuilder } = await import('@nestjs/swagger');
  const config = new DocumentBuilder()
    .setTitle('E-Commerce API')
    .setDescription('Production-ready NestJS E-Commerce API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}

async function bootstrap() {
  // bodyParser: false - we register body parsers manually so the Stripe webhook
  // route receives a raw Buffer before the JSON parser can consume the stream.
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());

  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin ?? true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Raw body for Stripe signature verification - must be registered BEFORE json()
  app.use(
    '/api/payments/webhooks/stripe',
    raw({ type: 'application/json', limit: REQUEST_BODY_LIMIT }),
  );

  // JSON + form body for every other route
  app.use(json({ limit: REQUEST_BODY_LIMIT }));
  app.use(urlencoded({ extended: false, limit: REQUEST_BODY_LIMIT }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );

  await setupSwagger(app);

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Server running on http://localhost:${port}`);
  if (ENABLE_SWAGGER) {
    console.log(`Docs: http://localhost:${port}/api/docs`);
  }
}

bootstrap();
