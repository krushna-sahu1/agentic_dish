/**
 * Browser audio for Jarvis: mic capture → 16 kHz linear16 frames, and gapless
 * playback of Deepgram's raw 24 kHz linear16 reply audio. Both sides expose an
 * AnalyserNode-backed level (0..1) that drives the orb.
 */

const WORKLET = `
class JarvisMic extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.t = 0; this.sum = 0; this.count = 0;
    this.frame = new Int16Array(320); // 20 ms @ 16 kHz
    this.i = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let k = 0; k < ch.length; k++) {
      this.sum += ch[k]; this.count++; this.t += 1;
      if (this.t >= this.ratio) {
        this.t -= this.ratio;
        const s = Math.max(-1, Math.min(1, this.sum / this.count));
        this.sum = 0; this.count = 0;
        this.frame[this.i++] = s < 0 ? s * 0x8000 : s * 0x7fff;
        if (this.i === this.frame.length) {
          this.port.postMessage(this.frame.buffer, [this.frame.buffer]);
          this.frame = new Int16Array(320);
          this.i = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("jarvis-mic", JarvisMic);
`;

function rms(analyser: AnalyserNode, buf: Float32Array<ArrayBuffer>): number {
  analyser.getFloatTimeDomainData(buf);
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.min(1, Math.sqrt(s / buf.length) * 5);
}

export class MicCapture {
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private sink: GainNode | null = null;
  private analyser: AnalyserNode;
  private buf = new Float32Array(512);
  muted = false;

  constructor(
    private ctx: AudioContext,
    private onFrame: (pcm: ArrayBuffer) => void,
  ) {
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
  }

  /** Throws a DOMException named NotAllowedError when permission is denied. */
  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
    try {
      await this.ctx.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, "jarvis-mic");
    this.node.port.onmessage = (e) => !this.muted && this.onFrame(e.data as ArrayBuffer);
    this.source.connect(this.analyser);
    this.source.connect(this.node);
    // Keep the worklet in the rendered graph (some browsers skip unconnected nodes), silently.
    this.sink = this.ctx.createGain();
    this.sink.gain.value = 0;
    this.node.connect(this.sink).connect(this.ctx.destination);
  }

  level() {
    return this.muted || !this.stream ? 0 : rms(this.analyser, this.buf);
  }

  stop() {
    this.node?.port.close();
    this.node?.disconnect();
    this.source?.disconnect();
    this.sink?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.node = null;
    this.source = null;
    this.stream = null;
  }
}

export class PcmPlayer {
  private out: GainNode;
  private analyser: AnalyserNode;
  private buf = new Float32Array(512);
  private nextTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private carry: Uint8Array | null = null;
  /** Called when everything queued has finished playing. */
  onDrained: (() => void) | null = null;

  constructor(
    private ctx: AudioContext,
    private sampleRate = 24000,
  ) {
    this.out = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.out.connect(this.analyser);
    this.analyser.connect(ctx.destination);
  }

  get playing() {
    return this.sources.size > 0;
  }

  /** Queue a chunk of little-endian 16-bit PCM (chunks may split a sample). */
  enqueue(chunk: ArrayBuffer) {
    let bytes = new Uint8Array(chunk);
    if (this.carry) {
      const merged = new Uint8Array(this.carry.length + bytes.length);
      merged.set(this.carry);
      merged.set(bytes, this.carry.length);
      bytes = merged;
      this.carry = null;
    }
    if (bytes.length % 2) {
      this.carry = bytes.slice(-1);
      bytes = bytes.slice(0, -1);
    }
    if (!bytes.length) return;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const samples = new Float32Array(bytes.length / 2);
    for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 0x8000;
    const audio = this.ctx.createBuffer(1, samples.length, this.sampleRate);
    audio.copyToChannel(samples, 0);
    const src = this.ctx.createBufferSource();
    src.buffer = audio;
    src.connect(this.out);
    const start = Math.max(this.ctx.currentTime + 0.02, this.nextTime);
    src.start(start);
    this.nextTime = start + audio.duration;
    this.sources.add(src);
    src.onended = () => {
      this.sources.delete(src);
      if (!this.sources.size) this.onDrained?.();
    };
  }

  /** Barge-in: drop everything queued immediately. */
  flush() {
    for (const s of this.sources) {
      s.onended = null;
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear();
    this.nextTime = 0;
    this.carry = null;
  }

  level() {
    return this.sources.size ? rms(this.analyser, this.buf) : 0;
  }
}
