#!/usr/bin/env python3
"""Keep rebuilt release data on the verified, cache-busting audio URLs."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def apply(public, mapping_file):
    if not mapping_file.is_file():
        print('[audio-versions] No release mapping; keeping generated URLs')
        return 0
    config = json.loads(mapping_file.read_text(encoding='utf-8'))
    mapping = config['mapping']
    book_mapping = config.get('book_mapping', {})
    audio_root = (public / 'audio').resolve()

    def asset(url):
        path = (public / url.lstrip('/')).resolve()
        if not url.startswith('/audio/') or not path.is_relative_to(audio_root):
            raise ValueError(f'Unsafe audio alias: {url}')
        if not path.is_file():
            raise ValueError(f'Missing audio alias: {url}')
        return path

    checked = {}
    def verify(url, expected):
        path = asset(url)
        if url not in checked:
            checked[url] = hashlib.sha256(path.read_bytes()).hexdigest()
        if checked[url] != expected:
            raise ValueError(f'Audio alias content mismatch: {url}')
    # Validate all aliases before modifying any generated document.
    for original, item in mapping.items():
        for url in [original, item['url']]:
            verify(url, item['sha256'])
    # A voice replacement can be scoped to an edition. Other books may share
    # the same text hash and must keep their existing audio and progress IDs.
    for book_id, aliases in book_mapping.items():
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', book_id):
            raise ValueError(f'Unsafe audio edition ID: {book_id}')
        if not (public / 'data/books' / book_id).is_dir():
            raise ValueError(f'Missing audio edition: {book_id}')
        for original, item in aliases.items():
            verify(original, item['source_sha256'])
            verify(item['url'], item['sha256'])
    changed = 0

    def replace(value, scoped):
        if isinstance(value, str):
            value = mapping[value]['url'] if value in mapping else value
            return scoped[value]['url'] if value in scoped else value
        if isinstance(value, list):
            return [replace(v, scoped) for v in value]
        if isinstance(value, dict):
            return {k: replace(v, scoped) for k, v in value.items()}
        return value

    for path in (public / 'data').rglob('*.json'):
        before = json.loads(path.read_text(encoding='utf-8'))
        relative = path.relative_to(public / 'data').parts
        scoped = book_mapping.get(relative[1], {}) if len(relative) > 2 and relative[0] == 'books' else {}
        after = replace(before, scoped)
        if after != before:
            path.write_text(json.dumps(after, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            changed += 1
    print(f'[audio-versions] Updated {changed} data documents')
    return changed


if __name__ == '__main__':
    apply(ROOT / 'apps/web/public', ROOT / 'release/audio-version-map.json')
