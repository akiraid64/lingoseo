import type { Session } from "next-auth";

export interface ExtendedSession extends Session {
  accessToken?: string;
}

export type Severity = "critical" | "warning" | "info";

export type IssueType =
  | "missing-title"
  | "missing-meta-description"
  | "missing-og-tags"
  | "missing-twitter-tags"
  | "missing-hreflang"
  | "untranslated-alt"
  | "missing-html-lang"
  | "missing-sitemap-locales"
  | "missing-jsonld-localization"
  | "unoptimized-headings"
  | "untranslated-aria-labels"
  | "untranslated-sr-only"
  | "missing-canonical"
  | "missing-viewport"
  | "invalid-schema"
  // Structural ARIA issues
  | "missing-nav-label"
  | "missing-skip-link"
  | "decorative-not-hidden"
  | "action-link-no-role"
  | "missing-region-label"
  | "missing-icon-hiding";

export interface SeoIssue {
  id: string;
  type: IssueType;
  severity: Severity;
  filePath: string;
  line?: number;
  message: string;
  currentValue?: string;
  suggestedFix?: string;
}

export interface SeoScore {
  total: number;      // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  breakdown: {
    technical: number;
    onPage: number;
    accessibility: number;
    schema: number;
  };
}

export interface AnalysisResult {
  repoUrl: string;
  repoName: string;
  scannedFiles: number;
  issues: SeoIssue[];
  summary: Record<Severity, number>;
  localesDetected: string[];
  score: SeoScore;
  timestamp: string;
}

export interface FixResult {
  filePath: string;
  originalContent: string;
  newContent: string;
  issuesFixed: string[];
  log?: string[];
}

export interface PrResult {
  prUrl: string;
  prNumber: number;
  branchName: string;
  filesChanged: number;
}

export interface GeminiModel {
  name: string;
  displayName: string;
  description: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
}
