import { Injectable } from '@nestjs/common';

/**
 * Builds SEO copy from case facts (no persisted description/keywords on Case yet).
 */
@Injectable()
export class CaseMetadataDomainService {
  buildDescription(name: string, itemCount: number): string {
    const noun = itemCount === 1 ? 'reward' : 'rewards';
    return `Open “${name}” on BloxBlitz — ${itemCount} possible ${noun}, provably fair drops.`;
  }

  buildKeywords(input: {
    name: string;
    slug: string;
    variant: string;
  }): string {
    const parts = [
      'BloxBlitz',
      'case opening',
      'loot case',
      input.name,
      input.slug,
      input.variant,
    ];
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const p of parts) {
      const t = p.trim();
      if (!t || seen.has(t.toLowerCase())) continue;
      seen.add(t.toLowerCase());
      unique.push(t);
    }
    return unique.join(', ');
  }
}
