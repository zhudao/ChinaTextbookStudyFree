#!/usr/bin/env python3
"""Verify that each revised edition uses only its validated Edge audio aliases."""
import argparse
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]

def urls(value):
    if isinstance(value, str) and value.startswith('/audio/'):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from urls(item)
    elif isinstance(value, dict):
        for item in value.values():
            yield from urls(item)

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--public', type=Path, default=ROOT/'apps/web/public')
    p.add_argument('--mapping', type=Path, default=ROOT/'release/audio-version-map.json')
    p.add_argument('--report', type=Path, default=ROOT/'deploy-output/edition-audio-validation.json')
    args = p.parse_args()
    config = json.loads(args.mapping.read_text())
    catalog = json.loads((ROOT/'content/editions/2026/catalog.json').read_text())
    assert config['book_voice_refresh']['provider'] == 'Microsoft EdgeTTS'
    assert set(config['book_mapping']) == {b['id'] for b in catalog['books']}
    checked, books = {}, []
    for book_id, aliases in config['book_mapping'].items():
        expected = {item['url']: item['sha256'] for item in aliases.values()}
        actual = {url for file in (args.public/'data/books'/book_id).rglob('*.json')
                  for url in urls(json.loads(file.read_text()))}
        assert actual == set(expected), (book_id, 'unexpected/missing Edge references', actual.symmetric_difference(expected.keys()))
        for url, digest in expected.items():
            assert re.fullmatch(r'/audio/[a-f0-9]{2}/[a-f0-9]{40}\.edge-'+digest[:12]+r'\.mp3', url), url
            if url in checked:
                assert checked[url] == digest
                continue
            mp3 = args.public/url.lstrip('/')
            raw = mp3.read_bytes()
            assert hashlib.sha256(raw).hexdigest() == digest, url
            assert raw.startswith(b'ID3') or (raw[0] == 255 and raw[1] & 224 == 224), url
            opus = mp3.with_suffix('.opus')
            with opus.open('rb') as f:
                assert f.read(4) == b'OggS', str(opus)
            checked[url] = digest
        books.append({'bookId': book_id, 'edge_references': len(actual)})
    result = {'status': 'passed', 'books': books, 'unique_edge_mp3': len(checked),
              'mp3_sha256': 'passed', 'matching_opus_present': True, 'unversioned_current_references': 0}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(result))

if __name__ == '__main__':
    main()
