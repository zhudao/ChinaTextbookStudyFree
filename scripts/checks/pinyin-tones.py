"""Measure all four actually encoded vowel options; no TTS/network requests."""
import argparse,json,sys
from pathlib import Path
import numpy as np
import parselmouth
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/tts'))
from pinyin_render import pcm

def verify(content,order):
 samples=np.frombuffer(pcm(content),dtype='<i2').astype(float)/32768
 frames=samples[:len(samples)//160*160].reshape(-1,160)
 rms=np.sqrt(np.mean(frames**2,axis=1));active=np.where(rms>max(rms)*.1)[0]
 groups=np.split(active,np.where(np.diff(active)>4)[0]+1)
 assert len(groups)==4,('Missing/merged vowels',len(groups))
 rows=[]
 for token,g in zip(order.split(),groups):
  tone='āáǎà'.index(token)+1
  sound=parselmouth.Sound(samples[max(0,(g[0]-2)*160):(g[-1]+3)*160],sampling_frequency=16000)
  pitch=sound.to_pitch_ac(time_step=.01,pitch_floor=80,pitch_ceiling=500)
  freq=pitch.selected_array['frequency'];freq=freq[freq>0];assert len(freq)>15
  start=float(np.median(freq[:5]));end=float(np.median(freq[-5:]));low=float(min(freq))
  row={'vowel':token,'tone':tone,'startHz':round(start,1),'endHz':round(end,1),'minHz':round(low,1)};rows.append(row)
  if tone==1:assert abs(end-start)<20,row
  if tone==2:assert end-start>70,row
  if tone==3:assert start-low>40 and end-low>25,row
  if tone==4:assert start-end>100,row
 return rows

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--audio-root',type=Path,default=ROOT/'apps/web/public/audio');p.add_argument('--manifest',type=Path,default=ROOT/'release/pinyin-audio-manifest.json');p.add_argument('--extension',default='.mp3');p.add_argument('--report',type=Path,default=ROOT/'deploy-output/pinyin-tone-contours.json');args=p.parse_args()
 rows=[]
 for r in json.loads(args.manifest.read_text())['items']:
  if sorted(r['source_text'].split())!=sorted('ā á ǎ à'.split()):continue
  rel=Path(r['url'].removeprefix('/audio/')).with_suffix(args.extension)
  rows.append({'text':r['source_text'],'url':'/audio/'+rel.as_posix(),'measuredContours':verify((args.audio_root/rel).read_bytes(),r['source_text'])})
 assert len(rows)==4,len(rows)
 report={'status':'passed','encodedOptions':4,'completeVowels':16,'allToneOrdersCorrect':True,'teacherAcceptanceClaimed':False,'items':rows};args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='items'}))
if __name__=='__main__':main()
