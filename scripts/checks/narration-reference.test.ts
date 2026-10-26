import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { mathSpeech } from '../../packages/core/src/mathSpeech';
import { narrationVerifier } from './narration-reference';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'narration-contract-'));
try {
  const text = '算式 $10 - (2 + 3)$ 应先算加法。';
  const hash = createHash('sha1').update(mathSpeech(text)).digest('hex');
  const canonical = `/audio/${hash.slice(0, 2)}/${hash}.mp3`;
  const globalURL = canonical.replace('.mp3', '.edge-global.mp3');
  const editionURL = canonical.replace('.mp3', '.edge-edition.mp3');
  const write = (url: string, content: string) => {
    const target = path.join(root, url.slice(1));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    return createHash('sha256').update(content).digest('hex');
  };
  const sourceHash = write(canonical, 'approved global voice');
  write(globalURL, 'approved global voice');
  const editionHash = write(editionURL, 'approved edition voice');
  const config = { mapping: { [canonical]: { url: globalURL, sha256: sourceHash } },
    book_mapping: { revised: { [globalURL]: { url: editionURL, sha256: editionHash, source_sha256: sourceHash } } } };
  const verify = narrationVerifier(root, config);
  verify(text, globalURL, 'legacy');
  verify(text, editionURL, 'revised');
  assert.throws(() => verify(text, editionURL, 'legacy'), /Text\/speech mismatch/);
  assert.throws(() => verify('算式 $10 + 2$。', globalURL, 'legacy'), /Text\/speech mismatch/);
  assert.throws(() => verify(text, null, 'legacy'), /Missing speech/);
  write(editionURL, 'different audio');
  assert.throws(() => narrationVerifier(root, config)(text, editionURL, 'revised'), /bytes differ/);
  fs.unlinkSync(path.join(root, globalURL.slice(1)));
  assert.throws(() => narrationVerifier(root, config)(text, globalURL, 'legacy'), /Missing speech asset/);
  console.log('PASS: normalized formulas and scoped Edge voices; wrong text, wrong scope, missing audio and corrupt bytes rejected.');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
