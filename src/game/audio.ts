/**
 * Procedural Web Audio API sound synthesizer for CyberSerpent 3D.
 * 100% procedural with zero external MP3/WAV assets.
 */

class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private isMuted: boolean = false;
  private isMusicEnabled: boolean = true;

  // Background ambient synth loop handles
  private ambientInterval: number | null = null;
  private ambientStep: number = 0;
  private isAmbientRunning: boolean = false;

  private boostOsc: OscillatorNode | null = null;
  private boostNoise: AudioBufferSourceNode | null = null;
  private boostGain: GainNode | null = null;

  constructor() {
    // Initialized lazily on first user interaction to comply with browser autoplay policies
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.7, this.ctx.currentTime, 0.05);
    }
  }

  public toggleMusic(): boolean {
    this.isMusicEnabled = !this.isMusicEnabled;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.isMusicEnabled ? 0.3 : 0, this.ctx.currentTime, 0.05);
    }
    return this.isMusicEnabled;
  }

  public getMusicEnabled(): boolean {
    return this.isMusicEnabled;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Sound effect: Turn / steering micro-click
   */
  public playTurn() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.035);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.035);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.04);
  }

  /**
   * Sound effect: Cyan energy orb collect with harmonic chime based on combo
   */
  public playCollect(comboMultiplier: number = 1) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const baseFreqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const pitchFactor = 1 + (comboMultiplier - 1) * 0.15;

    baseFreqs.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = idx === 0 ? 'sine' : 'triangle';
      const actualFreq = freq * pitchFactor;
      osc.frequency.setValueAtTime(actualFreq, this.ctx!.currentTime + idx * 0.04);
      osc.frequency.exponentialRampToValueAtTime(actualFreq * 1.05, this.ctx!.currentTime + idx * 0.04 + 0.18);

      gain.gain.setValueAtTime(0.001, this.ctx!.currentTime + idx * 0.04);
      gain.gain.linearRampToValueAtTime(0.25 / (idx + 1), this.ctx!.currentTime + idx * 0.04 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx!.currentTime + idx * 0.04 + 0.28);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(this.ctx!.currentTime + idx * 0.04);
      osc.stop(this.ctx!.currentTime + idx * 0.04 + 0.3);
    });
  }

  /**
   * Sound effect: Golden Supernova Orb (sparkling arpeggio + chorus shimmer)
   */
  public playGoldenSupernova() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    // Major 7th arpeggio: C5, E5, G5, B5, D6, G6
    const notes = [523.25, 659.25, 783.99, 987.77, 1174.66, 1567.98];
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = i % 2 === 0 ? 'sine' : 'sawtooth';
      const startTime = this.ctx!.currentTime + i * 0.05;

      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.02, startTime + 0.25);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(startTime);
      osc.stop(startTime + 0.38);
    });
  }

  /**
   * Sound effect: Purple Chrono Crystal (time warp filter sweep)
   */
  public playChrono() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.6);

    filter.type = 'lowpass';
    filter.Q.setValueAtTime(8, this.ctx.currentTime);
    filter.frequency.setValueAtTime(2400, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.6);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.62);
  }

  /**
   * Sound effect: Hazard warning beacon pulse
   */
  public playWarning() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    osc.frequency.setValueAtTime(740, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.16);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.17);
  }

  /**
   * Sound effect: Start/Stop boost whoosh
   */
  public startBoost() {
    if (this.isMuted || this.boostGain) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, this.ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(1200, this.ctx.currentTime + 0.4);
    filter.Q.setValueAtTime(3, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, this.ctx.currentTime + 0.1);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start();
    this.boostNoise = noise;
    this.boostGain = gain;
  }

  public stopBoost() {
    if (this.boostGain && this.ctx) {
      this.boostGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
      setTimeout(() => {
        try {
          this.boostNoise?.stop();
          this.boostNoise?.disconnect();
        } catch {
          // ignore
        }
        this.boostNoise = null;
        this.boostGain = null;
      }, 160);
    }
  }

  /**
   * Sound effect: Dramatic game over synth drop
   */
  public playGameOver() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    // Heavy detuned saw bass drop + crash impact
    [110, 108.5, 55].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime);
      osc.frequency.exponentialRampToValueAtTime(25, this.ctx!.currentTime + 1.2);

      gain.gain.setValueAtTime(0.35 / (idx + 1), this.ctx!.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start();
      osc.stop(this.ctx!.currentTime + 1.25);
    });
  }

  /**
   * Sound effect: Level up / Milestone fanfare
   */
  public playLevelUp() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.sfxGain) return;

    const chords = [
      [440, 554.37, 659.25], // A major
      [493.88, 622.25, 739.99], // B major
      [587.33, 739.99, 880.0], // D major
      [880, 1108.73, 1318.51], // A high
    ];

    chords.forEach((chord, step) => {
      const startTime = this.ctx!.currentTime + step * 0.12;
      chord.forEach((freq) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.12, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

        osc.connect(gain);
        gain.connect(this.sfxGain!);

        osc.start(startTime);
        osc.stop(startTime + 0.38);
      });
    });
  }

  /**
   * Ambient procedural synthwave bass pulse & atmospheric arpeggio
   */
  public startAmbientMusic() {
    if (this.isAmbientRunning) return;
    this.isAmbientRunning = true;
    this.initContext();

    // 110 BPM synthwave 16-step bassline pattern
    // Key of D minor (D2: 73.42Hz, F2: 87.31Hz, G2: 98Hz, C2: 65.41Hz)
    const bassline = [
      73.42, 73.42, 146.83, 73.42,
      73.42, 87.31, 73.42, 146.83,
      65.41, 65.41, 130.81, 65.41,
      98.0, 87.31, 73.42, 110.0
    ];

    const stepDurationMs = 136; // ~110 BPM 16th notes
    this.ambientStep = 0;

    this.ambientInterval = window.setInterval(() => {
      if (!this.isMusicEnabled || this.isMuted || !this.ctx || !this.musicGain) {
        return;
      }

      const freq = bassline[this.ambientStep % bassline.length];
      const now = this.ctx.currentTime;

      // Bass synth note
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.exponentialRampToValueAtTime(120, now + 0.12);
      filter.Q.setValueAtTime(4, now);

      const isAccent = this.ambientStep % 4 === 0;
      gain.gain.setValueAtTime(isAccent ? 0.28 : 0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc.start(now);
      osc.stop(now + 0.14);

      // Gentle atmospheric pad chord on step 0 and 8
      if (this.ambientStep % 8 === 0) {
        const padFreqs = this.ambientStep % 16 === 0 ? [293.66, 349.23, 440.0] : [261.63, 329.63, 392.0];
        padFreqs.forEach((pf) => {
          const padOsc = this.ctx!.createOscillator();
          const padFilter = this.ctx!.createBiquadFilter();
          const padGain = this.ctx!.createGain();

          padOsc.type = 'sine';
          padOsc.frequency.setValueAtTime(pf, now);

          padFilter.type = 'lowpass';
          padFilter.frequency.setValueAtTime(1000, now);

          padGain.gain.setValueAtTime(0.001, now);
          padGain.gain.linearRampToValueAtTime(0.08, now + 0.3);
          padGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);

          padOsc.connect(padFilter);
          padFilter.connect(padGain);
          padGain.connect(this.musicGain!);

          padOsc.start(now);
          padOsc.stop(now + 1.05);
        });
      }

      this.ambientStep++;
    }, stepDurationMs);
  }

  public stopAmbientMusic() {
    if (this.ambientInterval !== null) {
      clearInterval(this.ambientInterval);
      this.ambientInterval = null;
    }
    this.isAmbientRunning = false;
  }
}

export const soundManager = new SoundSynthesizer();
