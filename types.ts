export type VerificationStatus =
  | 'SUPPORTED'
  | 'CONTRADICTED'
  | 'INSUFFICIENTLY_SUPPORTED'
  | 'UNVERIFIED';

export interface SourcePassage {
  id: string;
  title: string;
  text: string;
  sourceUrl?: string;
  publishedDate?: string;
}

export interface ExtractedClaim {
  id: string;
  text: string;
  startOffset: number;
  endOffset: number;
}

export interface VerificationResult {
  claimId: string;
  claimText: string;
  status: VerificationStatus;
  confidence: number; // 0 to 1
  alignedPassageId?: string;
  matchedExcerpt?: string;
  evidenceScore: number;
  explanation: string;
}

export interface ClaimVerificationReport {
  timestamp: string;
  totalClaims: number;
  statusCounts: Record<VerificationStatus, number>;
  faithfulnessScore: number; // 0 to 100
  results: VerificationResult[];
}
