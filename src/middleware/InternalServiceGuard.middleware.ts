import { CanActivate, ExecutionContext, Injectable, NotFoundException, Logger } from "@nestjs/common";
import { Request } from "express";

@Injectable()
export class InternalServiceGuard implements CanActivate {
  private readonly logger = new Logger(InternalServiceGuard.name); 
  private allowedIps: string[] = process.env.INTERNAL_ALLOWED_IPS?.split(',') || [];

  canActivate(context: ExecutionContext): boolean {
    const req: Request = context.switchToHttp().getRequest();

    let ip = (req.headers['cf-connecting-ip'] as string) || req.ip || '';
    if (ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', ''); 

    // Check secret header
    const secret = req.headers['x-internal-secret'];
    if (secret !== process.env.INTERNAL_SECRET) {
      this.logger.warn(`❌ Invalid secret from IP: ${ip} - ${req.method} ${req.originalUrl}`);
      throw new NotFoundException({
      message: `Cannot ${req.method.toUpperCase()} ${req.originalUrl}`,
      error: "Not Found",
      statusCode: 404,
    });
    }

    // Check allowed IPs
    if (this.allowedIps.includes(ip)) {
      this.logger.log(`✅ Allowed access from IP: ${ip} - ${req.method} ${req.originalUrl}`);
      return true;
    }

    // Block access
    this.logger.warn(`❌ Blocked access from IP: ${ip} - ${req.method} ${req.originalUrl}`);
    throw new NotFoundException({
      message: `Cannot ${req.method.toUpperCase()} ${req.originalUrl}`,
      error: "Not Found",
      statusCode: 404,
    });
  }
}
