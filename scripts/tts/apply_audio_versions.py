#!/usr/bin/env python3
"""Keep rebuilt release data on the verified, cache-busting audio URLs."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def apply(public, mapping_file):
    if not mapping_file.is_file():
        print('[audio-versions] No release mapping; keeping generated URLs')
        return 0
    mapping = json.loads(mapping_file.read_text(encoding='utf-8'))['mapping']
    # Validate all aliases before modifying any generated document.
    for original, item in mapping.items():
        for url in [original, item['url']]:
            path = (public / url.lstrip('/')).resolve()
            if not url.startswith('/audio/') or not path.is_relative_to((public / 'audio').resolve()):
                raise ValueError(f'Unsafe audio alias: {url}')
            if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != item['sha256']:
                raise ValueError(f'Audio alias content mismatch: {url}')
    changed = 0

    def replace(value):
        if isinstance(value, str):
            return mapping[value]['url'] if value in mapping else value
        if isinstance(value, list):
            return [replace(v) for v in value]
        if isinstance(value, dict):
            return {k: replace(v) for k, v in value.items()}
        return value

    for path in (public / 'data').rglob('*.json'):
        before = json.loads(path.read_text(encoding='utf-8'))
        after = replace(before)
        if after != before:
            path.write_text(json.dumps(after, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            changed += 1
    print(f'[audio-versions] Updated {changed} data documents')
    return changed


if __name__ == '__main__':
    apply(ROOT / 'apps/web/public', ROOT / 'release/audio-version-map.json')
