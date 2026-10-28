import {
  ExtractedClaim,
  SourcePassage,
  VerificationResult,
  VerificationStatus,
  ClaimVerificationReport
} from './types.js';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to',
  'for', 'with', 'by', 'about', 'as', 'into', 'like', 'through', 'after', 'over', 'between',
  'out', 'against', 'during', 'without', 'before', 'under', 'around', 'among', 'that', 'this',
  'it', 'its', 'they', 'them', 'their', 'of', 'be', 'been', 'has', 'have', 'had', 'do', 'does'
]);

const NEGATION_WORDS = new Set([
  'not', 'never', 'no', 'none', 'neither', 'nor', 'cannot', 'denies', 'denied', 'false',
  'refuted', 'disproved', 'untrue', 'rejected', 'failed', 'without'
]);

export class EvidenceMatcher {
  private static tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1 && !STOPWORDS.has(w));
  }

  private static extractNumbers(text: string): string[] {
    const matches = text.match(/\b\d+(?:\.\d+)?%?\b/g);
    return matches || [];
  }

  /**
   * Evaluates a single claim against a library of source passages.
   */
  public static verifyClaim(claim: ExtractedClaim, passages: SourcePassage[]): VerificationResult {
    const claimTokens = this.tokenize(claim.text);
    const claimNumbers = this.extractNumbers(claim.text);
    const claimHasNegation = claim.text
      .toLowerCase()
      .split(/\s+/)
      .some(w => NEGATION_WORDS.has(w));

    if (claimTokens.length === 0 || passages.length === 0) {
      return {
        claimId: claim.id,
        claimText: claim.text,
        status: 'UNVERIFIED',
        confidence: 0,
        evidenceScore: 0,
        explanation: 'No grounding source passages provided or claim has no extractable keywords.'
      };
    }

    let bestPassage: SourcePassage | null = null;
    let bestScore = 0;
    let bestMatchedSentence = '';
    let isNegationContradiction = false;
    let isNumberContradiction = false;

    for (const passage of passages) {
      // Split passage into sentences for granular alignment
      const sentences = passage.text.split(/(?<=[.!?])\s+/);

      for (const sentence of sentences) {
        const sentenceTokens = this.tokenize(sentence);
        const sentenceSet = new Set(sentenceTokens);

        // Calculate token containment
        let overlapCount = 0;
        for (const token of claimTokens) {
          if (sentenceSet.has(token)) {
            overlapCount++;
          }
        }

        const score = claimTokens.length > 0 ? overlapCount / claimTokens.length : 0;

        if (score > bestScore) {
          bestScore = score;
          bestPassage = passage;
          bestMatchedSentence = sentence;

          // Check for polarity / negation mismatch
          const sentenceHasNegation = sentence
            .toLowerCase()
            .split(/\s+/)
            .some(w => NEGATION_WORDS.has(w));
          isNegationContradiction = claimHasNegation !== sentenceHasNegation;

          // Check for numeric quantity clash
          const sentenceNumbers = this.extractNumbers(sentence);
          if (claimNumbers.length > 0 && sentenceNumbers.length > 0) {
            const hasCommonNumber = claimNumbers.some(cn => sentenceNumbers.includes(cn));
            if (!hasCommonNumber) {
              isNumberContradiction = true;
            }
          }
        }
      }
    }

    // Classification Decision Tree
    let status: VerificationStatus = 'UNVERIFIED';
    let explanation = '';
    let confidence = 0;

    if (bestScore < 0.25) {
      status = 'UNVERIFIED';
      confidence = 0.9;
      explanation = 'No passage contained sufficient keyword or semantic overlap with this claim.';
    } else if (bestScore >= 0.5 && (isNegationContradiction || isNumberContradiction)) {
      status = 'CONTRADICTED';
      confidence = Number((bestScore * 0.9).toFixed(2));
      explanation = isNumberContradiction
        ? `Numeric conflict: source indicates different quantities in "${bestMatchedSentence}".`
        : `Polarity inversion: source negates claim premise in "${bestMatchedSentence}".`;
    } else if (bestScore >= 0.6) {
      status = 'SUPPORTED';
      confidence = Number(bestScore.toFixed(2));
      explanation = `Directly corroborated by source passage [${bestPassage?.title}]: "${bestMatchedSentence}".`;
    } else {
      status = 'INSUFFICIENTLY_SUPPORTED';
      confidence = Number(bestScore.toFixed(2));
      explanation = `Partial token overlap (${Math.round(bestScore * 100)}%), but missing key assertions.`;
    }

    return {
      claimId: claim.id,
      claimText: claim.text,
      status,
      confidence,
      alignedPassageId: bestPassage?.id,
      matchedExcerpt: bestMatchedSentence || undefined,
      evidenceScore: Number((bestScore * 100).toFixed(1)),
      explanation
    };
  }

  /**
   * Verifies an entire collection of claims and synthesizes a faithfulness report.
   */
  public static verifyAll(claims: ExtractedClaim[], passages: SourcePassage[]): ClaimVerificationReport {
    const results = claims.map(c => this.verifyClaim(c, passages));

    const statusCounts: Record<VerificationStatus, number> = {
      SUPPORTED: 0,
      CONTRADICTED: 0,
      INSUFFICIENTLY_SUPPORTED: 0,
      UNVERIFIED: 0
    };

    for (const r of results) {
      statusCounts[r.status]++;
    }

    // Faithfulness score: Supported is +100%, Insufficient is +40%, Contradicted/Unverified is 0%
    const total = claims.length;
    let rawScore = 0;
    if (total > 0) {
      rawScore = ((statusCounts.SUPPORTED * 100) + (statusCounts.INSUFFICIENTLY_SUPPORTED * 40)) / total;
    }

    return {
      timestamp: new Date().toISOString(),
      totalClaims: total,
      statusCounts,
      faithfulnessScore: Number(rawScore.toFixed(1)),
      results
    };
  }
}
