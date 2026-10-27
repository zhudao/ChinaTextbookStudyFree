"""Render Edge-swallowed tone symbols using Edge vowels and local Praat PSOLA.

Only the shared rule table's explicit units are rendered. Text/prose and anchored
syllables continue through Edge unchanged. Requires ffmpeg, numpy and
praat-parselmouth for generation; no runtime/frontend dependency.
"""
import asyncio
import hashlib
import io
import json
import re
import subprocess
import wave
from pathlib import Path
from pinyin_speech import RULES, TOKEN

CACHE = Path(__file__).resolve().parents[2] / 'deploy-output/pinyin-render-cache'
LOCKS = {}
CURVES = {
    1: [(0, 260), (1, 260)],
    2: [(0, 185), (.2, 190), (1, 315)],
    3: [(0, 230), (.55, 135), (.72, 140), (1, 205)],
    4: [(0, 330), (.15, 320), (1, 155)],
}


def pcm(mp3):
    data = subprocess.run(['ffmpeg', '-v', 'error', '-i', 'pipe:0', '-ar', '16000',
                           '-ac', '1', '-f', 'wav', 'pipe:1'], input=mp3,
                          check=True, capture_output=True).stdout
    with wave.open(io.BytesIO(data)) as source:
        return source.readframes(source.getnframes())


def shape(mp3, unit):
    import numpy as np
    import parselmouth
    from parselmouth.praat import call
    values = np.frombuffer(pcm(mp3), dtype='<i2').astype(float) / 32768
    sound = parselmouth.Sound(values, sampling_frequency=16000)
    pitch = sound.to_pitch_ac(time_step=.005, pitch_floor=80, pitch_ceiling=500)
    times = pitch.xs()[pitch.selected_array['frequency'] > 0]
    if len(times) < 8:
        raise ValueError('Cannot identify voiced phonetic anchor')
    # Keep consonants for full syllables; vowel-only finals exclude the anchor's
    # initial plosive (e.g. 东 -> ong). Preserve a short onset/release margin.
    energy = np.sqrt(np.convolve(values ** 2, np.ones(160) / 160, mode='same'))
    active = np.flatnonzero(energy > energy.max() * .08)
    start = max(0, (times[0] - .015) if unit['vowel_only'] else active[0] / 16000 - .02)
    end = min(len(values) / 16000, active[-1] / 16000 + .025)
    sound = sound.extract_part(from_time=start, to_time=end, preserve_times=False)
    duration = sound.get_total_duration()
    # A complete third tone needs room for its fall and rise.
    if duration < .55:
        sound = call(sound, 'Lengthen (overlap-add)', 80, 500, .55 / duration)
        duration = sound.get_total_duration()
    pitch = sound.to_pitch_ac(time_step=.005, pitch_floor=80, pitch_ceiling=500)
    voiced = pitch.xs()[pitch.selected_array['frequency'] > 0]
    first, last = float(voiced[0]), float(voiced[-1])
    manipulation = call(sound, 'To Manipulation', .005, 80, 500)
    tier = call(manipulation, 'Extract pitch tier')
    call(tier, 'Remove points between', 0, duration)
    for fraction, frequency in CURVES[unit['tone']]:
        call(tier, 'Add point', first + fraction * (last - first), frequency)
    call([tier, manipulation], 'Replace pitch tier')
    rendered = call(manipulation, 'Get resynthesis (overlap-add)')
    rendered.scale_peak(.8)
    output = rendered.values[0]
    # Small fades avoid clicks at concatenation boundaries.
    fade = min(160, len(output)//10)
    output[:fade] *= np.linspace(0,1,fade)
    output[-fade:] *= np.linspace(1,0,fade)
    return (np.clip(output,-1,1)*32767).astype('<i2').tobytes()


async def render(spoken, synthesize):
    """synthesize is an async, rate-limited Edge call returning MP3 bytes."""
    segments=[];cursor=0
    for match in TOKEN.finditer(spoken):
        unit=RULES['renderer_units'].get(match.group())
        if not unit:
            continue
        if match.start()>cursor:segments.append((spoken[cursor:match.start()],None))
        segments.append((match.group(),unit));cursor=match.end()
    if cursor<len(spoken):segments.append((spoken[cursor:],None))
    CACHE.mkdir(parents=True,exist_ok=True)
    parts=[]
    for text,unit in segments:
        if not re.search(r'[\w\u4e00-\u9fff]',text):
            continue
        anchor=unit['anchor'] if unit else text
        key=hashlib.sha256(('\n'.join([RULES['voice'],RULES['rate'],anchor])).encode()).hexdigest()
        async with LOCKS.setdefault(key,asyncio.Lock()):
            source=CACHE/(key+'.mp3')
            if not source.exists():
                content=await synthesize(anchor)
                if not content:raise ValueError('Empty Edge anchor audio')
                source.write_bytes(content)
            content=source.read_bytes()
        part=await asyncio.to_thread(shape,content,unit) if unit else await asyncio.to_thread(pcm,content)
        parts.append(part)
    if not parts:raise ValueError('No phonetic segments')
    # Teaching sounds are deliberately separated; never merge/suppress an option.
    samples=(b'\0\0'*1280).join(parts)
    result=await asyncio.to_thread(subprocess.run,
        ['ffmpeg','-v','error','-f','s16le','-ar','16000','-ac','1','-i','pipe:0',
         '-c:a','libmp3lame','-b:a','64k','-f','mp3','pipe:1'],
        input=samples,check=True,capture_output=True)
    return result.stdout
