import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * 効果音と BGM（Web だけ）。
 *
 * 効果音は ElevenLabs で生成した録音（public/sfx/<名前>.wav）、BGM は Suno で作った曲
 * （public/bgm/main.mp3）。ネイティブ版はまだ音を持たず、触覚だけ返す。
 * 入切は「効果音」「BGM」を別々に localStorage に残す。?mute を付けて開くと両方鳴らさない（確認用）。
 */

export type SfxName = 'move' | 'blocked' | 'clear' | 'select';

const enabled = Platform.OS === 'web' && typeof window !== 'undefined';
const base = (Constants.expoConfig?.experiments?.baseUrl ?? '').replace(/\/$/, '');
const forceMute = enabled && new URLSearchParams(window.location.search).has('mute');

const SFX_KEY = 'snake-puzzle:sfx';
const BGM_KEY = 'snake-puzzle:bgm';

function readFlag(key: string): boolean {
  if (!enabled || forceMute) return false;
  try {
    return window.localStorage.getItem(key) !== '0';
  } catch {
    return true;
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // 保存できなくても、その場の入切は効いている
  }
}

let sfxOn = readFlag(SFX_KEY);
let bgmOn = readFlag(BGM_KEY);
const listeners = new Set<() => void>();

export const isSfxOn = () => sfxOn;
export const isBgmOn = () => bgmOn;

/** 入切の変化を知りたい画面が登録する。戻り値で解除。 */
export function subscribeSound(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function setSfxOn(value: boolean): void {
  sfxOn = value;
  writeFlag(SFX_KEY, value);
  if (value) playSfx('select');
  listeners.forEach((fn) => fn());
}

export function setBgmOn(value: boolean): void {
  bgmOn = value;
  writeFlag(BGM_KEY, value);
  if (value) startBgm();
  else bgmEl?.pause();
  listeners.forEach((fn) => fn());
}

// ---- 効果音 ----

/** 録音はピーク 0.9 にそろえてあるので、役割に合わせて下げる。 */
const GAIN: Record<SfxName, number> = { move: 0.5, blocked: 0.35, clear: 0.7, select: 0.3 };

let ctx: AudioContext | null = null;
let bgmBus: GainNode | null = null;
const buffers = new Map<SfxName, AudioBuffer>();

function audio(): AudioContext | null {
  if (!enabled) return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    bgmBus = ctx.createGain();
    bgmBus.gain.value = BGM_GAIN;
    bgmBus.connect(ctx.destination);
    for (const name of Object.keys(GAIN) as SfxName[]) {
      fetch(`${base}/sfx/${name}.wav`)
        .then((r) => r.arrayBuffer())
        .then((d) => ctx!.decodeAudioData(d))
        .then((buf) => buffers.set(name, buf))
        .catch(() => {
          // 読めなければ鳴らさない
        });
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** 鳴らすたびに音程 ±5%・音量 ±10% ずらし、続けて鳴っても機械的に聞こえないようにする。 */
export function playSfx(name: SfxName): void {
  if (!sfxOn) return;
  const ac = audio();
  const buf = buffers.get(name);
  if (!ac || !buf) return;
  const jitter = name !== 'clear';
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = jitter ? 1 + (Math.random() * 2 - 1) * 0.05 : 1;
  const g = ac.createGain();
  g.gain.value = GAIN[name] * (jitter ? 1 + (Math.random() * 2 - 1) * 0.1 : 1);
  src.connect(g).connect(ac.destination);
  src.start();
}

// ---- BGM ----

/** BGM の音量。効果音の下で、考えるのを邪魔しない小ささ（約 −20dB）。 */
const BGM_GAIN = 0.1;
let bgmEl: HTMLAudioElement | null = null;
let bgmNode: MediaElementAudioSourceNode | null = null;
let retryArmed = false;

function bgmElement(): HTMLAudioElement | null {
  if (!enabled || typeof Audio === 'undefined') return null;
  if (!bgmEl) {
    bgmEl = new Audio(`${base}/bgm/main.mp3`);
    bgmEl.preload = 'auto';
    bgmEl.loop = true;
  }
  return bgmEl;
}

function startBgm(): void {
  if (!bgmOn) return;
  const el = bgmElement();
  const ac = audio();
  if (!el || !ac || !bgmBus) return;
  if (!bgmNode) {
    bgmNode = ac.createMediaElementSource(el);
    bgmNode.connect(bgmBus);
  }
  bgmBus.gain.cancelScheduledValues(ac.currentTime);
  bgmBus.gain.setValueAtTime(0.0001, ac.currentTime);
  bgmBus.gain.exponentialRampToValueAtTime(BGM_GAIN, ac.currentTime + 1.2);
  if (el.paused) void el.play().catch(() => armRetry());
}

/** 自動再生は止められるので、最初の操作のあとに始める。 */
function armRetry(): void {
  if (!enabled || retryArmed) return;
  retryArmed = true;
  const events = ['pointerdown', 'keydown'];
  const go = () => {
    for (const ev of events) window.removeEventListener(ev, go, true);
    retryArmed = false;
    window.setTimeout(startBgm, 0);
  };
  for (const ev of events) window.addEventListener(ev, go, true);
}

if (enabled) {
  if (bgmOn) {
    bgmElement();
    armRetry();
  }
  // 別のタブやアプリに移ったら止め、戻ったら続きから流す。
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) bgmEl?.pause();
    else if (bgmOn && bgmNode) void bgmEl?.play().catch(() => armRetry());
  });
}
