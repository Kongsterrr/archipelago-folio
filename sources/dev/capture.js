// Explicit local QA tool. It records the renderer, never synthesizes game frames.
export function installCapture(canvas) {
  if (!canvas?.captureStream || !window.MediaRecorder) return;
  const button = document.createElement('button');
  button.textContent = 'Record actual game';
  button.style.cssText = 'position:fixed;right:16px;top:88px;z-index:90;padding:10px 14px;background:#fff5df;color:#123b50;border:1px solid #123b50;border-radius:8px';
  button.dataset.capture = 'true';
  let recorder, stream, chunks = [];
  button.onclick = () => {
    if (recorder?.state === 'recording') { recorder.stop(); return; }
    stream = canvas.captureStream(30);
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
    recorder = new MediaRecorder(stream, {mimeType, videoBitsPerSecond: 6_000_000});
    chunks = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      for (const track of stream.getTracks()) track.stop();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob(chunks, {type: recorder.mimeType}));
      link.download = 'v19-career-railway-actual-game.webm';
      link.textContent = 'Download actual game recording';
      link.style.cssText = button.style.cssText + ';top:136px';
      link.onclick = () => setTimeout(() => {URL.revokeObjectURL(link.href);link.remove();}, 1000);
      document.body.append(link);
      button.textContent = 'Record actual game';
    };
    recorder.start(1000);
    button.textContent = 'Stop game recording';
    button.blur();
  };
  document.body.append(button);
}
