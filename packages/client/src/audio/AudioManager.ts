import { SOUND_DEFS, ZONE_MUSIC, ZONE_AMBIENT } from "./SoundDefs.js";

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain!: GainNode;
  private sfxGain!: GainNode;
  private musicGain!: GainNode;
  private ambientGain!: GainNode;

  private buffers = new Map<string, AudioBuffer>();
  private currentMusic: AudioBufferSourceNode | null = null;
  private currentMusicName: string | null = null;
  private currentAmbient: AudioBufferSourceNode | null = null;
  private currentAmbientName: string | null = null;
  private initialized = false;
  private loaded = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.masterGain);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.4;
    this.musicGain.connect(this.masterGain);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.3;
    this.ambientGain.connect(this.masterGain);

    await this.loadSounds();
  }

  private async loadSounds(): Promise<void> {
    if (!this.ctx) return;

    const entries = Object.entries(SOUND_DEFS);
    const results = await Promise.allSettled(
      entries.map(async ([name, path]) => {
        try {
          const res = await fetch(path);
          if (!res.ok) return;
          const arrayBuf = await res.arrayBuffer();
          const audioBuf = await this.ctx!.decodeAudioData(arrayBuf);
          this.buffers.set(name, audioBuf);
        } catch {
          // Sound file not found — skip silently
        }
      }),
    );
    this.loaded = true;
  }

  /** Ensure AudioContext is resumed (must be called from user gesture) */
  resume(): void {
    if (this.ctx?.state === "suspended") {
      this.ctx.resume();
    }
  }

  playSfx(name: string, opts?: { volume?: number; pan?: number }): void {
    if (!this.ctx || !this.loaded) return;
    const buffer = this.buffers.get(name);
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    let node: AudioNode = this.sfxGain;

    // Optional volume override
    if (opts?.volume !== undefined) {
      const gain = this.ctx.createGain();
      gain.gain.value = opts.volume;
      gain.connect(this.sfxGain);
      node = gain;
    }

    // Optional stereo panning
    if (opts?.pan !== undefined) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, opts.pan));
      panner.connect(node);
      node = panner;
    }

    source.connect(node);
    source.start();
  }

  playMusic(name: string): void {
    if (!this.ctx || !this.loaded) return;
    if (this.currentMusicName === name) return;

    const buffer = this.buffers.get(name);
    if (!buffer) return;

    // Crossfade: fade out current
    if (this.currentMusic) {
      const old = this.currentMusic;
      const oldGain = this.ctx.createGain();
      oldGain.gain.value = this.musicGain.gain.value;
      oldGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 2);
      old.disconnect();
      old.connect(oldGain);
      oldGain.connect(this.masterGain);
      setTimeout(() => {
        try { old.stop(); } catch { /* already stopped */ }
      }, 2100);
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.musicGain);
    source.start();

    this.currentMusic = source;
    this.currentMusicName = name;
  }

  playAmbient(name: string): void {
    if (!this.ctx || !this.loaded) return;
    if (this.currentAmbientName === name) return;

    this.stopAmbient();

    const buffer = this.buffers.get(name);
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.ambientGain);
    source.start();

    this.currentAmbient = source;
    this.currentAmbientName = name;
  }

  stopAmbient(): void {
    if (this.currentAmbient) {
      try { this.currentAmbient.stop(); } catch { /* already stopped */ }
      this.currentAmbient = null;
      this.currentAmbientName = null;
    }
  }

  /** Switch music + ambient based on zone name/id */
  setZone(zoneId: string, zoneName: string): void {
    const musicKey = this.getZoneMusic(zoneId, zoneName);
    const ambientKey = this.getZoneAmbient(zoneId, zoneName);
    if (musicKey) this.playMusic(musicKey);
    if (ambientKey) this.playAmbient(ambientKey);
  }

  private getZoneMusic(zoneId: string, zoneName: string): string | null {
    if (zoneId.startsWith("dungeon:")) return "music_dungeon";
    for (const [pattern, music] of Object.entries(ZONE_MUSIC)) {
      if (zoneName.toLowerCase().includes(pattern) || zoneId.includes(pattern)) {
        return music;
      }
    }
    return "music_overworld";
  }

  private getZoneAmbient(zoneId: string, zoneName: string): string | null {
    if (zoneId.startsWith("dungeon:")) return "ambient_dungeon";
    for (const [pattern, ambient] of Object.entries(ZONE_AMBIENT)) {
      if (zoneName.toLowerCase().includes(pattern) || zoneId.includes(pattern)) {
        return ambient;
      }
    }
    return "ambient_village";
  }

  setVolume(channel: "master" | "sfx" | "music" | "ambient", value: number): void {
    const v = Math.max(0, Math.min(1, value));
    switch (channel) {
      case "master": this.masterGain.gain.value = v; break;
      case "sfx": this.sfxGain.gain.value = v; break;
      case "music": this.musicGain.gain.value = v; break;
      case "ambient": this.ambientGain.gain.value = v; break;
    }
  }

  getVolume(channel: "master" | "sfx" | "music" | "ambient"): number {
    switch (channel) {
      case "master": return this.masterGain?.gain.value ?? 1;
      case "sfx": return this.sfxGain?.gain.value ?? 1;
      case "music": return this.musicGain?.gain.value ?? 0.4;
      case "ambient": return this.ambientGain?.gain.value ?? 0.3;
    }
  }
}
