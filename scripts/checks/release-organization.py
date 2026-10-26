"""Exercise actual release grouping with verified archives and failed preflight."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[2]


def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()


with tempfile.TemporaryDirectory() as temporary:
    base = Path(temporary)
    combined, ios, site = [base/name for name in ['combined', 'ios', 'site']]
    for directory in [combined, ios, site/'data']: directory.mkdir(parents=True)
    index = {'books': [{'id': 'g1up', 'subject': 'math', 'grade': 1, 'semester': 'up', 'textbookName': '一年级上册'}]}
    (site/'data/index.json').write_text(json.dumps(index))
    assets, inventory = [], []

    def archive(folder, name, member, payload):
        path = folder/name
        with zipfile.ZipFile(path, 'w') as z: z.writestr(member, payload)
        return {'name': name, 'bytes': path.stat().st_size, 'sha256': sha(path)}

    for name, kind, modes in [('audio-web-part01.zip', 'audio-web', {'source': 'apps/web/public', 'static': '.'}),
                              ('web-app.zip', 'web', {'static': '.'}), ('web-source.zip', 'source', {'source': '.'})]:
        payload = name.encode();member = 'fixture.txt'
        item = archive(combined, name, member, payload)
        item.update(kind=kind, destinations=modes, files=1, uncompressed_bytes=len(payload));assets.append(item)
        inventory.append({'archive': name, 'path': member, 'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()})
    for name, kind in [('install-release.py', 'installer'), ('INSTALL.md', 'instructions')]:
        path = combined/name;path.write_text('fixture')
        assets.append({'name': name, 'kind': kind, 'destinations': {}, 'bytes': path.stat().st_size, 'sha256': sha(path)})
    (combined/'files.jsonl').write_text(''.join(json.dumps(i)+'\n' for i in inventory))
    inv = combined/'files.jsonl'
    manifest = {'schema_version': 2, 'tag': 'fixture', 'resource_tag': 'fixture-web', 'ios_resource_tag': 'fixture-ios',
                'content': {'books': 1}, 'assets': assets,
                'file_inventory': {'name': inv.name, 'bytes': inv.stat().st_size, 'sha256': sha(inv)}}
    (combined/'manifest.json').write_text(json.dumps(manifest))
    data = archive(ios, 'data-g1up.zip', 'books/g1up/outline.json', b'{}')
    audio = archive(ios, 'audio-ios-g1up.zip', 'audio/aa/test.m4a', b'fixture')
    (ios/'ios-manifest.json').write_text(json.dumps({'books': [{'bookId': 'g1up', 'data': data, 'audio': audio}]}))
    validation = base/'validation.json';validation.write_text('{"local":"passed","online":"pending"}')
    out = base/'grouped'
    command = [sys.executable, str(ROOT/'scripts/organize-release.py'), '--combined', str(combined), '--ios', str(ios),
               '--site', str(site), '--validation', str(validation), '--out', str(out)]
    before = (combined/'manifest.json').read_bytes()
    sound = ios/audio['name'];sound_bytes = sound.read_bytes();sound.write_bytes(b'corrupt')
    failed = subprocess.run(command, capture_output=True, text=True)
    assert failed.returncode != 0 and not out.exists()
    assert (combined/'manifest.json').read_bytes() == before and not (combined/data['name']).exists()
    sound.write_bytes(sound_bytes)
    result = subprocess.run(command, capture_output=True, text=True)
    assert result.returncode == 0, result.stdout+result.stderr
    primary, web, mobile = [out/name for name in ['fixture', 'fixture-web', 'fixture-ios']]
    assert {p.name for p in primary.iterdir()} == {'manifest.json', 'INSTALL.md', 'install-release.py', 'DOWNLOADS.md', 'VALIDATION.json', 'ios-manifest.json', 'SHA256SUMS'}
    assert (web/'files.jsonl').read_bytes() == inv.read_bytes()
    assert (web/'web-app.zip').read_bytes() == (combined/'web-app.zip').read_bytes()
    assert (mobile/audio['name']).read_bytes() == sound_bytes
    # The native downloader resolves both its index and bundles from the same
    # release base URL; the central guide's index alone cannot serve the app.
    native_index = json.loads((mobile/'ios-manifest.json').read_text())
    assert native_index == json.loads((primary/'ios-manifest.json').read_text())
    for book in native_index['books']:
        for field in ['data', 'audio']:
            bundle = book[field]
            assert sha(mobile/bundle['name']) == bundle['sha256']
    assert not list(primary.glob('*.zip')) and not (web/data['name']).exists()
    merged = json.loads((primary/'manifest.json').read_text())
    assert len(merged['assets']) == 7
    assert merged['ios_manifest']['sha256'] == sha(primary/'ios-manifest.json')
    guide = (primary/'DOWNLOADS.md').read_text()
    assert '/fixture-web/web-source.zip' in guide and '/fixture-ios/data-g1up.zip' in guide
    for line in (primary/'SHA256SUMS').read_text().splitlines():
        digest, name = line.split('  ');assert sha(combined/name) == digest
print('PASS: three release groups, matching metadata/navigation, unchanged archives and corrupt-iOS preflight without writes')
