import { AudioController, KeySoundVariant } from '../types';

export class SoundEngine implements AudioController {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private analyser: AnalyserNode | null = null;
    private ambientGain: GainNode | null = null;
    private noiseBuffer: AudioBuffer | null = null;

    private _enabled = true;
    private _volume = 0.55;
    private initialized = false;

    public get enabled(): boolean {
        return this._enabled;
    }

    public get volume(): number {
        return this._volume;
    }

    public init(): void {
        if (this.initialized) {
            if (this.ctx && this.ctx.state === 'suspended') {
                void this.ctx.resume();
            }
            return;
        }

        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) {
            return;
        }

        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this._enabled ? this._volume : 0;

        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0.82;

        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);

        this.noiseBuffer = this.createWhiteNoiseBuffer(1.5);
        this.startAmbientCRTHum();
        this.initialized = true;
    }

    private ensureContext(): AudioContext | null {
        if (!this.initialized) {
            this.init();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            void this.ctx.resume();
        }
        return this.ctx;
    }

    private createWhiteNoiseBuffer(durationSeconds: number): AudioBuffer | null {
        if (!this.ctx) return null;
        const sampleRate = this.ctx.sampleRate;
        const frameCount = Math.floor(sampleRate * durationSeconds);
        const buffer = this.ctx.createBuffer(1, frameCount, sampleRate);
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    private startAmbientCRTHum(): void {
        if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;

        this.ambientGain = this.ctx.createGain();
        this.ambientGain.gain.value = 0.032;
        this.ambientGain.connect(this.masterGain);

        // 60Hz Cathode Mains Hum Oscillator
        const mainsOsc = this.ctx.createOscillator();
        mainsOsc.type = 'sine';
        mainsOsc.frequency.value = 60;

        const mainsGain = this.ctx.createGain();
        mainsGain.gain.value = 0.35;
        mainsOsc.connect(mainsGain);
        mainsGain.connect(this.ambientGain);
        mainsOsc.start();

        // 120Hz Harmonic
        const harmonicOsc = this.ctx.createOscillator();
        harmonicOsc.type = 'triangle';
        harmonicOsc.frequency.value = 120;

        const harmonicGain = this.ctx.createGain();
        harmonicGain.gain.value = 0.12;
        harmonicOsc.connect(harmonicGain);
        harmonicGain.connect(this.ambientGain);
        harmonicOsc.start();

        // Filtered Fan / Tube Warmth Noise
        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = this.noiseBuffer;
        noiseSource.loop = true;

        const lowpass = this.ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 260;

        const fanGain = this.ctx.createGain();
        fanGain.gain.value = 0.28;

        noiseSource.connect(lowpass);
        lowpass.connect(fanGain);
        fanGain.connect(this.ambientGain);
        noiseSource.start();
    }

    public setEnabled(enabled: boolean): boolean {
        this._enabled = enabled;
        const ctx = this.ensureContext();
        if (ctx && this.masterGain) {
            const now = ctx.currentTime;
            this.masterGain.gain.setTargetAtTime(this._enabled ? this._volume : 0, now, 0.02);
        }
        return this._enabled;
    }

    public setVolume(level: number): void {
        this._volume = Math.max(0, Math.min(1, level));
        const ctx = this.ensureContext();
        if (ctx && this.masterGain && this._enabled) {
            this.masterGain.gain.setTargetAtTime(this._volume, ctx.currentTime, 0.02);
        }
    }

    public playKeystroke(variant: KeySoundVariant = 'standard'): void {
        if (!this._enabled) return;
        const ctx = this.ensureContext();
        if (!ctx || !this.masterGain || !this.noiseBuffer) return;

        const now = ctx.currentTime;
        const pitchJitter = 0.94 + Math.random() * 0.12;

        // 1. Tactile Switch Click (Bandpass Noise Burst)
        const clickSource = ctx.createBufferSource();
        clickSource.buffer = this.noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 3.2;

        let baseFreq = 1950;
        let bodyStartFreq = 260;
        let bodyGainLevel = 0.16;

        if (variant === 'space') {
            baseFreq = 1250;
            bodyStartFreq = 175;
            bodyGainLevel = 0.24;
        } else if (variant === 'enter') {
            baseFreq = 1400;
            bodyStartFreq = 210;
            bodyGainLevel = 0.28;
        } else if (variant === 'backspace') {
            baseFreq = 1650;
            bodyStartFreq = 220;
            bodyGainLevel = 0.19;
        }

        filter.frequency.setValueAtTime(baseFreq * pitchJitter, now);

        const clickGain = ctx.createGain();
        clickGain.gain.setValueAtTime(0.22, now);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);

        clickSource.connect(filter);
        filter.connect(clickGain);
        clickGain.connect(this.masterGain);

        clickSource.start(now, Math.random() * 0.5, 0.022);

        // 2. Keycap Bottom-Out Thock (Pitch-Dropping Triangle Oscillator)
        const bodyOsc = ctx.createOscillator();
        bodyOsc.type = 'triangle';
        bodyOsc.frequency.setValueAtTime(bodyStartFreq * pitchJitter, now);
        bodyOsc.frequency.exponentialRampToValueAtTime(52, now + 0.042);

        const bodyGain = ctx.createGain();
        bodyGain.gain.setValueAtTime(bodyGainLevel, now);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

        bodyOsc.connect(bodyGain);
        bodyGain.connect(this.masterGain);

        bodyOsc.start(now);
        bodyOsc.stop(now + 0.048);
    }

    public playTypewriterTick(): void {
        if (!this._enabled) return;
        const ctx = this.ensureContext();
        if (!ctx || !this.masterGain) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2400 + Math.random() * 350, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.012);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.055, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.014);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.015);
    }

    public playBootChord(): void {
        if (!this._enabled) return;
        const ctx = this.ensureContext();
        if (!ctx || !this.masterGain) return;

        const now = ctx.currentTime;
        const freqs = [110, 164.81, 220, 329.63, 440, 659.25];

        freqs.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
            osc.frequency.setValueAtTime(freq * 0.5, now + idx * 0.055);
            osc.frequency.exponentialRampToValueAtTime(freq, now + idx * 0.055 + 0.18);

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(400, now + idx * 0.055);
            filter.frequency.exponentialRampToValueAtTime(2800, now + idx * 0.055 + 0.35);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.0001, now + idx * 0.055);
            gain.gain.linearRampToValueAtTime(0.065, now + idx * 0.055 + 0.08);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.055 + 1.15);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain!);

            osc.start(now + idx * 0.055);
            osc.stop(now + idx * 0.055 + 1.2);
        });
    }

    public playDegaussPulse(): void {
        if (!this._enabled) return;
        const ctx = this.ensureContext();
        if (!ctx || !this.masterGain) return;

        const now = ctx.currentTime;

        // Heavy magnetic coil discharge thump
        const thumpOsc = ctx.createOscillator();
        thumpOsc.type = 'sawtooth';
        thumpOsc.frequency.setValueAtTime(145, now);
        thumpOsc.frequency.exponentialRampToValueAtTime(38, now + 0.55);

        const thumpFilter = ctx.createBiquadFilter();
        thumpFilter.type = 'lowpass';
        thumpFilter.frequency.setValueAtTime(420, now);
        thumpFilter.frequency.exponentialRampToValueAtTime(90, now + 0.8);

        const thumpGain = ctx.createGain();
        thumpGain.gain.setValueAtTime(0.45, now);
        thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

        thumpOsc.connect(thumpFilter);
        thumpFilter.connect(thumpGain);
        thumpGain.connect(this.masterGain);

        thumpOsc.start(now);
        thumpOsc.stop(now + 0.88);

        // Metallic aperture grille ring oscillation
        const ringOsc = ctx.createOscillator();
        ringOsc.type = 'sine';
        ringOsc.frequency.setValueAtTime(520, now);
        ringOsc.frequency.exponentialRampToValueAtTime(110, now + 0.9);

        const ringGain = ctx.createGain();
        ringGain.gain.setValueAtTime(0.18, now);
        ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

        ringOsc.connect(ringGain);
        ringGain.connect(this.masterGain);

        ringOsc.start(now);
        ringOsc.stop(now + 0.92);
    }

    public playBeep(freq = 880, durationMs = 95): void {
        if (!this._enabled) return;
        const ctx = this.ensureContext();
        if (!ctx || !this.masterGain) return;

        const now = ctx.currentTime;
        const durationSec = durationMs / 1000;

        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.11, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + durationSec + 0.01);
    }

    public playError(): void {
        if (!this._enabled) return;
        const ctx = this.ensureContext();
        if (!ctx || !this.masterGain) return;

        const now = ctx.currentTime;
        [165, 130].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, now + i * 0.11);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.16, now + i * 0.11);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + 0.12);

            osc.connect(gain);
            gain.connect(this.masterGain!);

            osc.start(now + i * 0.11);
            osc.stop(now + i * 0.11 + 0.13);
        });
    }

    public playSuccess(): void {
        if (!this._enabled) return;
        const ctx = this.ensureContext();
        if (!ctx || !this.masterGain) return;

        const now = ctx.currentTime;
        [523.25, 659.25, 783.99].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + i * 0.06);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.12, now + i * 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.12);

            osc.connect(gain);
            gain.connect(this.masterGain!);

            osc.start(now + i * 0.06);
            osc.stop(now + i * 0.06 + 0.13);
        });
    }

    public playGlitchBurst(durationMs = 260): void {
        if (!this._enabled) return;
        const ctx = this.ensureContext();
        if (!ctx || !this.masterGain || !this.noiseBuffer) return;

        const now = ctx.currentTime;
        const dur = durationMs / 1000;

        const noise = ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(900, now);
        filter.frequency.linearRampToValueAtTime(3400, now + dur * 0.5);
        filter.frequency.linearRampToValueAtTime(420, now + dur);
        filter.Q.value = 6;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.26, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(now, Math.random() * 0.4, dur);
    }

    public playPowerToggle(turningOn: boolean): void {
        if (!this._enabled) return;
        const ctx = this.ensureContext();
        if (!ctx || !this.masterGain) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        osc.type = 'sine';

        if (turningOn) {
            osc.frequency.setValueAtTime(80, now);
            osc.frequency.exponentialRampToValueAtTime(9800, now + 0.45);
        } else {
            osc.frequency.setValueAtTime(7200, now);
            osc.frequency.exponentialRampToValueAtTime(45, now + 0.35);
        }

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.46);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.48);
    }

    public getWaveformData(targetBuffer: Uint8Array): void {
        if (this.analyser && this._enabled) {
            this.analyser.getByteTimeDomainData(targetBuffer);
        } else {
            targetBuffer.fill(128);
        }
    }
}
