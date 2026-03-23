import { Injectable, Logger } from '@nestjs/common';
import {
  CaseCatalogCategory,
  CaseVariant,
  GameStatus,
  GameType,
  Prisma,
  Variant,
} from '@prisma/client';
import { resolvePetValueForCaseItemVariants } from '../../../../domain/game/case/services/case-item-pet-value';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  ICaseRepository,
  CaseListEntry,
  CaseDetailRecord,
  CaseMetadataRecord,
  CaseOpenWrite,
  CreateCaseWithItemsInput,
} from '../../../../domain/game/case/ports/case.repository.port';
import {
  CaseSlugTakenError,
  CaseUnknownPetsError,
} from '../../../../domain/game/case/errors/case.errors';

@Injectable()
export class PrismaCaseRepository implements ICaseRepository {
  private readonly logger = new Logger(PrismaCaseRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAllActive(): Promise<CaseListEntry[]> {
    const rows = await this.prisma.case.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toListEntry);
  }

  async findBySlugWithItems(slug: string): Promise<CaseDetailRecord | null> {
    const row = await this.prisma.case.findUnique({
      where: { slug },
      include: {
        items: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: { pet: true },
        },
      },
    });
    if (!row) return null;
    return {
      ...toListEntry(row),
      items: row.items.map((i) => ({
        id: i.id,
        petId: i.petId,
        weight: i.weight,
        sortOrder: i.sortOrder,
        variant: i.variant.map(String),
        pet: {
          id: i.pet.id,
          name: i.pet.name,
          image: i.pet.image,
          rarity: i.pet.rarity,
          value: roundPetValue(
            resolvePetValueForCaseItemVariants(i.pet, i.variant),
          ),
          variant: i.variant.map(String)
        },
      })),
    };
  }

  async findBySlugMetadata(slug: string): Promise<CaseMetadataRecord | null> {
    const row = await this.prisma.case.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        imageUrl: true,
        variant: true,
        riskLevel: true,
        isActive: true,
        _count: { select: { items: true } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      imageUrl: row.imageUrl,
      variant: mapVariant(row.variant),
      riskLevel: row.riskLevel.toNumber(),
      isActive: row.isActive,
      itemCount: row._count.items,
    };
  }

  async createWithItems(input: CreateCaseWithItemsInput): Promise<{ id: string }> {
    const distinctPetIds = [...new Set(input.items.map((i) => i.petId))];

    try {
      return await this.prisma.$transaction(async (tx) => {
        const petCount = await tx.pets.count({
          where: { id: { in: distinctPetIds } },
        });
        if (petCount !== distinctPetIds.length) {
          throw new CaseUnknownPetsError();
        }

        const variant = input.variant as CaseVariant;

        try {
          const catalogCategory =
            (input.catalogCategory as CaseCatalogCategory | undefined) ??
            CaseCatalogCategory.AMP;
          const created = await tx.case.create({
            data: {
              slug: input.slug,
              name: input.name,
              imageUrl: input.imageUrl,
              price: new Prisma.Decimal(input.price),
              variant,
              catalogCategory,
              riskLevel: new Prisma.Decimal(input.riskLevel),
              isActive: input.isActive,
              sortOrder: input.sortOrder,
              items: {
                create: input.items.map((i) => ({
                  petId: i.petId,
                  weight: i.weight,
                  sortOrder: i.sortOrder,
                  variant: (i.variant ?? []) as Variant[],
                })),
              },
            },
          });
          return { id: created.id };
        } catch (err) {
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === 'P2002'
          ) {
            throw new CaseSlugTakenError(input.slug);
          }
          throw err;
        }
      });
    } catch (err) {
      if (err instanceof CaseSlugTakenError || err instanceof CaseUnknownPetsError) {
        throw err;
      }
      this.logger.error('[CaseRepo] createWithItems failed', err);
      throw err;
    }
  }

  async saveOpens(opens: CaseOpenWrite[]): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        for (const o of opens) {
          await tx.gameHistory.create({
            data: {
              id: o.gameHistoryId,
              gameType: GameType.CASE,
              username: o.username,
              status: GameStatus.FINISHED,
              betAmount: new Prisma.Decimal(o.pricePaid),
              profit: new Prisma.Decimal(o.wonPetValue - o.pricePaid),
              multiplier: new Prisma.Decimal((o.wonPetValue / o.pricePaid).toFixed(4)),
            },
          });
          await tx.caseOpenHistory.create({
            data: {
              id: o.id,
              userUsername: o.username,
              caseId: o.caseId,
              wonCaseItemId: o.wonCaseItemId,
              openBatchIndex: o.openBatchIndex,
              pricePaid: new Prisma.Decimal(o.pricePaid),
              wonItemValue: new Prisma.Decimal(o.wonPetValue),
              clientSeed: o.clientSeed,
              serverSeedHash: o.serverSeedHash,
              nonce: o.nonce,
              normalizedRoll: new Prisma.Decimal(o.normalizedRoll.toFixed(8)),
              gameHistoryId: o.gameHistoryId,
            },
          });
        }
      });
    } catch (err) {
      this.logger.error('[CaseRepo] saveOpens transaction failed', err);
      throw err;
    }
  }
}

function roundPetValue(n: number): number {
  return Math.round(n * 100) / 100;
}

function mapVariant(v: CaseVariant): string {
  switch (v) {
    case CaseVariant.FEATURED:
      return 'featured';
    case CaseVariant.HIGH_RISK:
      return 'high-risk';
    default:
      return 'standard';
  }
}

function mapCatalogCategory(c: CaseCatalogCategory): 'amp' | 'mm2' {
  return c === CaseCatalogCategory.MM2 ? 'mm2' : 'amp';
}

function toListEntry(row: {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  price: Prisma.Decimal;
  variant: CaseVariant;
  catalogCategory: CaseCatalogCategory;
  riskLevel: Prisma.Decimal;
  isActive: boolean;
  sortOrder: number;
}): CaseListEntry {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    imageUrl: row.imageUrl,
    price: row.price.toNumber(),
    variant: mapVariant(row.variant),
    catalogCategory: mapCatalogCategory(row.catalogCategory),
    riskLevel: row.riskLevel.toNumber(),
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}
