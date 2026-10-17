import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
function load(getUserMedia: () => Promise<unknown>) {
  let cleanup: (()=>void) | undefined;
  let stopped=0;
  const source=readFileSync(new URL('../../apps/web/src/lib/useRecorder.ts',import.meta.url),'utf8');
  const exports: any = {};
  const react={useCallback:(fn:unknown)=>fn,useRef:(value:unknown)=>({current:value}),useState:(value:unknown)=>[value,()=>{}],useEffect:(fn:()=>()=>void)=>{cleanup=fn();}};
  const stream={getTracks:()=>[{stop:()=>{stopped++;}}]};
  class Recorder {state='inactive';mimeType='audio/webm';onstop?:()=>void;start(){this.state='recording';}stop(){this.state='inactive';this.onstop?.();}}
  runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:()=>react,navigator:{mediaDevices:{getUserMedia}},MediaRecorder:Recorder,Blob,URL:{createObjectURL:()=> 'blob:test'}});
  return {rec:exports.useRecorder(),cleanup:()=>cleanup?.(),stream,stopped:()=>stopped};
}
async function main(){
  const denied=load(async()=>{throw new Error('Denied');});
  assert.equal(await denied.rec.start(),false,'The caller must receive failure directly, without reading stale React state');
  let resolve!: (value:unknown)=>void;
  const pending=load(()=>new Promise(r=>{resolve=r;}));
  const start=pending.rec.start();
  await pending.rec.stop();
  resolve(pending.stream);
  assert.equal(await start,false,'Stop while permission is pending must cancel a late start');
  assert.equal(pending.stopped(),1,'Late streams must release their microphone tracks');
  let requests=0;
  let rejectOld!: (reason:Error)=>void;
  const retry=load(()=>++requests===1 ? new Promise((_,reject)=>{rejectOld=reject;}) : Promise.resolve(retry.stream));
  const oldStart=retry.rec.start();
  await retry.rec.stop();
  assert.equal(await retry.rec.start(),true);
  rejectOld(new Error('Late denial'));
  assert.equal(await oldStart,false);
  assert.equal(retry.stopped(),0,'A cancelled request rejection must not stop the newer active microphone');
  await retry.rec.stop();
  assert.equal(retry.stopped(),1);
  const success=load(async()=>success.stream);
  assert.equal(await success.rec.start(),true);
  success.cleanup();
  assert.equal(success.stopped(),1);
  console.log('Recorder denial and pending-permission cancellation release media tracks.');
}
void main();
