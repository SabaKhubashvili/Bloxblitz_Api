// src/bot/bot.controller.ts
import {
  Controller,
  Get,
  Logger,
  HttpException,
  HttpStatus,
  Query,
  Post,
  Body,
  Headers,
  Req,
} from '@nestjs/common';

import { BotService } from './bot.service';
import {
  SucesfullDepositDTO,
  SucesfullWithdrawDTO,
  UsernameQueryDto,
  WithdrawDeclineDTO,
} from './bot.dto';

@Controller('bot')
export class BotController {
  private readonly logger: Logger = new Logger(BotController.name);
  private failedAuthAttempts: Map<
    string,
    { count: number; blockedUntil: Date | null }
  > = new Map();

  constructor(private readonly botService: BotService) {}

  private recordFailedAttempt(ip: string): void {
    const record = this.failedAuthAttempts.get(ip) || {
      count: 0,
      blockedUntil: null,
    };
    record.count += 1;

    if (record.count >= 3) {
      const blockUntil = new Date();
      blockUntil.setMinutes(blockUntil.getMinutes() + 30);
      record.blockedUntil = blockUntil;

      this.logger.warn(
        `IP ${ip} blocked for 30 minutes due to multiple auth failures`,
      );
    }

    this.failedAuthAttempts.set(ip, record);
  }
  private checkRateLimit(ip: string): boolean {
    const now = new Date();
    const record = this.failedAuthAttempts.get(ip);

    if (!record) {
      return false;
    }

    if (record.blockedUntil && record.blockedUntil > now) {
      return true;
    }

    if (record.blockedUntil && record.blockedUntil <= now) {
      record.count = 0;
      record.blockedUntil = null;
      this.failedAuthAttempts.set(ip, record);
    }

    return false;
  }
  @Get('withdrawing')
  async getWithdrawingItems(@Query() query: UsernameQueryDto) {
    try {
      const items = await this.botService.getWithdrawingItems(
        query.username,
        parseInt(query.botId),
      );
      if (items === null) {
        return {
          success: false,
          type: 'userNotFound',
          message: 'User Not found',
        };
      } else {
        return {
          success: true,
          withdrawing: items.length > 0 ? true : false,
          pets: items,
        };
      }
    } catch (err) {
      this.logger.error(
        `Error fetching withdrawing items for user ${query.username}:`,
        err,
      );
      throw new HttpException(
        {
          success: false,
          message:
            'Something went wrong getting withdrawing inventory! Administration has been notified',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('deposit')
  async handleDepositSuccess(
    @Body() body: SucesfullDepositDTO,
    @Headers('Authorization') authorization: string,
    @Req() request: Request,
  ) {
    try {
      const clientIp: string =
        (request.headers['x-real-ip'] as string) ||
        (request.headers['cf-connecting-ip'] as string) ||
        (request.headers['x-forwarded-for'] as string) ||
        'unknown';
      const BOT_API_KEY = process.env.BOT_API_KEY;

      if (
        this.checkRateLimit(
          typeof clientIp === 'string' ? clientIp : String(clientIp),
        )
      ) {
        const record = this.failedAuthAttempts.get(clientIp.toString());
        if (record && record.blockedUntil) {
          this.logger.log(`ratelimit blocked`);
          const remainingMinutes = Math.ceil(
            (record.blockedUntil.getTime() - new Date().getTime()) / 60000,
          );
          this.logger.warn(
            `Rate limited IP ${clientIp} attempted to access API`,
          );
          throw new HttpException(
            {
              success: false,
              message: `Too many failed authentication attempts. Try again in ${remainingMinutes} minutes.`,
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }

      if (!authorization || authorization !== `Bearer ${BOT_API_KEY}`) {
        this.logger.log(`auth blocked`);
        this.recordFailedAttempt(clientIp);
        this.logger.error(`
        Unauthorized deposit attempt!
        real: Bearer ${BOT_API_KEY}
        Authorization Header: ${authorization}
        IP: ${clientIp}
        Username: ${body.username}
        Data: ${JSON.stringify(body)}
        `);
        throw new HttpException(
          {
            success: false,
            message:
              'Unauthorized access! Administration has been warned! If continued you will get banned!',
          },
          HttpStatus.UNAUTHORIZED,
        );
      }

      const result = await this.botService.processDeposit(body);
      return {
        success: true,
        data: result,
      };
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }

      this.logger.error(
        `Error processing deposit for user ${body.username}:`,
        err,
      );
      throw new HttpException(
        {
          success: false,
          message:
            'Failed to process deposit. Administration has been notified.',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  @Post('withdraw')
  async handleWithdrawSuccess(
    @Body() body: SucesfullWithdrawDTO,
    @Headers('Authorization') authorization: string,
    @Req() request: Request,
  ) {
    try {
      const clientIp: string =
        (request.headers['x-real-ip'] as string) ||
        (request.headers['cf-connecting-ip'] as string) ||
        (request.headers['x-forwarded-for'] as string) ||
        'unknown';
      const BOT_API_KEY = process.env.BOT_API_KEY;

      if (
        this.checkRateLimit(
          typeof clientIp === 'string' ? clientIp : String(clientIp),
        )
      ) {
        const record = this.failedAuthAttempts.get(clientIp.toString());
        if (record && record.blockedUntil) {
          this.logger.log(`ratelimit blocked`);
          const remainingMinutes = Math.ceil(
            (record.blockedUntil.getTime() - new Date().getTime()) / 60000,
          );
          this.logger.warn(
            `Rate limited IP ${clientIp} attempted to access API`,
          );
          throw new HttpException(
            {
              success: false,
              message: `Too many failed authentication attempts. Try again in ${remainingMinutes} minutes.`,
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }

      if (!authorization || authorization !== `Bearer ${BOT_API_KEY}`) {
        this.logger.log(`auth blocked`);
        this.recordFailedAttempt(clientIp);
        this.logger.error(`
        Unauthorized deposit attempt!
        real: Bearer ${BOT_API_KEY}
        Authorization Header: ${authorization}
        IP: ${clientIp}
        Username: ${body.username}
        Data: ${JSON.stringify(body)}
        `);
        throw new HttpException(
          {
            success: false,
            message:
              'Unauthorized access! Administration has been warned! If continued you will get banned!',
          },
          HttpStatus.UNAUTHORIZED,
        );
      }

      const result = await this.botService.processWithdraw(body);
      return {
        success: true,
        data: result,
      };
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }

      this.logger.error(
        `Error processing deposit for user ${body.username}:`,
        err,
      );
      throw new HttpException(
        {
          success: false,
          message:
            'Failed to process deposit. Administration has been notified.',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  @Post('withdraw_decline')
  async handleWithdrawDecline(
    @Body() body: WithdrawDeclineDTO,
    @Headers('Authorization') authorization: string,
    @Req() request: Request,
  ) {
    try {
      const clientIp: string =
        (request.headers['x-real-ip'] as string) ||
        (request.headers['cf-connecting-ip'] as string) ||
        (request.headers['x-forwarded-for'] as string) ||
        'unknown';
      const BOT_API_KEY = process.env.BOT_API_KEY;

      if (
        this.checkRateLimit(
          typeof clientIp === 'string' ? clientIp : String(clientIp),
        )
      ) {
        const record = this.failedAuthAttempts.get(clientIp.toString());
        if (record && record.blockedUntil) {
          this.logger.log(`ratelimit blocked`);
          const remainingMinutes = Math.ceil(
            (record.blockedUntil.getTime() - new Date().getTime()) / 60000,
          );
          this.logger.warn(
            `Rate limited IP ${clientIp} attempted to access API`,
          );
          throw new HttpException(
            {
              success: false,
              message: `Too many failed authentication attempts. Try again in ${remainingMinutes} minutes.`,
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }

      if (!authorization || authorization !== `Bearer ${BOT_API_KEY}`) {
        this.logger.log(`auth blocked`);
        this.recordFailedAttempt(clientIp);
        this.logger.error(`
        Unauthorized deposit attempt!
        real: Bearer ${BOT_API_KEY}
        Authorization Header: ${authorization}
        IP: ${clientIp}
        Username: ${body.username}
        Data: ${JSON.stringify(body)}
        `);
        throw new HttpException(
          {
            success: false,
            message:
              'Unauthorized access! Administration has been warned! If continued you will get banned!',
          },
          HttpStatus.UNAUTHORIZED,
        );
      }

      const result = await this.botService.processWithdrawDecline(body);
      return {
        success: true,
        data: result,
      };
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }

      this.logger.error(
        `Error processing deposit for user ${body.username}:`,
        err,
      );
      throw new HttpException(
        {
          success: false,
          message:
            'Failed to process deposit. Administration has been notified.',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
