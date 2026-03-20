export interface CaseMetadataOutputDto {
  slug: string;
  name: string;
  /** Full HTML title suggestion (without site suffix); clients may append “| Brand”. */
  title: string;
  description: string;
  /** Comma-separated keywords for `<meta name="keywords">` / JSON-LD. */
  keywords: string;
  imageUrl: string | null;
  variant: string;
  riskLevel: number;
  itemCount: number;
}
