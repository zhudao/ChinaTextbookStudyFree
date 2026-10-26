#!/usr/bin/env python3
"""Verify and group a complete release into primary, Web and iOS upload folders.

Archives stay byte-identical. Previous releases and compatibility URLs are untouched.
The combined local directory remains usable for offline installation and auditing.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def write(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')
    temporary.replace(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--combined', type=Path, required=True, help='Output of package-release.py')
    parser.add_argument('--ios', type=Path, required=True, help='Output of package-release-ios.sh')
    parser.add_argument('--site', type=Path, required=True)
    parser.add_argument('--validation', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True, help='New directory with three upload folders')
    args = parser.parse_args()
    installer = load('installer', ROOT/'scripts/install-release.py')
    packager = load('packager', ROOT/'scripts/package-release.py')
    guide = load('guide', ROOT/'scripts/release-download-guide.py')
    combined = args.combined.resolve()
    manifest = json.loads((combined/'manifest.json').read_text())
    tags = [installer.safe_name(manifest[key]) for key in ['tag', 'resource_tag', 'ios_resource_tag']]
    if len(set(tags)) != 3:
        raise ValueError('Primary, Web and iOS release tags must be different')
    if any(a['kind'].startswith('ios-') for a in manifest['assets']):
        raise ValueError('Use a fresh combined package before adding the iOS manifest')
    ios_path = args.ios/'ios-manifest.json'
    ios = json.loads(ios_path.read_text())
    index = json.loads((args.site/'data/index.json').read_text())
    if (len({b['bookId'] for b in ios['books']}) != len(ios['books']) or
            manifest['content']['books'] != len(index['books']) or
            {b['bookId'] for b in ios['books']} != {b['id'] for b in index['books']}):
        raise ValueError('iOS manifest and final site book IDs differ')
    inventory = manifest['file_inventory']
    inventory_path = combined/installer.safe_name(inventory['name'])
    if inventory_path.stat().st_size != inventory['bytes'] or packager.digest(inventory_path) != inventory['sha256']:
        raise ValueError('Web file inventory size/SHA-256 mismatch')
    json.loads(args.validation.read_text())
    pending = []
    for book in ios['books']:
        installer.safe_name(book['bookId'])
        for field, kind, prefix in [('data', 'ios-data', 'data-'), ('audio', 'ios-audio', 'audio-ios-')]:
            item = book[field]
            name = installer.safe_name(item['name'])
            if name != prefix+book['bookId']+'.zip':
                raise ValueError('Unexpected per-book bundle name')
            path = args.ios/name
            if path.stat().st_size != item['bytes'] or packager.digest(path) != item['sha256']:
                raise ValueError('iOS bundle size/SHA-256 mismatch: '+name)
            with zipfile.ZipFile(path) as archive:
                members = archive.infolist()
                for entry in members:
                    installer.target_path(Path('/package'), entry.filename)
                    if '.DS_Store' in Path(entry.filename).parts:
                        raise ValueError('Temporary file in iOS bundle')
                metadata = dict(item, kind=kind, destinations={},
                                files=sum(not e.is_dir() for e in members),
                                uncompressed_bytes=sum(e.file_size for e in members))
            pending.append((path, metadata))
    for asset in manifest['assets']:
        path = combined/installer.safe_name(asset['name'])
        if path.stat().st_size != asset['bytes'] or packager.digest(path) != asset['sha256']:
            raise ValueError('Web package size/SHA-256 mismatch: '+asset['name'])
    args.out.mkdir(parents=True, exist_ok=False)
    destinations = {tag: args.out/tag for tag in tags}
    for path in destinations.values(): path.mkdir()
    for source, item in pending:
        destination = combined/item['name']
        if destination.exists(): raise ValueError('Refusing to overwrite an existing local bundle')
        os.link(source, destination)
        manifest['assets'].append(item)
    shutil.copy2(ios_path, combined/'ios-manifest.json')
    shutil.copy2(args.validation, combined/'VALIDATION.json')
    for key, name in [('ios_manifest', 'ios-manifest.json'), ('validation', 'VALIDATION.json')]:
        path = combined/name
        manifest[key] = {'name': name, 'bytes': path.stat().st_size, 'sha256': packager.digest(path)}
    manifest['ios_manifest']['books'] = len(ios['books'])
    write(combined/'manifest.json', manifest)
    (combined/'DOWNLOADS.md').write_text(guide.render(manifest, ios, index))
    primary = {'manifest.json', 'install-release.py', 'INSTALL.md', 'DOWNLOADS.md', 'ios-manifest.json', 'VALIDATION.json'}
    owned = {a['name']: tags[2] if a['kind'].startswith('ios-') else tags[1] for a in manifest['assets']}
    owned.update({name: tags[0] for name in primary})
    owned['files.jsonl'] = tags[1]
    for name, tag in owned.items():
        source = combined/name
        destination = destinations[tag]/name
        if source.suffix == '.zip': os.link(source, destination)
        else: shutil.copy2(source, destination)
    # Native clients fetch the index beside the per-book bundles. Keep the
    # primary copy for the cross-platform download guide as well.
    shutil.copy2(combined/'ios-manifest.json', destinations[tags[2]]/'ios-manifest.json')
    # The primary checksum list also supports an offline folder containing a
    # user-selected subset; the installer still checks that subset is complete.
    checksums = ''.join(f'{packager.digest(combined/name)}  {name}\n' for name in sorted(owned))
    (combined/'SHA256SUMS').write_text(checksums)
    (destinations[tags[0]]/'SHA256SUMS').write_text(checksums)
    for tag in tags[1:]:
        directory = destinations[tag]
        (directory/'SHA256SUMS').write_text(''.join(f'{packager.digest(p)}  {p.name}\n' for p in sorted(directory.iterdir()) if p.is_file()))
    result = {'status': 'passed', 'primaryTag': tags[0], 'webTag': tags[1], 'iosTag': tags[2],
              'books': len(ios['books']), 'uploadedFilesPerRelease': {tag: len(list(p.iterdir())) for tag, p in destinations.items()},
              'binaryBytesUnchanged': True}
    write(args.out/'organization.json', result)
    print(json.dumps(result))


if __name__ == '__main__':
    main()
