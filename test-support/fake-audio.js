class FakeAudioParam {
  constructor(value = 0) {
    this.value = value;
    this.events = [];
  }

  cancelScheduledValues(time) {
    this.events.push(["cancel", time]);
    return this;
  }

  setValueAtTime(value, time) {
    this.value = value;
    this.events.push(["set", value, time]);
    return this;
  }

  linearRampToValueAtTime(value, time) {
    this.value = value;
    this.events.push(["linear", value, time]);
    return this;
  }

  exponentialRampToValueAtTime(value, time) {
    this.value = value;
    this.events.push(["exponential", value, time]);
    return this;
  }
}

class FakeAudioNode {
  constructor(context) {
    this.context = context;
    this.connections = [];
  }

  connect(target) {
    this.connections.push(target);
    return target;
  }
}

class FakeGainNode extends FakeAudioNode {
  constructor(context) {
    super(context);
    this.gain = new FakeAudioParam(1);
  }
}

class FakeFilterNode extends FakeAudioNode {
  constructor(context) {
    super(context);
    this.type = "lowpass";
    this.frequency = new FakeAudioParam(0);
    this.Q = new FakeAudioParam(0);
    this.gain = new FakeAudioParam(0);
  }
}

class FakeCompressorNode extends FakeAudioNode {
  constructor(context) {
    super(context);
    this.threshold = new FakeAudioParam(0);
    this.knee = new FakeAudioParam(0);
    this.ratio = new FakeAudioParam(0);
    this.attack = new FakeAudioParam(0);
    this.release = new FakeAudioParam(0);
  }
}

class FakeScheduledSource extends FakeAudioNode {
  constructor(context, kind) {
    super(context);
    this.kind = kind;
    this.buffer = null;
    this.loop = false;
    this.loopStart = 0;
    this.loopEnd = 0;
    this.onended = null;
    this.started = [];
    this.stopped = [];
  }

  start(...arguments_) {
    this.started.push(arguments_);
    this.context.startedSources.push(this);
  }

  stop(...arguments_) {
    this.stopped.push(arguments_);
    this.context.stoppedSources.push(this);
  }
}

class FakeOscillatorNode extends FakeScheduledSource {
  constructor(context) {
    super(context, "oscillator");
    this.type = "sine";
    this.frequency = new FakeAudioParam(0);
    this.detune = new FakeAudioParam(0);
  }
}

class FakeDecodedAudioBuffer {
  constructor(duration = 12) {
    this.duration = duration;
  }
}

class FakeNoiseBuffer extends FakeDecodedAudioBuffer {
  constructor(length) {
    super(length / 1000);
    this.data = new Float32Array(length);
  }

  getChannelData() {
    return this.data;
  }
}

export class FakeAudioContext {
  constructor({ deferredDecode = false } = {}) {
    this.currentTime = 2;
    this.sampleRate = 1000;
    this.state = "suspended";
    this.destination = new FakeAudioNode(this);
    this.startedSources = [];
    this.stoppedSources = [];
    this.createdBufferSources = [];
    this.createdOscillators = [];
    this.resumeCount = 0;
    this.suspendCount = 0;
    this.closeCount = 0;
    this.deferredDecode = deferredDecode;
    this.pendingDecodes = [];
  }

  createBuffer(channels, length) {
    return new FakeNoiseBuffer(length);
  }

  createBufferSource() {
    const source = new FakeScheduledSource(this, "buffer");
    this.createdBufferSources.push(source);
    return source;
  }

  createBiquadFilter() {
    return new FakeFilterNode(this);
  }

  createDynamicsCompressor() {
    return new FakeCompressorNode(this);
  }

  createGain() {
    return new FakeGainNode(this);
  }

  createOscillator() {
    const oscillator = new FakeOscillatorNode(this);
    this.createdOscillators.push(oscillator);
    return oscillator;
  }

  decodeAudioData() {
    if (!this.deferredDecode) {
      return Promise.resolve(new FakeDecodedAudioBuffer());
    }
    return new Promise((resolve) => {
      this.pendingDecodes.push(resolve);
    });
  }

  resolvePendingDecodes() {
    const pending = [...this.pendingDecodes];
    this.pendingDecodes = [];
    for (const resolve of pending) {
      resolve(new FakeDecodedAudioBuffer());
    }
  }

  async resume() {
    this.resumeCount += 1;
    this.state = "running";
  }

  async suspend() {
    this.suspendCount += 1;
    this.state = "suspended";
  }

  async close() {
    this.closeCount += 1;
    this.state = "closed";
  }
}

export function createFakeAudioFetcher(requestedUrls = []) {
  return async (url) => {
    requestedUrls.push(String(url));
    return {
      ok: true,
      status: 200,
      async arrayBuffer() {
        return new Uint8Array([1, 2, 3, 4]).buffer;
      }
    };
  };
}

export async function flushAudioTasks(iterations = 4) {
  for (let index = 0; index < iterations; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}
