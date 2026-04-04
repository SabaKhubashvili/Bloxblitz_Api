import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { makeRetryExtension } from './extensions/retryPrisma.extension';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const bootLogger = new Logger(PrismaService.name);

    // Log environment variables (before super — cannot use `this` yet)
    bootLogger.log('🔹 PrismaService starting...');
    bootLogger.log(`🔹 DATABASE_URL: ${process.env.DATABASE_URL}`);
    bootLogger.log(`🔹 NODE_ENV: ${process.env.NODE_ENV}`);

    // Resolve absolute path to certificate
    const certPath = path.resolve(__dirname, '../../../certs/db_cert/db_cert.crt');
    bootLogger.log(`🔹 Resolving certificate path: ${certPath}`);

    // Check if certificate exists and readable
    if (fs.existsSync(certPath)) {
      bootLogger.log(`✅ Certificate file exists`);
      try {
        const certContent = fs.readFileSync(certPath, 'utf8');
        bootLogger.log(
          `✅ Certificate file read successfully, length: ${certContent.length} chars`,
        );
      } catch (err) {
        bootLogger.error(`❌ Failed to read certificate file: ${err}`);
      }
    } else {
      bootLogger.error(`❌ Certificate file not found at path: ${certPath}`);
    }

    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL!,
      connect_timeout: 5000,
      ssl: {
        rejectUnauthorized: true,
        ca: fs.readFileSync(certPath, 'utf8'),
      },
    });

    super({
      adapter,
      log: ['query', 'error', 'warn'],
    });
  }

  async onModuleInit() {
    // Apply retry extension first
    Object.assign(this, this.$extends(makeRetryExtension(this)));
    await this.connectWithRetry();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async connectWithRetry(maxRetries = 5): Promise<void> {
    let attempt = 0;
    const baseDelay = 2000;

    while (attempt < maxRetries) {
      attempt++;
      try {
        await this.$connect();
        this.logger.log('✅ Connected to database via Prisma adapter');
        return;
      } catch (err: any) {
        this.logger.error(
          `❌ DB connection failed (attempt ${attempt}/${maxRetries}): ${err.message}`,
        );
        this.logger.debug(err.stack || 'No stack trace');
        if (attempt >= maxRetries) throw err;
        const delay = baseDelay * attempt;
        this.logger.warn(`⏳ Retrying in ${delay}ms...`);
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }

  async safeQuery<T>(callback: () => Promise<T>): Promise<T> {
    let attempt = 0;
    const maxRetries = 3;
    while (true) {
      try {
        return await callback();
      } catch (err) {
        attempt++;
        if (attempt >= maxRetries) throw err;
        this.logger.warn(`Retrying failed query (${attempt}/${maxRetries})...`);
        this.logger.debug(err);
      }
    }
  }
}