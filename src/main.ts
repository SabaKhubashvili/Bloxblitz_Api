import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cors from 'cors';


export const allowedOrigins = [
  'https://bloxblitz.com',
  'http://localhost:3000',
  'http://localhost',
  "https://v2-testing-phase.bloxblitz.com"
];
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('/api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000).then(()=>{
    console.log(`Server is running on port ${process.env.PORT ?? 3000}`);
  });
}
bootstrap();
