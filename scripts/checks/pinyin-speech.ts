import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pinyinSpeech,pinyinIdentity} from '../../packages/core/src/pinyinSpeech';
import {mathSpeech} from '../../packages/core/src/mathSpeech';
import {gradeAnswer} from '../../packages/core/src/grade';
import {lessonContentKey} from '../../packages/core/src/content';
const source=JSON.parse(fs.readFileSync('output/chinese/quizzes/义务教育教科书·语文一年级上册_unit3.json','utf8'));
const q18=source.unit_test.questions.find((q:any)=>q.id===18);
assert(gradeAnswer(q18,'怕'));assert(!gradeAnswer(q18,'跑'));
const q19=source.unit_test.questions.find((q:any)=>q.id===19);
const pairs:Record<string,string>={'喇叭':'lǎ ba','木马':'mù mǎ','地毯':'dì tǎn','瀑布':'pù bù'};
const answer=q19.options.slice(0,4).map((word:string,i:number)=>`${String.fromCharCode(65+i)}-${q19.options.slice(4).indexOf(pairs[word])+1}`).join(',');
assert.equal(answer,'A-3,B-1,C-4,D-2');assert(gradeAnswer(q19,answer));assert(!gradeAnswer(q19,'A-3,B-4,C-2,D-1'));
const q6=source.exam.questions.find((q:any)=>q.id===6);assert.equal(q6.answer,'nǔ');assert(q6.question.includes('韵母是u'));assert(gradeAnswer(q6,'D'));
const q12=source.exam.questions.find((q:any)=>q.id===12);assert.equal(q12.answer,'mǒ（木）');assert(q12.question.includes('不对应'));assert(gradeAnswer(q12,'C'));
const exported=JSON.parse(fs.readFileSync('apps/web/public/data/books/chinese-g1up/lessons/chinese-g1up-u3-kp2.json','utf8'));
for(const fixed of [q18,q19]){const q=exported.questions.find((q:any)=>q.id===fixed.id);assert(q);assert.equal(q.answer,fixed.answer);assert(gradeAnswer(q,fixed.answer));}
for(const [text,want] of [['b','玻'],['a','阿'],['i','衣'],['an','安'],['eng','ēng'],['iǔ','有'],['jū','居'],['yī fu','衣服'],['lǎ ba','喇叭'],['4x4',null],['Hello',null],['AABB',null],['ABCD',null]] as const)assert.equal(pinyinSpeech(text),want,text);
const texts=new Set(['ā','á','ǎ','à','ü','i\u030c','j-ü→ju','j-ü→jü','英语字母A和拼音a不同','4x4']);
for(const file of fs.readdirSync('apps/web/public/data/books').filter(x=>/^chinese-g1(?:up|down)$/.test(x))){
 for(const name of fs.readdirSync(`apps/web/public/data/books/${file}/lessons`)){
  const lesson=JSON.parse(fs.readFileSync(`apps/web/public/data/books/${file}/lessons/${name}`,'utf8'));
  for(const q of lesson.questions)for(const t of [q.question,q.explanation,...q.options])texts.add(mathSpeech(t));
  const k=lesson.knowledge;if(k)for(const t of [k.point,k.core_concept,k.key_formula,k.tips,...k.common_mistakes])texts.add(mathSpeech(t));
  const copy=JSON.parse(JSON.stringify(lesson));copy.questions.forEach((q:any)=>q.audio={question:'/audio/test.pinyin-changed.mp3'});assert.equal(lessonContentKey(lesson),lessonContentKey(copy),'Audio-only changes must preserve session identity');
 }
}
const input=[...texts];const python=spawnSync('python3',['-c',`import sys,json;sys.path.insert(0,'scripts/tts');from pinyin_speech import pinyin_speech,identity,audio_rel;print(json.dumps([{\"spoken\":pinyin_speech(t),\"rel\":audio_rel(t,pinyin_speech(t)) if pinyin_speech(t) is not None else None} for t in json.load(sys.stdin)],ensure_ascii=False))`],{input:JSON.stringify(input),encoding:'utf8'});
assert.equal(python.status,0,python.stderr);const outputs=JSON.parse(python.stdout);
input.forEach((t,i)=>{const spoken=pinyinSpeech(t);assert.equal(spoken,outputs[i].spoken,t);if(spoken!=null){const hash=createHash('sha1').update(t).digest('hex');const version=createHash('sha256').update(pinyinIdentity(t,spoken)).digest('hex').slice(0,16);assert.equal(`${hash.slice(0,2)}/${hash}.pinyin-${version}.opus`,outputs[i].rel);}});
console.log(`PASS: ${input.length} actual G1 text plans agree across Python/TS; context cache keys, 4 exact semantic repairs and audio-only session identity.`);
