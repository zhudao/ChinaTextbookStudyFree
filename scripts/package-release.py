#!/usr/bin/env python3
"""Package a verified site, matching source, and independently extractable audio parts."""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MEDIA = {'audio', 'data', 'story-images', 'textbook-pages'}


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def files(base):
    return sorted(p for p in base.rglob('*') if p.is_file()
                  and not any(part.startswith('.') for part in p.relative_to(base).parts))


def split_audio(entries, limit):
    parts, current, size = [], [], 0
    for path, name in entries:
        # Conservative allowance for ZIP headers and UTF-8 filenames.
        estimate = path.stat().st_size + 2 * len(name.encode('utf-8')) + 1024
        if estimate + 1024 > limit:
            raise ValueError(f'Audio file exceeds part limit: {name}')
        if current and size + estimate + 1024 > limit:
            parts.append(current)
            current, size = [], 0
        current.append((path, name))
        size += estimate
    if current:
        parts.append(current)
    return parts


def write_zip(destination, entries, inventory, stored=False):
    total = 0
    with zipfile.ZipFile(destination, 'w', compression=zipfile.ZIP_STORED if stored else zipfile.ZIP_DEFLATED,
                         compresslevel=None if stored else 6, allowZip64=True) as archive:
        for i, (source, name) in enumerate(entries, 1):
            if name.startswith('/') or '..' in Path(name).parts or '\\' in name:
                raise ValueError(f'Unsafe archive member: {name}')
            mode = 0o644
            if isinstance(source, Path):
                if source.is_symlink():
                    raise ValueError(f'Symlink cannot be packaged: {source}')
                mode = source.stat().st_mode & 0o777
                if source.suffix in {'.py', '.ts', '.tsx', '.mjs', '.json', '.md', '.sh', '.ps1'}:
                    if re.search(rb'(?:sk-or-v1-|sk-local-)[A-Za-z0-9_-]{20,}', source.read_bytes()):
                        raise ValueError(f'Credential detected in {name}')
            info = zipfile.ZipInfo(name)
            info.compress_type = zipfile.ZIP_STORED if stored else zipfile.ZIP_DEFLATED
            info.external_attr = (0o100000 | (0o755 if mode & 0o111 else 0o644)) << 16
            h, size = hashlib.sha256(), 0
            with archive.open(info, 'w', force_zip64=True) as target:
                if isinstance(source, Path):
                    with source.open('rb') as stream:
                        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                            target.write(chunk);h.update(chunk);size += len(chunk)
                else:
                    target.write(source);h.update(source);size = len(source)
            total += size
            inventory.write(json.dumps({'archive': destination.name, 'path': name, 'bytes': size,
                                        'sha256': h.hexdigest()}, ensure_ascii=False) + '\n')
            if i % 25000 == 0:
                print(f'  {destination.name}: {i:,}/{len(entries):,}', flush=True)
    return total


def content_statistics(site):
    index = json.loads((site / 'data/index.json').read_text(encoding='utf-8'))
    lessons = [json.loads(p.read_text(encoding='utf-8')) for p in (site / 'data/books').glob('*/lessons/*.json')]
    passages, stories = 0, 0
    for p in (site / 'data/books').glob('*/passages.json'):
        passages += len(json.loads(p.read_text(encoding='utf-8')).get('passages', []))
    for p in (site / 'data/books').glob('*/stories.json'):
        stories += len(json.loads(p.read_text(encoding='utf-8')).get('stories', []))
    return {'books': len(index['books']), 'active_books': sum(not b.get('supersededBy') for b in index['books']),
            'lessons': len(lessons), 'unit_questions': sum(len(d.get('questions', [])) for d in lessons),
            'regular_lessons': sum('-exam' not in d['id'] for d in lessons),
            'challenge_lessons': sum('-exam' in d['id'] for d in lessons),
            'regular_questions': sum(len(d.get('questions', [])) for d in lessons if '-exam' not in d['id']),
            'challenge_questions': sum(len(d.get('questions', [])) for d in lessons if '-exam' in d['id']),
            'passages': passages, 'stories': stories}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('tag')
    parser.add_argument('--site-root', type=Path, required=True, help='Verified final static site, including data and media')
    parser.add_argument('--out', type=Path)
    parser.add_argument('--max-audio-bytes', type=int, default=1_400_000_000)
    parser.add_argument('--resource-tag', help='Separate release holding the Web archives and file inventory')
    parser.add_argument('--ios-resource-tag', help='Separate release holding the per-book iOS bundles')
    args = parser.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*', args.tag) or args.max_audio_bytes < 4096:
        parser.error('Invalid tag or audio part limit')
    for tag in (args.resource_tag, args.ios_resource_tag):
        if tag is not None and not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*', tag):
            parser.error('Resource tags must be release names in this repository')
    site = args.site_root.resolve()
    out = args.out or ROOT / 'release-assets' / args.tag
    if not (site / 'index.html').is_file():
        raise ValueError('Missing verified static site')
    subprocess.run([sys.executable, str(ROOT / 'scripts/checks/content-retention.py'),
                    '--public', str(site), '--report', str(ROOT / 'deploy-output/package-content-retention.json')],
                   check=True)
    out.mkdir(parents=True, exist_ok=False)
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    manifest = {'schema_version': 2, 'tag': args.tag, 'created_at': datetime.now(timezone.utc).isoformat(),
                'source_commit': commit, 'audio_part_limit_bytes': args.max_audio_bytes,
                'content': content_statistics(site), 'assets': []}
    if args.resource_tag:
        manifest['resource_tag'] = args.resource_tag
    if args.ios_resource_tag:
        manifest['ios_resource_tag'] = args.ios_resource_tag
    with (out / 'files.jsonl').open('w', encoding='utf-8') as inventory:
        def pack(name, entries, kind, destinations, stored=False):
            if not entries:
                raise ValueError(f'No files for {name}')
            print(f'Packing {name}: {len(entries):,} files', flush=True)
            total = write_zip(out / name, entries, inventory, stored)
            item = {'name': name, 'kind': kind, 'destinations': destinations,
                    'bytes': (out / name).stat().st_size, 'sha256': digest(out / name),
                    'files': len(entries), 'uncompressed_bytes': total}
            if item['bytes'] >= 2_000_000_000:
                raise ValueError(f'Asset too large: {name}')
            manifest['assets'].append(item)
            print(json.dumps(item, ensure_ascii=False), flush=True)

        for suffix, kind in [('.opus', 'audio-original'), ('.mp3', 'audio-web')]:
            entries = [(p, 'audio/' + p.relative_to(site / 'audio').as_posix())
                       for p in files(site / 'audio') if p.suffix == suffix]
            destinations = {'source': 'apps/web/public', 'static': '.'}
            for i, part in enumerate(split_audio(entries, args.max_audio_bytes), 1):
                name = f'{kind}-part{i:02d}.zip'
                pack(name, part, kind, destinations, stored=True)
                if (out / name).stat().st_size > args.max_audio_bytes:
                    raise ValueError(f'Audio part exceeds configured limit: {name}')
        for folder in ['data', 'story-images', 'textbook-pages']:
            entries = [(p, p.relative_to(site / folder).as_posix()) for p in files(site / folder)]
            pack(folder + '.zip', entries, folder,
                 {'source': 'apps/web/public/' + folder, 'static': folder}, stored=folder != 'data')
        entries = [(p, p.relative_to(ROOT / 'data').as_posix())
                   for kind in ['passages', 'stories'] for p in files(ROOT / 'data' / kind) if p.suffix == '.json']
        pack('data-source.zip', entries, 'source-data', {'source': 'data'})
        cache = ROOT / 'deploy-output/web-audio-manifest.json'
        if cache.is_file():
            pack('web-audio-cache.zip', [(cache, 'web-audio-manifest.json')], 'build-cache', {'source': 'deploy-output'})
        entries = [(p, p.relative_to(site).as_posix()) for p in files(site)
                   if p.relative_to(site).parts[0] not in MEDIA]
        pack('web-app.zip', entries, 'web', {'static': '.'})
        tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).split(b'\0')
        entries = []
        for raw in tracked:
            if not raw:
                continue
            name = raw.decode('utf-8');path = ROOT / name
            if path.is_file() and not path.is_symlink() and not any(x in {'.env', '.git', 'node_modules'} for x in path.parts):
                entries.append((path, name))
        entries.append((json.dumps({'tag': args.tag, 'source_commit': commit,
                                   'description': 'Matching Web/core, build inputs, release installer and documentation.'},
                                  indent=2).encode(), 'SOURCE-VERSION.json'))
        pack('web-source.zip', entries, 'source', {'source': '.'})
    inventory = out / 'files.jsonl'
    manifest['file_inventory'] = {'name': inventory.name, 'bytes': inventory.stat().st_size,
                                 'sha256': digest(inventory)}
    for source, name, kind in [(ROOT / 'scripts/install-release.py', 'install-release.py', 'installer'),
                               (ROOT / 'docs/release-install.md', 'INSTALL.md', 'instructions')]:
        shutil.copy2(source, out / name)
        manifest['assets'].append({'name': name, 'kind': kind, 'destinations': {},
                                   'bytes': (out / name).stat().st_size, 'sha256': digest(out / name)})
    (out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    checksums = ''.join(f'{digest(p)}  {p.name}\n' for p in sorted(out.iterdir()) if p.is_file())
    (out / 'SHA256SUMS').write_text(checksums, encoding='utf-8')
    print(f'PACKAGING COMPLETE: {out}', flush=True)


if __name__ == '__main__':
    main()
