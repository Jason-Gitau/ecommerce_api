import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // This line tells NestJS to prefix every route with /api
  app.setGlobalPrefix('api'); 

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();