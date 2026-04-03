import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseFilters,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../../shared/guards/jwt-auth.guard';
import type { JwtPayload } from '../../../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../../shared/guards/roles.guard';
import { Roles } from '../../../../../shared/decorators/roles.decorator';
import { UserRole } from '../../../../../shared/enums/user-role.enum';
import { CurrentUser } from '../../../../../shared/decorators/current-user.decorator';
import { DomainExceptionFilter } from '../../../../../shared/filters/domain-exception.filter';
import { ListCasesUseCase } from '../../../../../application/game/case/use-cases/list-cases.use-case';
import {
  GetCaseBySlugUseCase,
  toCaseDetailDto,
} from '../../../../../application/game/case/use-cases/get-case-by-slug.use-case';
import { GetCaseMetadataUseCase } from '../../../../../application/game/case/use-cases/get-case-metadata.use-case';
import type { ICaseDetailCachePort } from '../../../../../domain/game/case/ports/case-detail-cache.port';
import { CASE_DETAIL_CACHE } from '../../../../../application/game/case/tokens/case.tokens';
import { OpenCaseUseCase } from '../../../../../application/game/case/use-cases/open-case.use-case';
import { CreateCaseUseCase } from '../../../../../application/game/case/use-cases/create-case.use-case';
import { OpenCaseHttpDto } from './dto/open-case.dto';
import { CreateCaseHttpDto } from './dto/create-case.http-dto';
import {
  ListCasesQueryDto,
  toCaseListQueryFilter,
} from './dto/list-cases-query.dto';
import { CasesListRateLimitGuard } from './guards/cases-list-rate-limit.guard';
import { RedisService } from '../../../../../infrastructure/cache/redis.service';
import { RedisKeys } from '../../../../../infrastructure/cache/redis.keys';
import { PrismaService } from '../../../../../infrastructure/persistance/prisma/prisma.service';

const CASE_SLUG_MAX_LEN = 160;
const CASE_OPEN_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function assertValidCaseSlugParam(slug: string): string {
  const s = slug.trim();
  if (s.length === 0 || s.length > CASE_SLUG_MAX_LEN) {
    throw new BadRequestException('Invalid case slug');
  }
  if (s.includes('/') || s.includes('\\')) {
    throw new BadRequestException('Invalid case slug');
  }
  return s;
}

@Controller('cases')
@UseFilters(DomainExceptionFilter)
export class CasesController {
  private readonly logger = new Logger(CasesController.name);

  constructor(
    private readonly listCasesUseCase: ListCasesUseCase,
    private readonly getCaseBySlugUseCase: GetCaseBySlugUseCase,
    private readonly getCaseMetadataUseCase: GetCaseMetadataUseCase,
    private readonly openCaseUseCase: OpenCaseUseCase,
    private readonly createCaseUseCase: CreateCaseUseCase,
    @Inject(CASE_DETAIL_CACHE)
    private readonly caseDetailCache: ICaseDetailCachePort,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @UseGuards(CasesListRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  async list(@Query() query: ListCasesQueryDto) {
    const filters = toCaseListQueryFilter(query);
    const result = await this.listCasesUseCase.execute(filters);
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Post('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCaseHttpDto) {
    const result = await this.createCaseUseCase.execute({
      actorUsername: 'admin',
      slug: dto.slug,
      name: dto.name,
      imageUrl: dto.imageUrl ?? null,
      price: dto.price,
      variant: dto.variant,
      catalogCategory: dto.catalogCategory,
      riskLevel: dto.riskLevel,
      isActive: dto.isActive,
      sortOrder: dto.sortOrder,
      items: dto.items.map((i) => ({
        petId: i.petId,
        weight: i.weight,
        sortOrder: i.sortOrder,
        variant: i.variant?.map(String),
      })),
    });
    if (!result.ok) throw result.error;
    return result.value;
  }

  /**
   * Returns the authenticated user's global case-open cooldown status.
   * Declared before `GET :slug` so the literal segment isn't captured as a slug.
   */
  @Get('cooldown')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getCooldownStatus(
    @CurrentUser() user: JwtPayload,
  ): Promise<{ onCooldown: boolean; cooldownEndsAt: string | null }> {
    /** Last open time from Redis (game + reward) or reward-case DB row if Redis missed. */
    let lastOpenMs = 0;

    try {
      const raw = await this.redis.get<string>(
        RedisKeys.case.cooldown(user.username),
      );
      if (raw) {
        const openedAt = Number(raw);
        if (Number.isFinite(openedAt) && openedAt > 0) {
          lastOpenMs = Math.max(lastOpenMs, openedAt);
        }
      }
    } catch (err) {
      this.logger.warn(
        `[Cases] cooldown redis read failed for user=${user.username}`,
        err,
      );
    }

    try {
      const row = await this.prisma.rewardCaseOpen.findFirst({
        where: { userUsername: user.username },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (row) {
        const t = row.createdAt.getTime();
        if (Number.isFinite(t)) lastOpenMs = Math.max(lastOpenMs, t);
      }
    } catch (err) {
      this.logger.warn(
        `[Cases] cooldown reward-case DB read failed for user=${user.username}`,
        err,
      );
    }

    if (lastOpenMs <= 0) {
      return { onCooldown: false, cooldownEndsAt: null };
    }

    const cooldownEndsAt = new Date(lastOpenMs + CASE_OPEN_COOLDOWN_MS);
    const onCooldown = cooldownEndsAt.getTime() > Date.now();
    return {
      onCooldown,
      cooldownEndsAt: onCooldown ? cooldownEndsAt.toISOString() : null,
    };
  }

  /**
   * Public SEO / layout metadata (lightweight; no weighted item payload).
   * Declared before `GET :slug` so `meta` is not captured as a slug.
   */
  @Get(':slug/meta')
  @HttpCode(HttpStatus.OK)
  async getMetadata(@Param('slug') slug: string) {
    this.logger.log(`${slug} getMetadata`);
    const decodedSlug = assertValidCaseSlugParam(decodeURIComponent(slug));
    const result = await this.getCaseMetadataUseCase.execute({
      slug: decodedSlug,
    });
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Get(':slug')
  @HttpCode(HttpStatus.OK)
  async getBySlug(@Param('slug') slug: string) {
    const decodedSlug = assertValidCaseSlugParam(decodeURIComponent(slug));

    try {
      const cached = await this.caseDetailCache.get(decodedSlug);
      if (cached !== null && cached.isActive) {
        return toCaseDetailDto(cached);
      }
    } catch (err) {
      this.logger.warn(
        `[Cases] detail cache read failed slug=${decodedSlug}, using DB`,
        err,
      );
    }

    const result = await this.getCaseBySlugUseCase.execute({
      slug: decodedSlug,
    });
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Post(':slug/open')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async open(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Body() dto: OpenCaseHttpDto,
  ) {
    const result = await this.openCaseUseCase.execute({
      username: user.username,
      profilePicture: user.profilePicture,
      slug: assertValidCaseSlugParam(decodeURIComponent(slug)),
      quantity: dto.quantity ?? 1,
    });
    if (!result.ok) throw result.error;
    return result.value;
  }
}
