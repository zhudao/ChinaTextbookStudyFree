"""Exercise split-package fresh installs, upgrades, corruption and path isolation."""
import hashlib
import importlib.util
import json
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


pack = load('packager', ROOT / 'scripts/package-release.py')
alias = load('aliases', ROOT / 'scripts/tts/apply_audio_versions.py')
with tempfile.TemporaryDirectory() as temporary:
    tmp = Path(temporary);cache = tmp / 'archives';cache.mkdir()
    assets, records = [], []

    def archive(name, kind, destinations, members):
        with zipfile.ZipFile(cache / name, 'w') as z:
            for path, payload in members.items():
                z.writestr(path, payload)
                records.append({'archive': name, 'path': path, 'bytes': len(payload),
                                'sha256': hashlib.sha256(payload).hexdigest()})
        raw = (cache / name).read_bytes()
        assets.append({'name': name, 'kind': kind, 'destinations': destinations,
                       'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(),
                       'files': len(members), 'uncompressed_bytes': sum(map(len, members.values()))})

    for i in (1, 2):
        archive(f'audio-original-part{i:02d}.zip', 'audio-original', {'source': 'apps/web/public', 'static': '.'},
                {f'audio/aa/{i}.opus': f'new original {i}'.encode()})
        archive(f'audio-web-part{i:02d}.zip', 'audio-web', {'source': 'apps/web/public', 'static': '.'},
                {f'audio/aa/{i}.mp3': f'new web {i}'.encode()})
    archive('data.zip', 'data', {'source': 'apps/web/public/data', 'static': 'data'}, {'index.json': b'{"new":true}'})
    archive('web-app.zip', 'web', {'static': '.'}, {'index.html': b'current page', 'sw.js': b'current cache version'})
    archive('web-source.zip', 'source', {'source': '.'}, {'README.md': b'current instructions'})

    def manifest():
        inventory = ''.join(json.dumps(r) + '\n' for r in records).encode()
        (cache / 'files.jsonl').write_bytes(inventory)
        value = {'schema_version': 2, 'tag': 'fixture', 'assets': assets,
                 'file_inventory': {'name': 'files.jsonl', 'bytes': len(inventory), 'sha256': hashlib.sha256(inventory).hexdigest()}}
        (cache / 'manifest.json').write_text(json.dumps(value))

    manifest()

    def run(target, mode='static', extra=(), success=True):
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/install-release.py'), '--tag', 'fixture',
                                 '--root', str(target), '--mode', mode, '--archives-dir', str(cache), *extra],
                                capture_output=True, text=True)
        assert (result.returncode == 0) == success, result.stdout + result.stderr
        return result

    fresh = tmp / 'fresh';run(fresh);run(fresh, extra=['--verify-only'])
    upgrade = tmp / 'upgrade';(upgrade / 'audio/aa').mkdir(parents=True)
    (upgrade / 'index.html').write_bytes(b'old page');(upgrade / 'audio/aa/1.mp3').write_bytes(b'old GPT')
    (upgrade / 'notes.txt').write_bytes(b'keep custom file')
    run(upgrade);run(upgrade, extra=['--verify-only'])
    assert (upgrade / 'notes.txt').read_bytes() == b'keep custom file'
    for p in fresh.rglob('*'):
        if p.is_file():assert p.read_bytes() == (upgrade / p.relative_to(fresh)).read_bytes()
    source = tmp / 'source';run(source, mode='source', extra=['--with-source'])
    run(source, mode='source', extra=['--with-source', '--verify-only'])
    assert (source / 'README.md').read_bytes() == b'current instructions'
    (upgrade / 'audio/aa/1.mp3').write_bytes(b'corrupt installed file')
    run(upgrade, extra=['--verify-only'], success=False)
    run(upgrade)
    # The last corrupt split must prevent every installed file from changing.
    before = {p.relative_to(upgrade): p.read_bytes() for p in upgrade.rglob('*') if p.is_file()}
    audio = cache / 'audio-web-part02.zip';original = audio.read_bytes();audio.write_bytes(b'broken part')
    run(upgrade, success=False)
    assert all((upgrade / rel).read_bytes() == raw for rel, raw in before.items())
    audio.unlink();run(upgrade, success=False);audio.write_bytes(original)
    # A malicious but correctly checksummed archive still cannot escape staging.
    archive('escape.zip', 'data', {'static': '.'}, {'../escaped.txt': b'bad'})
    manifest();run(upgrade, success=False)
    assert not (tmp / 'escaped.txt').exists()
    assert all((upgrade / rel).read_bytes() == raw for rel, raw in before.items())
    # Verify split boundaries and complete membership with differently sized files.
    entries = []
    for i, size in enumerate([500, 1600, 500, 1600]):
        p = tmp / f'{i}.mp3';p.write_bytes(b'a' * size);entries.append((p, p.name))
    chunks = pack.split_audio(entries, 6000)
    assert len(chunks) > 1 and [item for part in chunks for item in part] == entries
    inventory = (tmp / 'test-inventory.jsonl').open('w')
    for i, part in enumerate(chunks):
        out = tmp / f'part{i}.zip';pack.write_zip(out, part, inventory, stored=True);assert out.stat().st_size < 6000
    inventory.close()
    # A stale alias must fail before changing generated JSON.
    public = tmp / 'public';(public / 'audio/aa').mkdir(parents=True);(public / 'data').mkdir()
    a = public / 'audio/aa/a.mp3';b = public / 'audio/aa/a.edge-test.mp3';a.write_bytes(b'audio');b.write_bytes(b'audio')
    data = public / 'data/index.json';data.write_text('{"text":"keep text","audio":"/audio/aa/a.mp3"}')
    mapping = tmp / 'map.json';mapping.write_text(json.dumps({'mapping': {'/audio/aa/a.mp3': {'url': '/audio/aa/a.edge-test.mp3', 'sha256': hashlib.sha256(b'audio').hexdigest()}}}))
    assert alias.apply(public, mapping) == 1
    assert json.loads(data.read_text()) == {'text': 'keep text', 'audio': '/audio/aa/a.edge-test.mp3'}
    before_data = data.read_bytes();b.write_bytes(b'changed')
    try:alias.apply(public, mapping)
    except ValueError:pass
    else:raise AssertionError('Mismatched alias accepted')
    assert data.read_bytes() == before_data
print('PASS: split-package fresh/source installs, upgrades, preservation, corruption, missing parts, traversal and audio alias validation')
