// webkitAudioContext는 구형 Safari를 위한 접두사 이름이라 lib.dom.d.ts에 없다.
// window에 없는 프로퍼티이므로 단언 없이는 접근할 수 없다.
const AudioContextCtor =
  window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
const audioCtx: AudioContext | null = typeof window !== 'undefined' ? new AudioContextCtor() : null;

interface ToneParams {
  frequency: number;
  frequencyEnd?: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
}

function playTone({ frequency, frequencyEnd, duration, type = 'sine', gain = 0.2 }: ToneParams) {
  if (!audioCtx) return;
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
  if (frequencyEnd) {
    oscillator.frequency.exponentialRampToValueAtTime(frequencyEnd, audioCtx.currentTime + duration);
  }
  gainNode.gain.setValueAtTime(gain, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  oscillator.connect(gainNode).connect(audioCtx.destination);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + duration);
}

export const sfx = {
  shoot() {
    playTone({ frequency: 900, frequencyEnd: 200, duration: 0.12, type: 'square', gain: 0.15 });
  },
  hit() {
    playTone({ frequency: 300, frequencyEnd: 500, duration: 0.15, type: 'triangle', gain: 0.2 });
  },
  headshot() {
    playTone({ frequency: 500, frequencyEnd: 1200, duration: 0.2, type: 'triangle', gain: 0.25 });
  },
  combo() {
    playTone({ frequency: 700, frequencyEnd: 1400, duration: 0.25, type: 'sawtooth', gain: 0.2 });
  },
  miss() {
    playTone({ frequency: 200, frequencyEnd: 120, duration: 0.2, type: 'sine', gain: 0.1 });
  },
  roundClear() {
    playTone({ frequency: 600, frequencyEnd: 900, duration: 0.4, type: 'sine', gain: 0.25 });
  },
  explosion() {
    playTone({ frequency: 160, frequencyEnd: 40, duration: 0.5, type: 'sawtooth', gain: 0.3 });
  },
};

export function resumeAudio() {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}
