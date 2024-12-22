class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.silenceThreshold = 0.01; // Adjust this value to change sensitivity
    this.silenceFrames = 0;
    this.minSilenceFrames = 10; // Minimum frames of silence to consider it silence
    this.isSpeaking = false;
  }

  detectSilence(input) {
    // Calculate RMS (Root Mean Square) of the audio frame
    const rms = Math.sqrt(
      input.reduce((acc, val) => acc + val * val, 0) / input.length
    );

    if (rms < this.silenceThreshold) {
      this.silenceFrames++;
    } else {
      this.silenceFrames = 0;
    }

    // Update speaking state
    if (!this.isSpeaking && rms > this.silenceThreshold) {
      this.isSpeaking = true;
      return false;
    } else if (this.isSpeaking && this.silenceFrames > this.minSilenceFrames) {
      this.isSpeaking = false;
      return true;
    }
    return this.isSpeaking;
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    
    //console.log("input", input);
    //console.log("output", output);
    if (!input) return true;

    // Only send audio when speech is detected
    if (this.detectSilence(input)) {
      const outputChannelData = inputs[0]?.[0];

      console.log("outputChannelData", outputChannelData);

      // Convert the input audio from Float32 to PCM16
      for (let i = 0; i < input.length; i++) {
        // Clamp to PCM range -1 to 1, then convert to PCM16 range
        const pcmValue = Math.max(-1, Math.min(1, input[i]));
        outputChannelData[i] = pcmValue * 32767; // Convert to PCM16: -32768 to 32767
      }
      const pcm16Buffer = new Int16Array(outputChannelData);


      this.port.postMessage(
        {
          type: "audio",
          buffer: pcm16Buffer.buffer,
        },
        [input.buffer]
      );
    }

    return true;
  }
}

registerProcessor("audio-processor", AudioProcessor);
