import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Param,
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
import {
  ListCasesUseCase,
  toCaseSummaryDto,
} from '../../../../../application/game/case/use-cases/list-cases.use-case';
import {
  GetCaseBySlugUseCase,
  toCaseDetailDto,
} from '../../../../../application/game/case/use-cases/get-case-by-slug.use-case';
import { GetCaseMetadataUseCase } from '../../../../../application/game/case/use-cases/get-case-metadata.use-case';
import type { ICaseListCachePort } from '../../../../../domain/game/case/ports/case-list-cache.port';
import type { ICaseDetailCachePort } from '../../../../../domain/game/case/ports/case-detail-cache.port';
import {
  CASE_LIST_CACHE,
  CASE_DETAIL_CACHE,
} from '../../../../../application/game/case/tokens/case.tokens';
import { OpenCaseUseCase } from '../../../../../application/game/case/use-cases/open-case.use-case';
import { CreateCaseUseCase } from '../../../../../application/game/case/use-cases/create-case.use-case';
import { OpenCaseHttpDto } from './dto/open-case.dto';
import { CreateCaseHttpDto } from './dto/create-case.http-dto';

const CASE_SLUG_MAX_LEN = 160;

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
    @Inject(CASE_LIST_CACHE)
    private readonly caseListCache: ICaseListCachePort,
    @Inject(CASE_DETAIL_CACHE)
    private readonly caseDetailCache: ICaseDetailCachePort,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async list() {
    try {
      const cached = await this.caseListCache.get();
      if (cached !== null) {
        return cached.map(toCaseSummaryDto);
      }
    } catch (err) {
      this.logger.warn('[Cases] list cache read failed, using DB', err);
    }

    const result = await this.listCasesUseCase.execute();
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Post('admin')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCaseHttpDto) {
    const result = await this.createCaseUseCase.execute({
      actorUsername: 'admin',
      slug: dto.slug,
      name: dto.name,
      imageUrl: dto.imageUrl ?? null,
      price: dto.price,
      variant: dto.variant,
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
      slug: assertValidCaseSlugParam(decodeURIComponent(slug)),
      quantity: dto.quantity ?? 1,
    });
    if (!result.ok) throw result.error;
    return result.value;
  }
}
