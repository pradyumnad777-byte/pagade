export type SoundEffect =
  | 'roll'
  | 'step'
  | 'capture'
  | 'home'
  | 'skill'
  | 'victory'
  | 'defeat'
  | 'click'
  | 'safe_block';

/**
 * Synthesizes both Pagade tactile sound effects AND a soothing ambient Indian palace background score
 * (Tanpura Sa-Pa drone in C major / Raga Yaman pentatonic motifs with gentle Bansuri-like sine swells
 * and plucked Swarmandal harp overtones).
 */
class SoundManager {
  private ctx: AudioContext | null = null;
  public enabled = true;
  public bgmEnabled = false;
  public bgmVolume = 0.25;
  private bgmIntervalId: number | null = null;
  private droneGain: GainNode | null = null;
  private droneOscs: OscillatorNode[] = [];
  private melodyStep = 0;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public startSoothingBgm() {
    const ctx = this.getContext();
    if (!ctx) return;
    this.bgmEnabled = true;

    if (this.bgmIntervalId !== null) return;

    // Create warm low-frequency Tanpura drone (C3 = 130.81Hz, G3 = 196.00Hz)
    try {
      const masterDroneGain = ctx.createGain();
      masterDroneGain.gain.setValueAtTime(0.001, ctx.currentTime);
      masterDroneGain.gain.exponentialRampToValueAtTime(
        Math.max(0.01, this.bgmVolume * 0.14),
        ctx.currentTime + 1.5
      );
      masterDroneGain.connect(ctx.destination);
      this.droneGain = masterDroneGain;

      const freqs = [130.81, 196.0, 261.63];
      this.droneOscs = freqs.map((f, idx) => {
        const osc = ctx.createOscillator();
        const subGain = ctx.createGain();
        osc.type = idx === 2 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(f, ctx.currentTime);
        subGain.gain.setValueAtTime(idx === 0 ? 0.45 : 0.25, ctx.currentTime);
        osc.connect(subGain);
        subGain.connect(masterDroneGain);
        osc.start();
        return osc;
      });
    } catch {
      // Ignore if audio context not unlocked yet
    }

    // Serene Raga Yaman / Bhupali inspired soothing notes (Hz)
    const sereneScale = [
      261.63, // Sa (C4)
      293.66, // Re (D4)
      329.63, // Ga (E4)
      392.0,  // Pa (G4)
      440.0,  // Dha (A4)
      523.25, // Sa (C5)
      493.88, // Ni (B4)
      392.0,  // Pa (G4)
      329.63, // Ga (E4)
      293.66, // Re (D4)
    ];

    const playSereneNote = () => {
      if (!this.bgmEnabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      const noteFreq = sereneScale[this.melodyStep % sereneScale.length];
      this.melodyStep++;

      // Soft Bansuri flute-like warm sine swell
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(noteFreq, now);

        const peak = Math.max(0.005, this.bgmVolume * 0.18);
        gain.gain.setValueAtTime(0.0008, now);
        gain.gain.exponentialRampToValueAtTime(peak, now + 0.65);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 2.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 2.4);

        // Occasional gentle Swarmandal harmonic chimefifth above
        if (this.melodyStep % 3 === 0) {
          const chimeOsc = this.ctx.createOscillator();
          const chimeGain = this.ctx.createGain();
          chimeOsc.type = 'triangle';
          chimeOsc.frequency.setValueAtTime(noteFreq * 1.5, now + 0.35);
          chimeGain.gain.setValueAtTime(0.0005, now + 0.35);
          chimeGain.gain.exponentialRampToValueAtTime(peak * 0.45, now + 0.45);
          chimeGain.gain.exponentialRampToValueAtTime(0.0005, now + 1.7);
          chimeOsc.connect(chimeGain);
          chimeGain.connect(this.ctx.destination);
          chimeOsc.start(now + 0.35);
          chimeOsc.stop(now + 1.8);
        }
      } catch {
        // Ignore audio errors
      }
    };

    playSereneNote();
    this.bgmIntervalId = window.setInterval(playSereneNote, 2400);
  }

  public stopSoothingBgm() {
    this.bgmEnabled = false;
    if (this.bgmIntervalId !== null) {
      window.clearInterval(this.bgmIntervalId);
      this.bgmIntervalId = null;
    }
    if (this.droneOscs.length > 0) {
      this.droneOscs.forEach((osc) => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // Ignore
        }
      });
      this.droneOscs = [];
    }
    if (this.droneGain) {
      try {
        this.droneGain.disconnect();
      } catch {
        // Ignore
      }
      this.droneGain = null;
    }
  }

  public setBgmVolume(vol: number) {
    this.bgmVolume = Math.max(0, Math.min(1, vol));
    if (this.droneGain && this.ctx) {
      try {
        this.droneGain.gain.setTargetAtTime(
          Math.max(0.005, this.bgmVolume * 0.14),
          this.ctx.currentTime,
          0.2
        );
      } catch {
        // Ignore
      }
    }
  }

  public play(effect: SoundEffect) {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    switch (effect) {
      case 'click': {
        this.tone(ctx, 520, 'sine', now, 0.05, 0.08);
        break;
      }
      case 'roll': {
        // Ivory long dice clack sequence
        this.tone(ctx, 320, 'triangle', now, 0.04, 0.12);
        this.tone(ctx, 480, 'triangle', now + 0.05, 0.04, 0.14);
        this.tone(ctx, 640, 'sine', now + 0.11, 0.07, 0.16);
        break;
      }
      case 'step': {
        this.tone(ctx, 440, 'sine', now, 0.06, 0.1);
        this.tone(ctx, 587.33, 'sine', now + 0.04, 0.07, 0.1);
        break;
      }
      case 'safe_block': {
        this.tone(ctx, 523.25, 'triangle', now, 0.07, 0.14);
        this.tone(ctx, 783.99, 'sine', now + 0.06, 0.12, 0.16);
        break;
      }
      case 'capture': {
        this.tone(ctx, 587.33, 'sawtooth', now, 0.08, 0.15);
        this.tone(ctx, 440, 'sawtooth', now + 0.08, 0.08, 0.15);
        this.tone(ctx, 880, 'triangle', now + 0.16, 0.18, 0.2);
        break;
      }
      case 'home': {
        this.tone(ctx, 523.25, 'triangle', now, 0.09, 0.16);
        this.tone(ctx, 659.25, 'triangle', now + 0.09, 0.09, 0.16);
        this.tone(ctx, 783.99, 'triangle', now + 0.18, 0.12, 0.18);
        this.tone(ctx, 1046.5, 'sine', now + 0.28, 0.24, 0.22);
        break;
      }
      case 'skill': {
        this.tone(ctx, 392.0, 'sine', now, 0.08, 0.14);
        this.tone(ctx, 587.33, 'sine', now + 0.07, 0.08, 0.16);
        this.tone(ctx, 783.99, 'triangle', now + 0.14, 0.18, 0.18);
        break;
      }
      case 'victory': {
        const notes = [523.25, 659.25, 783.99, 1046.5, 987.77, 1046.5];
        notes.forEach((freq, idx) => {
          this.tone(ctx, freq, 'triangle', now + idx * 0.09, 0.14, 0.2);
        });
        break;
      }
      case 'defeat': {
        const notes = [440, 392, 349.23, 293.66];
        notes.forEach((freq, idx) => {
          this.tone(ctx, freq, 'sawtooth', now + idx * 0.12, 0.16, 0.14);
        });
        break;
      }
    }
  }

  private tone(
    ctx: AudioContext,
    freq: number,
    type: OscillatorType,
    startTime: number,
    duration: number,
    maxGain: number
  ) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(maxGain, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.02);
    } catch {
      // Ignore audio scheduling errors if browser blocks autoplay
    }
  }
}

export const sound = new SoundManager();
