const { ipcRenderer } = require('electron');
(async () => {
  const config = { codec: 'avc1.42E028', width: 1280, height: 720, bitrate: 2500000, framerate: 30,
    hardwareAcceleration: 'prefer-software', latencyMode: 'realtime', contentHint: 'text', avc: { format: 'annexb' } };
  const support = await VideoEncoder.isConfigSupported(config);
  if (!support.supported) throw new Error('Software H.264 unsupported');
  const encoders = new Map();
  const release = id => { const encoder = encoders.get(id); if (encoder) { encoder.close(); encoders.delete(id); } };
  ipcRenderer.on('release-encoder', (_event, id) => release(id));
  ipcRenderer.on('encode-frame', (_event, { id, epoch, width, height, bytes, timestamp, key }) => {
    try {
      let encoder = encoders.get(id);
      if (!encoder) {
        encoder = new VideoEncoder({ output: chunk => { const bytes = new Uint8Array(chunk.byteLength); chunk.copyTo(bytes);
          ipcRenderer.send('encoded-packet', { id, epoch, bytes, key: chunk.type === 'key', timestamp: chunk.timestamp }); },
          error: () => { release(id); ipcRenderer.send('encoder-error', id); } });
        encoder.configure({ ...config, width, height, bitrate: Math.max(250000, Math.min(5000000, Math.round(2500000 * width * height / (1280 * 720)))) }); encoders.set(id, encoder);
      }
      const frame = new VideoFrame(bytes, { format: 'BGRA', codedWidth: width, codedHeight: height, timestamp, transfer: [bytes.buffer] });
      encoder.encode(frame, { keyFrame: key }); frame.close();
    } catch { release(id); ipcRenderer.send('encoder-error', id); }
  });
  ipcRenderer.send('encoder-ready');
})().catch(() => ipcRenderer.send('encoder-error'));
