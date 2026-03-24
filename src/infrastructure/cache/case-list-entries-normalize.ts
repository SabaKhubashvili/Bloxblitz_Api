import type { CaseListEntry } from '../../domain/game/case/ports/case.repository.port';

export function normalizeCaseListEntries(
  raw: CaseListEntry[],
): CaseListEntry[] {
  return raw.map((e) => ({
    ...e,
    catalogCategory:
      e.catalogCategory === 'mm2' || e.catalogCategory === 'amp'
        ? e.catalogCategory
        : 'amp',
  }));
}
