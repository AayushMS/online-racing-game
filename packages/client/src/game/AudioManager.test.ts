// packages/client/src/game/AudioManager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AudioContext
const mockOsc = {
  type: 'sine' as OscillatorType,
  frequency: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() },
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
};
const mockGain = {
  gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() },
  connect: vi.fn(),
  disconnect: vi.fn(),
};
const mockBuffer = { getChannelData: () => new Float32Array(100) };
const mockSource = { buffer: null as any, connect: vi.fn(), start: vi.fn() };
const mockCtx = {
  state: 'running',
  currentTime: 0,
  sampleRate: 44100,
  createOscillator: vi.fn(() => ({ ...mockOsc })),
  createGain: vi.fn(() => ({ ...mockGain })),
  createBuffer: vi.fn(() => mockBuffer),
  createBufferSource: vi.fn(() => ({ ...mockSource })),
  destination: {},
  resume: vi.fn(),
  close: vi.fn(),
};

vi.stubGlobal('AudioContext', vi.fn(() => mockCtx));

import { AudioManager } from './AudioManager';

describe('AudioManager', () => {
  let audio: AudioManager;

  beforeEach(() => {
    vi.clearAllMocks();
    audio = new AudioManager();
  });

  it('startEngine creates oscillator and gain', () => {
    audio.startEngine();
    expect(mockCtx.createOscillator).toHaveBeenCalledOnce();
    expect(mockCtx.createGain).toHaveBeenCalledOnce();
  });

  it('setEngineRpm updates oscillator frequency', () => {
    audio.startEngine();
    const oscInstance = mockCtx.createOscillator.mock.results[0].value;
    audio.setEngineRpm(0.5);
    expect(oscInstance.frequency.setTargetAtTime).toHaveBeenCalled();
  });

  it('playCountdownBeep creates a short oscillator', () => {
    audio.playCountdownBeep(false);
    expect(mockCtx.createOscillator).toHaveBeenCalled();
  });

  it('playCountdownBeep(true) uses higher frequency (880)', () => {
    audio.playCountdownBeep(true);
    const osc = mockCtx.createOscillator.mock.results[0].value;
    expect(osc.frequency.value).toBe(880);
  });

  it('playHit uses noise buffer', () => {
    audio.playHit();
    expect(mockCtx.createBuffer).toHaveBeenCalled();
    expect(mockCtx.createBufferSource).toHaveBeenCalled();
  });

  it('dispose closes audio context', () => {
    audio.startEngine();
    audio.dispose();
    expect(mockCtx.close).toHaveBeenCalled();
  });
});
