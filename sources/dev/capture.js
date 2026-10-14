// Explicit local QA tool. It records the renderer, never synthesizes game frames.
export function installCapture(canvas) {
  if (!canvas?.captureStream || !window.MediaRecorder) return;
  const button = document.createElement('button');
  button.textContent = 'Record actual game';
  button.style.cssText = 'position:fixed;right:16px;top:88px;z-index:90;padding:10px 14px;background:#fff5df;color:#123b50;border:1px solid #123b50;border-radius:8px';
  button.dataset.capture = 'true';
  let recorder, stream, chunks = [], download;
  button.onclick = () => {
    if (recorder?.state === 'recording') { button.disabled = true; recorder.stop(); return; }
    if (download) { URL.revokeObjectURL(download.href); download.remove(); download = null; }
    delete button.dataset.captureSaved;
    button.title = '';
    stream = canvas.captureStream(30);
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
    recorder = new MediaRecorder(stream, {mimeType, videoBitsPerSecond: 6_000_000});
    chunks = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = async () => {
      for (const track of stream.getTracks()) track.stop();
      const recording = new Blob(chunks, {type: recorder.mimeType});
      const link = document.createElement('a');
      link.href = URL.createObjectURL(recording);
      link.download = 'v20-career-valley-express-actual-game.webm';
      link.textContent = 'Download actual game recording';
      link.style.cssText = button.style.cssText + ';top:136px';
      link.onclick = () => setTimeout(() => {URL.revokeObjectURL(link.href);link.remove();}, 1000);
      document.body.append(link);
      download = link;
      button.disabled = true;
      button.textContent = 'Saving actual game recording…';
      try {
        const response = await fetch('/__dev/capture/career-valley', {
          method: 'POST',
          headers: {'Content-Type': 'video/webm', 'X-Career-Capture': 'actual-game'},
          body: recording
        });
        const result = await response.json();
        if (!response.ok || !result.saved) throw new Error(result.error || 'Local save failed');
        button.textContent = 'Saved actual game recording · Record again';
        button.title = result.path;
        button.dataset.captureSaved = result.path;
      } catch (error) {
        button.textContent = 'Local save failed · Record again';
        button.title = `${error.message}. Use the recording download below.`;
        delete button.dataset.captureSaved;
      } finally {
        button.disabled = false;
      }
    };
    recorder.start(1000);
    button.textContent = 'Stop game recording';
    button.blur();
  };
  document.body.append(button);
}
