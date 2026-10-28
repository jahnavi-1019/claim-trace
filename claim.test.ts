import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SourcePassage } from './types.js';
import { ClaimExtractor } from './claim-extractor.js';
import { EvidenceMatcher } from './evidence-matcher.js';

test('ClaimTrace Extractor: decomposes text into distinct atomic claims', () => {
  const paragraph = 'PostgreSQL is an open-source database. It supports JSONB querying out of the box. Redis is entirely written in Rust.';
  const claims = ClaimExtractor.extractClaims(paragraph);
  assert.equal(claims.length, 3);
  assert.ok(claims[0].text.includes('PostgreSQL'));
  assert.ok(claims[1].text.includes('JSONB'));
  assert.ok(claims[2].text.includes('Redis'));
});

test('ClaimTrace Verifier: classifies supported, contradicted, and unverified claims', () => {
  const passages: SourcePassage[] = [
    {
      id: 'pass-1',
      title: 'PostgreSQL Manual',
      text: 'PostgreSQL is an open-source object-relational database system that natively supports JSONB indexing and queries.'
    },
    {
      id: 'pass-2',
      title: 'Redis Architecture Docs',
      text: 'Redis is an in-memory data structure store written in ANSI C, not in Rust.'
    }
  ];

  // 1. Fully supported claim
  const claim1 = {
    id: 'c1',
    text: 'PostgreSQL is an open-source database system with JSONB indexing.',
    startOffset: 0,
    endOffset: 65
  };
  const res1 = EvidenceMatcher.verifyClaim(claim1, passages);
  assert.equal(res1.status, 'SUPPORTED');
  assert.equal(res1.alignedPassageId, 'pass-1');
  assert.ok(res1.confidence >= 0.7);

  // 2. Contradicted claim (polarity negation)
  const claim2 = {
    id: 'c2',
    text: 'Redis is written in Rust.',
    startOffset: 0,
    endOffset: 25
  };
  const res2 = EvidenceMatcher.verifyClaim(claim2, passages);
  assert.equal(res2.status, 'CONTRADICTED');
  assert.equal(res2.alignedPassageId, 'pass-2');

  // 3. Unverified claim (hallucination / missing source)
  const claim3 = {
    id: 'c3',
    text: 'Apollo 11 landed on Mars during a solar flare.',
    startOffset: 0,
    endOffset: 46
  };
  const res3 = EvidenceMatcher.verifyClaim(claim3, passages);
  assert.equal(res3.status, 'UNVERIFIED');
});

test('ClaimTrace Report: computes aggregate faithfulness metrics across batch', () => {
  const passages: SourcePassage[] = [
    {
      id: 'p1',
      title: 'Company Factsheet',
      text: 'Acme Corp was founded in 2012 by Alice Zhang and Bob Miller.'
    }
  ];

  const claims = [
    { id: '1', text: 'Acme Corp was founded in 2012 by Alice Zhang.', startOffset: 0, endOffset: 45 },
    { id: '2', text: 'Supermassive black holes emit Hawking radiation in distant galaxies.', startOffset: 46, endOffset: 114 }
  ];

  const report = EvidenceMatcher.verifyAll(claims, passages);
  assert.equal(report.totalClaims, 2);
  assert.equal(report.statusCounts.SUPPORTED, 1);
  assert.equal(report.statusCounts.UNVERIFIED, 1);
  assert.equal(report.faithfulnessScore, 50);
});
