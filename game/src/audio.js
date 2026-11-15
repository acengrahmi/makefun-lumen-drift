// All sound is synthesized live with WebAudio — no audio files, no network.
// Every effect is a short oscillator/envelope phrase; the ambient pad is two
// detuned sines breathing slowly under the game. Audio only starts after a
// real user gesture, so headless screenshot runs stay silent and safe.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.padNodes = null;
    this.muted = false;
  }

  // Call from the first key or pointer gesture. Safe to call repeatedly.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startPad();
    } catch (err) {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  startPad() {
    if (!this.ctx) return;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.045;
    gain.connect(this.master);
    const oscA = this.ctx.createOscillator();
    oscA.type = 'sine';
    oscA.frequency.value = 110;
    const oscB = this.ctx.createOscillator();
    oscB.type = 'sine';
    oscB.frequency.value = 164.8;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    oscA.connect(gain);
    oscB.connect(gain);
    oscA.start();
    oscB.start();
    lfo.start();
    this.padNodes = { gain, oscA, oscB, lfo };
  }

  // One short tone: frequency slide, envelope, then stop.
  blip({ type = 'sine', from = 440, to = null, dur = 0.12, vol = 0.25, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, t0);
      if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (err) {
      // Audio is decoration; never let it break the game.
    }
  }

  shoot() {
    this.blip({ type: 'square', from: 880, to: 520, dur: 0.07, vol: 0.08 });
  }

  hit() {
    this.blip({ type: 'triangle', from: 220, to: 140, dur: 0.08, vol: 0.16 });
  }

  enemyDie() {
    this.blip({ type: 'sawtooth', from: 320, to: 60, dur: 0.18, vol: 0.14 });
    this.blip({ type: 'sine', from: 660, to: 990, dur: 0.1, vol: 0.1, delay: 0.02 });
  }

  pickup() {
    this.blip({ type: 'sine', from: 740, to: 1180, dur: 0.12, vol: 0.14 });
  }

  heart() {
    this.blip({ type: 'sine', from: 520, to: 780, dur: 0.14, vol: 0.16 });
    this.blip({ type: 'sine', from: 780, to: 1040, dur: 0.16, vol: 0.14, delay: 0.09 });
  }

  hurt() {
    this.blip({ type: 'sawtooth', from: 180, to: 55, dur: 0.3, vol: 0.22 });
  }

  waveHorn() {
    this.blip({ type: 'sawtooth', from: 196, to: 392, dur: 0.5, vol: 0.12 });
    this.blip({ type: 'sawtooth', from: 294, to: 587, dur: 0.5, vol: 0.1, delay: 0.08 });
  }

  bossRoar() {
    this.blip({ type: 'sawtooth', from: 90, to: 45, dur: 0.8, vol: 0.22 });
    this.blip({ type: 'square', from: 55, to: 38, dur: 0.7, vol: 0.14, delay: 0.1 });
  }

  nova() {
    this.blip({ type: 'sine', from: 1200, to: 90, dur: 0.55, vol: 0.22 });
    this.blip({ type: 'triangle', from: 300, to: 1200, dur: 0.3, vol: 0.12 });
  }

  upgradePick() {
    [523, 659, 784].forEach((f, i) => this.blip({ type: 'sine', from: f, dur: 0.16, vol: 0.15, delay: i * 0.07 }));
  }

  gameOver() {
    [392, 330, 262, 196].forEach((f, i) => this.blip({ type: 'triangle', from: f, dur: 0.34, vol: 0.16, delay: i * 0.22 }));
  }

  victory() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.blip({ type: 'sine', from: f, dur: 0.3, vol: 0.16, delay: i * 0.11 }));
  }

  uiClick() {
    this.blip({ type: 'sine', from: 600, to: 900, dur: 0.06, vol: 0.12 });
  }
}
