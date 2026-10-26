import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { mathSpeech } from '../../packages/core/src/mathSpeech';

type Alias = { url: string; sha256: string; source_sha256?: string };
type Versions = { mapping: Record<string, Alias>; book_mapping?: Record<string, Record<string, Alias>> };

/** Check the spoken text identity, then the approved replacement's exact bytes. */
export function narrationVerifier(
  publicRoot = path.resolve('apps/web/public'),
  versions: Versions = JSON.parse(fs.readFileSync('release/audio-version-map.json', 'utf8')),
) {
  const hashes = new Map<string, string>();
  function asset(url: string): string {
    const file = path.resolve(publicRoot, url.slice(1));
    assert(url.startsWith('/audio/') && file.startsWith(path.resolve(publicRoot, 'audio') + path.sep), `Unsafe narration URL: ${url}`);
    assert(fs.existsSync(file) && fs.statSync(file).size > 0, `Missing speech asset: ${url}`);
    return file;
  }
  function verifyBytes(url: string, expected: string) {
    const file = asset(url);
    if (!hashes.has(file)) hashes.set(file, createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
    assert.equal(hashes.get(file), expected, `Narration bytes differ from approved mapping: ${url}`);
  }
  return (text: string, actual: string | null | undefined, bookId: string) => {
    assert(actual, `Missing speech reference for ${text}`);
    const digest = createHash('sha1').update(mathSpeech(text), 'utf8').digest('hex');
    const canonical = `/audio/${digest.slice(0, 2)}/${digest}.mp3`;
    let expected = canonical;
    const global = versions.mapping[expected];
    if (global) {
      verifyBytes(expected, global.sha256);
      verifyBytes(global.url, global.sha256);
      expected = global.url;
    }
    const scoped = versions.book_mapping?.[bookId]?.[expected];
    if (scoped) {
      assert(scoped.source_sha256, 'Edition narration lacks its source fingerprint');
      verifyBytes(expected, scoped.source_sha256);
      verifyBytes(scoped.url, scoped.sha256);
      expected = scoped.url;
    }
    assert.equal(actual, expected, `Text/speech mismatch: ${text}`);
    asset(actual);
  };
}
