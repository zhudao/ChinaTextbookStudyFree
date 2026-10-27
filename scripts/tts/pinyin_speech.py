"""Mirror of the generation-only TS planner; shared rules + differential tests."""
import json,re,unicodedata,hashlib
from pathlib import Path
RULES=json.loads((Path(__file__).resolve().parents[2]/'packages/core/src/pinyinPronunciation.json').read_text())
CONTEXT,VOICE,RATE=(RULES[k] for k in ['version','voice','rate'])
READINGS={**RULES['initials'],**RULES['readings']};SYLLABLES=set(RULES['syllables']);SPELLING=set(RULES['explicit_spelling'])
TOKEN=re.compile(r'[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüɑɡ]+')
def base(t):return unicodedata.normalize('NFC',''.join(c for c in unicodedata.normalize('NFD',t) if c not in '\u0300\u0301\u0304\u030c'))
def first_tone(t):
 i=t.index('a') if 'a' in t else t.index('e') if 'e' in t else t.index('o') if 'ou' in t else max((i for i,c in enumerate(t) if c in 'aeiouü'),default=-1)
 return t if i<0 else t[:i]+dict(zip('aeiouü','āēīōūǖ'))[t[i]]+t[i+1:]
def pinyin_speech(text):
 changed=False
 s=unicodedata.normalize('NFC',text)
 for phrase,reading in RULES['phrases'].items():
  s,count=re.subn(re.escape(phrase).replace(r'\ ',r'\s+'),lambda _:reading,s)
  changed=changed or count>0
 def replace(m):
  nonlocal changed
  original=m.group();start,end=m.span()
  if original!=original.lower() or (start and re.match(r'[A-Za-z0-9]',s[start-1])) or (end<len(s) and re.match(r'[A-Za-z0-9]',s[end])):return original
  t=original.replace('ɑ','a').replace('ɡ','g')
  if t in READINGS:changed=True;return READINGS[t]
  if t in SPELLING:changed=True;return '拼写，'+'，'.join(READINGS.get(c,c) for c in t)
  if re.fullmatch(r'([aeo])\1+',t):changed=True;return '，'.join(READINGS[c] for c in t)
  b=base(t)
  if b not in SYLLABLES:return original
  changed=True;syllable=first_tone(t) if b==t else t;return RULES['anchors'].get(syllable,syllable)
 s=TOKEN.sub(replace,s)
 return s if changed else None
def needs_render(spoken):return any(m.group() in RULES['renderer_units'] for m in TOKEN.finditer(spoken))
def identity(text,spoken):
 units=[(m.group(),RULES['renderer_units'][m.group()]) for m in TOKEN.finditer(spoken) if m.group() in RULES['renderer_units']]
 rendered=['|'.join([t,u['anchor'],str(u['tone']),str(u['vowel_only']).lower()]) for t,u in units]
 return '\n'.join([CONTEXT,VOICE,RATE,text,spoken]+([RULES['renderer_version']]+rendered if rendered else []))
def audio_rel(text,spoken):
 source=hashlib.sha1(text.encode()).hexdigest();version=hashlib.sha256(identity(text,spoken).encode()).hexdigest()[:16]
 return f'{source[:2]}/{source}.pinyin-{version}.opus'
