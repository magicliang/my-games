type ToneSpec = {
  readonly frequency: number;
  readonly duration: number;
  readonly type: OscillatorType;
  readonly volume: number;
  readonly endFrequency?: number;
};

export class GameAudio {
  private context: AudioContext | null = null;

  resume(): void {
    if (this.context === null) this.context = new AudioContext();
    void this.context.resume();
  }

  shoot(kind: "rifle" | "laser"): void {
    this.tone({
      frequency: kind === "laser" ? 760 : 180,
      duration: kind === "laser" ? 0.11 : 0.045,
      type: "square",
      volume: 0.035,
    });
  }

  jump(): void {
    this.tone({
      frequency: 130,
      duration: 0.09,
      type: "triangle",
      volume: 0.045,
      endFrequency: 260,
    });
  }

  pickup(): void {
    this.tone({ frequency: 440, duration: 0.08, type: "square", volume: 0.04, endFrequency: 880 });
  }

  explosion(): void {
    const context = this.context;
    if (context === null) return;
    const length = Math.floor(context.sampleRate * 0.18);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      const decay = 1 - index / length;
      data[index] = (Math.random() * 2 - 1) * decay * decay;
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = 0.09;
    source.connect(gain).connect(context.destination);
    source.start();
  }

  private tone(spec: ToneSpec): void {
    const context = this.context;
    if (context === null) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const end = context.currentTime + spec.duration;
    oscillator.type = spec.type;
    oscillator.frequency.setValueAtTime(spec.frequency, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(spec.endFrequency ?? spec.frequency, end);
    gain.gain.setValueAtTime(spec.volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(end);
  }
}
