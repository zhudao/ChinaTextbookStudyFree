import type { TTSPlaybackResult } from './tts';

type Sentence = { text: string; audio?: string | null };
export type ReadingResult = 'completed' | 'cancelled' | 'audio-unavailable' | 'recording-unavailable';
interface Playback {
  play: (src: string | null | undefined) => Promise<TTSPlaybackResult>;
  cancelled: () => boolean;
  onSentence: (index: number) => void;
  wait: (ms: number) => Promise<void>;
  now?: () => number;
}

/** Completion means every sentence actually ended, not merely that playback resolved. */
export async function listenToPassage(sentences: readonly Sentence[], io: Playback): Promise<ReadingResult> {
  if (!sentences.length) return 'audio-unavailable';
  for (let index = 0; index < sentences.length; index++) {
    if (io.cancelled()) return 'cancelled';
    io.onSentence(index);
    const result = await io.play(sentences[index].audio);
    if (io.cancelled()) return 'cancelled';
    if (result !== 'ended') return 'audio-unavailable';
    await io.wait(200);
  }
  return io.cancelled() ? 'cancelled' : 'completed';
}

export async function followPassage(sentences: readonly Sentence[], io: Playback & {
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<string | null>;
  onRecording: (index: number, url: string) => void;
}): Promise<ReadingResult> {
  if (!sentences.length) return 'audio-unavailable';
  for (let index = 0; index < sentences.length; index++) {
    if (io.cancelled()) return 'cancelled';
    io.onSentence(index);
    const result = await io.play(sentences[index].audio);
    if (io.cancelled()) return 'cancelled';
    if (result !== 'ended') return 'audio-unavailable';
    await io.wait(250);
    if (io.cancelled()) return 'cancelled';
    const started = await io.startRecording();
    if (!started || io.cancelled()) {
      await io.stopRecording();
      return io.cancelled() ? 'cancelled' : 'recording-unavailable';
    }
    const duration = Math.min(8000, Math.max(3000, sentences[index].text.length * 280));
    const now = io.now ?? Date.now;
    const startedAt = now();
    while (now() - startedAt < duration && !io.cancelled()) await io.wait(100);
    const url = await io.stopRecording();
    if (io.cancelled()) return 'cancelled';
    if (!url) return 'recording-unavailable';
    io.onRecording(index, url);
    await io.wait(150);
  }
  return io.cancelled() ? 'cancelled' : 'completed';
}

/** Bind recorder callbacks to the playback run that owns them. */
export function recordingForSession(recorder: { start: () => Promise<boolean>; stop: () => Promise<string | null> }, isCurrent: () => boolean) {
  return {
    start: () => isCurrent() ? recorder.start() : Promise.resolve(false),
    stop: () => isCurrent() ? recorder.stop() : Promise.resolve(null),
  };
}
