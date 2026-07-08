export interface InventoryItem {
  code: string;
  name: string | null;
  cpdStart: string | null;
  cpdEnd: string | null;
  spCycle: string | null;
  status: "active" | "expired" | "unknown";
  nOutcomes: number;
  nOutputs: number;
  missing: string[];
  layer3Category: string | null;
  layer3Evidence: string | null;
}

export interface MatrixRow {
  code: string;
  name: string | null;
  scores: Record<string, number>;
}

export interface EvidenceRowItem {
  level: "Outcome" | "Output";
  resultName: string | null;
  description: string | null;
  linkage: string;
  tagMatched: boolean;
  strength: "strong" | "weak";
}

export interface EvidenceDetail {
  code: string;
  name: string | null;
  theme: string;
  score: number;
  rationale: string;
  items: EvidenceRowItem[];
}

export interface LinkageReview {
  theme: string;
  hasIrrfCode: boolean;
  mappedIrrfCodes: string[];
  countScore4: number;
  countScore3: number;
  countScore2: number;
  countScore0: number;
  note: string;
}

export interface ManualReviewItem {
  code: string;
  name: string | null;
  theme: string;
  reason: string;
  sampleEvidence: string;
  resultName: string;
  layer3Category: string | null;
}

export interface ThemeKeywords {
  strong: string[];
  weak: string[];
}

export interface Layer3Entry {
  category: string;
  evidence: string;
}

export interface CpdAnalysis {
  generatedAt: string;
  themeNames: string[];
  themeKeywords: Record<string, ThemeKeywords>;
  irrfTagThemeMap: Record<string, string[]>;
  inventory: InventoryItem[];
  matrix: MatrixRow[];
  evidenceDetail: EvidenceDetail[];
  linkageReview: LinkageReview[];
  manualReview: ManualReviewItem[];
  layer3Verified: Record<string, Layer3Entry>;
}
