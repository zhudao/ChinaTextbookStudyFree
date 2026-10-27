/** Generation-only speech plan. Display, answers and IDs are never rewritten. */
import rules from './pinyinPronunciation.json';
export const PINYIN_CONTEXT = rules.version;
export const PINYIN_VOICE = rules.voice;
export const PINYIN_RATE = rules.rate;
const readings: Record<string,string> = {...rules.initials,...rules.readings};
const syllables = new Set(rules.syllables);
const spelling = new Set(rules.explicit_spelling);
const anchors: Record<string,string> = rules.anchors;
const tones = /[\u0300\u0301\u0304\u030c]/g;
function base(t:string):string {return t.normalize('NFD').replace(tones,'').normalize('NFC');}
function firstTone(t:string):string {
  const index=t.includes('a')?t.indexOf('a'):t.includes('e')?t.indexOf('e'):t.includes('ou')?t.indexOf('o'):Math.max(...[...t].flatMap((c,i)=>'aeiouü'.includes(c)?[i]:[]));
  if(index<0)return t;
  return t.slice(0,index)+({a:'ā',e:'ē',i:'ī',o:'ō',u:'ū',ü:'ǖ'} as Record<string,string>)[t[index]]+t.slice(index+1);
}
const token=/[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüɑɡ]+/g;
/** null means ordinary prose/English, so its legacy audio identity stays intact. */
export function pinyinSpeech(text:string):string|null {
  let changed=false;
  let s=text.normalize('NFC');
  for(const [phrase,reading] of Object.entries(rules.phrases))
    s=s.replace(new RegExp(phrase.replaceAll(' ','\\s+'),'g'),()=>{changed=true;return reading;});
  s=s.replace(token,(original:string,offset:number,whole:string)=>{
    if(original!==original.toLowerCase()||/[A-Za-z0-9]/.test(whole[offset-1]??'')||/[A-Za-z0-9]/.test(whole[offset+original.length]??''))return original;
    const t=original.replaceAll('ɑ','a').replaceAll('ɡ','g');
    if(readings[t]){changed=true;return readings[t];}
    if(spelling.has(t)){
      changed=true;
      return '拼写，'+[...t].map(c=>readings[c]??c).join('，');
    }
    if(/^([aeo])\1+$/.test(t)){changed=true;return [...t].map(c=>readings[c]).join('，');}
    const b=base(t);
    if(!syllables.has(b))return original;
    changed=true;
    const syllable=t===b?firstTone(t):t;
    return anchors[syllable]??syllable;
  });
  return changed?s:null;
}
/** Shared identity string with the Python collector, including voice policy. */
export function pinyinIdentity(text:string,spoken:string):string {
  const units:Record<string,{anchor:string;tone:number;vowel_only:boolean}>=rules.renderer_units;
  const rendered=[...spoken.matchAll(token)].filter(m=>units[m[0]]).map(m=>{
    const u=units[m[0]];return [m[0],u.anchor,u.tone,String(u.vowel_only)].join('|');
  });
  return [PINYIN_CONTEXT,PINYIN_VOICE,PINYIN_RATE,text,spoken,...(rendered.length?[rules.renderer_version,...rendered]:[])].join('\n');
}
