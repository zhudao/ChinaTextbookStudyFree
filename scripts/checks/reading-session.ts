import assert from 'node:assert/strict';
import { listenToPassage, followPassage, recordingForSession } from '../../apps/web/src/lib/readingSession';
const sentences = [{text:'Hello',audio:'one.mp3'}, {text:'Hi',audio:'two.mp3'}];
async function main() {
  let clock = 0;
  const base = { now:()=>clock, play: async () => 'ended' as const, cancelled: () => false, onSentence: () => {}, wait: async (ms: number) => {clock+=ms;} };
  assert.equal(await listenToPassage(sentences, base), 'completed');
  for (const result of ['error', 'blocked', 'muted', 'missing', 'interrupted'] as const) {
    assert.equal(await listenToPassage(sentences, {...base, play:async () => result}), 'audio-unavailable');
  }
  let starts = 0; let recordings = 0;
  const rec = { ...base, startRecording: async () => {starts++; return true;}, stopRecording:async () => 'blob:recording', onRecording: () => {recordings++;} };
  assert.equal(await followPassage(sentences, rec), 'completed');
  assert.equal(starts,2); assert.equal(recordings,2);
  starts=0; recordings=0;
  assert.equal(await followPassage(sentences, {...rec, startRecording:async () => {starts++; return false;}}), 'recording-unavailable');
  assert.equal(starts,1); assert.equal(recordings,0, 'Permission denial must not produce completion or iterate through every sentence');
  assert.equal(await followPassage(sentences, {...rec, stopRecording:async () => null}), 'recording-unavailable');
  let cancelled=false; let stopped=false;
  assert.equal(await followPassage(sentences, {...rec, cancelled:()=>cancelled, startRecording:async () => {cancelled=true;return true;}, stopRecording:async () => {stopped=true;return null;}}), 'cancelled');
  assert.ok(stopped, 'A recording started after cancellation must immediately stop');
  let generation = 1, stopCount = 0, active = false;
  let finishOldStart!: (value: boolean) => void;
  let started!: () => void;
  const startRequested = new Promise<void>(resolve => { started = resolve; });
  const sharedRecorder = {
    start: () => { started(); return new Promise<boolean>(resolve => { finishOldStart = resolve; }); },
    stop: async () => { stopCount++; active = false; return null; },
  };
  const oldRecording = recordingForSession(sharedRecorder, () => generation === 1);
  const oldRun = followPassage(sentences, {...base, cancelled: () => generation !== 1,
    startRecording: oldRecording.start, stopRecording: oldRecording.stop, onRecording: () => {}});
  await startRequested;
  generation = 2;
  await sharedRecorder.stop(); // The UI cancels the old run before starting a new run.
  active = true;
  finishOldStart(false); // A previous permission request settles after the retry starts.
  assert.equal(await oldRun, 'cancelled');
  assert.equal(active, true, 'The obsolete loop must not stop the newer recording');
  assert.equal(stopCount, 1, 'Only the explicit user cancellation may stop this recorder');
  console.log('Reading completion rejects audio failure, permission denial, empty recording and cancellation.');
}
void main();
