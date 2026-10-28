import { ExtractedClaim } from './types.js';

export class ClaimExtractor {
  /**
   * Splits input paragraphs or statements into atomic claim propositions.
   */
  public static extractClaims(text: string): ExtractedClaim[] {
    const claims: ExtractedClaim[] = [];
    if (!text || text.trim().length === 0) {
      return claims;
    }

    // Split on sentence boundaries while preserving indices
    const sentenceRegex = /[^.!?\n]+[.!?\n]+/g;
    let match: RegExpExecArray | null;

    while ((match = sentenceRegex.exec(text)) !== null) {
      const sentence = match[0].trim();
      // Skip empty or tiny fragments
      if (sentence.length > 5) {
        claims.push({
          id: `claim-${claims.length + 1}`,
          text: sentence,
          startOffset: match.index,
          endOffset: match.index + match[0].length
        });
      }
    }

    // Fallback if no punctuation matched
    if (claims.length === 0 && text.trim().length > 0) {
      claims.push({
        id: 'claim-1',
        text: text.trim(),
        startOffset: 0,
        endOffset: text.length
      });
    }

    return claims;
  }
}
