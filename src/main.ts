import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

const defaultAllowedOrigins = [
  'https://bloxblitz.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost',
  'http://127.0.0.1',
  'https://v2-testing-phase.bloxblitz.com',
];

/** Extra origins from env: `CORS_ORIGINS=https://a.com,http://b.com` */
function originsFromEnv(): string[] {
  const raw = process.env.CORS_ORIGINS;
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isLocalDevOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }
  const allowList = [...defaultAllowedOrigins, ...originsFromEnv()];
  if (allowList.includes(origin)) {
    return true;
  }
  if (process.env.NODE_ENV !== 'production' && isLocalDevOrigin(origin)) {
    return true;
  }
  return false;
}

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

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'X-Internal-Service-Secret',
    ],
  });

  await app.listen(process.env.PORT ?? 3001);

  console.log(`Server is running on port ${process.env.PORT ?? 3001}`);
}

bootstrap();
