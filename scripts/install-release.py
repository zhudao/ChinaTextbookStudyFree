#!/usr/bin/env python3
"""Install or upgrade verified release resources, source, or a ready-to-serve site."""
import argparse
import hashlib
import json
import os
import re
import shutil
import tarfile
import tempfile
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath

DEFAULT_TAG = 'v1.4.3-content-restored'
DESTINATIONS = {
    'audio.tar.gz': 'apps/web/public',
    'data.zip': 'apps/web/public/data',
    'data-source.zip': 'data',
    'story-images.zip': 'apps/web/public/story-images',
    'textbook-pages.zip': 'apps/web/public/textbook-pages',
}


def sha256(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def safe_name(name):
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*', name):
        raise ValueError(f'Unsafe asset name: {name}')
    return name


def target_path(destination, name):
    parts = PurePosixPath(name.replace('\\', '/'))
    if not name or parts.is_absolute() or '..' in parts.parts or ':' in name:
        raise ValueError(f'Unsafe archive path: {name}')
    target = destination.joinpath(*parts.parts)
    if not target.resolve().is_relative_to(destination.resolve()):
        raise ValueError(f'Archive path escapes destination: {name}')
    return target


def install_plan(manifest, mode='source', with_source=False):
    assets = manifest['assets']
    names = [safe_name(a['name']) for a in assets]
    if len(set(names)) != len(names):
        raise ValueError('Duplicate asset name')
    if manifest['schema_version'] == 1:
        destinations = dict(DESTINATIONS)
        if 'audio-web-mp3.tar.gz' in names:
            destinations['audio-web-mp3.tar.gz'] = 'apps/web/public'
        if mode == 'static':
            destinations = {n: ('.' if d == 'apps/web/public' else d.removeprefix('apps/web/public/'))
                            for n, d in destinations.items() if n != 'data-source.zip'}
            destinations['web-app.zip'] = '.'
        selected = [(a, destinations[a['name']]) for a in assets if a['name'] in destinations]
        if set(destinations) != {a['name'] for a, _ in selected}:
            raise ValueError('Incomplete legacy release manifest')
        return selected
    if manifest['schema_version'] != 2:
        raise ValueError('Unsupported manifest version')
    selected = [(a, a['destinations'][mode]) for a in assets
                if mode in a.get('destinations', {}) and (a.get('kind') != 'source' or with_source)]
    if not selected or not any(a.get('kind') == 'audio-web' for a, _ in selected):
        raise ValueError('Release has no installable Web audio')
    for _, destination in selected:
        target_path(Path('/installation'), destination)
    return selected


def read_inventory(cache, manifest, selected):
    if manifest['schema_version'] == 1:
        return None
    item = manifest['file_inventory']
    path = cache / safe_name(item['name'])
    if path.stat().st_size != item['bytes'] or sha256(path) != item['sha256']:
        raise ValueError('File inventory size/SHA-256 mismatch')
    wanted = {a['name'] for a, _ in selected}
    result, counts, sizes = {}, {}, {}
    with path.open(encoding='utf-8') as stream:
        for line in stream:
            row = json.loads(line)
            if row['archive'] not in wanted:
                continue
            key = (row['archive'], row['path'])
            if key in result:
                raise ValueError(f'Duplicate inventory entry: {key}')
            result[key] = row
            counts[row['archive']] = counts.get(row['archive'], 0) + 1
            sizes[row['archive']] = sizes.get(row['archive'], 0) + row['bytes']
    for asset, _ in selected:
        name = asset['name']
        if counts.get(name, 0) != asset['files'] or sizes.get(name, 0) != asset['uncompressed_bytes']:
            raise ValueError(f'Incomplete file inventory: {name}')
    return result


def extract(path, destination, expected=None):
    destination.mkdir(parents=True, exist_ok=True)
    seen = set()

    def save(name, stream, size, mode=0o644):
        name = name.replace('\\', '/')
        target = target_path(destination, name)
        if name in seen:
            raise ValueError(f'Duplicate archive path: {name}')
        seen.add(name)
        row = expected.get((path.name, name)) if expected is not None else None
        if expected is not None and (row is None or size != row['bytes']):
            raise ValueError(f'Unlisted or wrong-sized archive member: {name}')
        target.parent.mkdir(parents=True, exist_ok=True)
        with stream, target.open('wb') as dest:
            shutil.copyfileobj(stream, dest)
        target.chmod(0o755 if mode & 0o111 else 0o644)
        if row is not None and sha256(target) != row['sha256']:
            raise ValueError(f'Archive member SHA-256 mismatch: {name}')

    if path.suffix == '.zip':
        with zipfile.ZipFile(path) as archive:
            for item in archive.infolist():
                target_path(destination, item.filename)
                if (item.external_attr >> 16) & 0o170000 == 0o120000:
                    raise ValueError('Archive links are not supported')
                if not item.is_dir():
                    save(item.filename, archive.open(item), item.file_size, item.external_attr >> 16)
    else:
        with tarfile.open(path, 'r|gz') as archive:
            for item in archive:
                if not item.isfile():
                    raise ValueError('Only regular archive files are supported')
                save(item.name, archive.extractfile(item), item.size, item.mode)
    if expected is not None and seen != {name for archive, name in expected if archive == path.name}:
        raise ValueError(f'Missing archive members: {path.name}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tag', default=DEFAULT_TAG)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--mode', choices=['source', 'static'], default='source')
    parser.add_argument('--with-source', action='store_true', help='Also replace source files; back up local edits first')
    parser.add_argument('--archives-dir', type=Path, help='Use already downloaded archives and manifest')
    parser.add_argument('--verify-only', action='store_true', help='Verify packages and installed files without writing')
    args = parser.parse_args()
    safe_name(args.tag)
    if args.tag == 'latest':
        with urllib.request.urlopen('https://api.github.com/repos/wuwangzhang1216/ChinaTextbookStudyFree/releases/latest', timeout=60) as response:
            args.tag = safe_name(json.load(response)['tag_name'])
    if args.with_source and args.mode != 'source':
        parser.error('--with-source requires --mode source')
    root = args.root.resolve()
    with tempfile.TemporaryDirectory(prefix='china-study-assets-') as temporary:
        cache = args.archives_dir.resolve() if args.archives_dir else Path(temporary)
        base = f'https://github.com/wuwangzhang1216/ChinaTextbookStudyFree/releases/download/{args.tag}'

        def download(name):
            safe_name(name)
            if not args.archives_dir:
                print(f'Downloading {name}…', flush=True)
                urllib.request.urlretrieve(base + '/' + name, cache / name)

        download('manifest.json')
        manifest = json.loads((cache / 'manifest.json').read_text(encoding='utf-8'))
        if manifest.get('tag') != args.tag:
            raise ValueError('Manifest tag mismatch')
        selected = install_plan(manifest, args.mode, args.with_source)
        # Check every package before extracting or changing any installed file.
        for item, _ in selected:
            name = item['name']
            download(name)
            path = cache / name
            if path.stat().st_size != item['bytes'] or sha256(path) != item['sha256']:
                raise ValueError(f'Size/SHA-256 mismatch: {name}')
            print(f'Verified {name}', flush=True)
        if manifest['schema_version'] == 2:
            download(manifest['file_inventory']['name'])
        inventory = read_inventory(cache, manifest, selected)
        if args.verify_only:
            if inventory is None:
                raise ValueError('--verify-only requires a schema 2 release')
            destinations = {a['name']: d for a, d in selected}
            for (archive, name), row in inventory.items():
                target = target_path(root, str(PurePosixPath(destinations[archive]) / name))
                if not target.is_file() or target.stat().st_size != row['bytes'] or sha256(target) != row['sha256']:
                    raise ValueError(f'Installed file mismatch: {target}')
            print(f'Verified {len(inventory):,} installed files in {root}')
            return
        # Stage alongside the destination so final per-file replacements are atomic.
        root.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='.china-study-stage-', dir=root.parent) as staged:
            stage = Path(staged)
            for item, destination in selected:
                print(f"Staging {item['name']}…", flush=True)
                extract(cache / item['name'], target_path(stage, destination), inventory)
            staged_files = [p for p in stage.rglob('*') if p.is_file()]
            # Preflight existing symlinks/path blockers before committing any file.
            for path in staged_files:
                target = target_path(root, path.relative_to(stage).as_posix())
                if target.is_dir():
                    raise ValueError(f'A directory blocks an installed file: {target}')
                for parent in target.parents:
                    if parent == root.parent:
                        break
                    if parent.exists() and not parent.is_dir():
                        raise ValueError(f'A file blocks an installed directory: {parent}')
            root.mkdir(parents=True, exist_ok=True)
            for path in staged_files:
                target = target_path(root, path.relative_to(stage).as_posix())
                target.parent.mkdir(parents=True, exist_ok=True)
                os.replace(path, target)
            receipt = dict(manifest, installed_mode=args.mode, installed_with_source=args.with_source)
            (root / 'ASSETS-VERSION.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            print(f'Installed {args.tag}: {len(staged_files):,} files in {root}')


if __name__ == '__main__':
    main()
