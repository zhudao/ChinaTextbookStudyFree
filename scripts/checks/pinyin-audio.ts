/** Verify every narrated G1 field uses its context-specific, approved audio. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pinyinSpeech} from '../../packages/core/src/pinyinSpeech';
import {mathSpeech} from '../../packages/core/src/mathSpeech';
import {narrationVerifier} from './narration-reference';
const root=process.argv[2]??'apps/web/public';
const verify=narrationVerifier(path.resolve(root));
const used=new Set<string>();let fields=0,phoneticFields=0;
function field(text:unknown,url:unknown,book:string){
 if(typeof text!=='string'||!pinyinSpeech(mathSpeech(text)))return;
 assert(typeof url==='string',`Missing pinyin audio: ${book}: ${text}`);
 verify(text,url,book);used.add(url);phoneticFields++;fields++;
}
function question(q:any,book:string){
 field(q.question,q.audio?.question,book);field(q.explanation,q.audio?.explanation,book);
 (q.options??[]).forEach((t:string,i:number)=>field(t.replace(/^[A-Da-d][.、]\s*/,''),q.audio?.options?.[i],book));
}
for(const book of ['chinese-g1up','chinese-g1down']){
 const dir=path.join(root,'data/books',book);
 for(const name of fs.readdirSync(path.join(dir,'lessons'))){
  const l=JSON.parse(fs.readFileSync(path.join(dir,'lessons',name),'utf8'));l.questions.forEach((q:any)=>question(q,book));
  const k=l.knowledge;if(k){for(const key of ['point','core_concept','key_formula','tips'])field(k[key],k.audio?.[key],book);(k.common_mistakes??[]).forEach((t:string,i:number)=>field(t,k.audio?.common_mistakes?.[i],book));}
 }
 for(const kind of ['passages','stories']){
  const doc=JSON.parse(fs.readFileSync(path.join(dir,kind+'.json'),'utf8'));
  for(const item of doc[kind]){for(const s of item.sentences)field(s.text,s.audio,book);(item.questions??[]).forEach((q:any)=>question(q,book));}
 }
}
const manifest=JSON.parse(fs.readFileSync('release/pinyin-audio-manifest.json','utf8'));
assert.equal(new Set(manifest.items.map((r:any)=>r.url)).size,manifest.items.length);
for(const row of manifest.items)verify(row.source_text,row.url,'chinese-g1up');
console.log(JSON.stringify({status:'passed',phoneticFields,uniquePublishedPronunciations:used.size,generatedPronunciations:manifest.items.length,sourceOnlyPronunciations:manifest.items.length-used.size,allReceiptBytesVerified:true,missing:0}));
