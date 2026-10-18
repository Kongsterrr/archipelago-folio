// Explicit local QA tool. It records the renderer, never synthesizes game frames.
export function installCapture(canvas,getGame=()=>null) {
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
      link.download = 'v22.1-stable-stairs-actual-game.webm';
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
  const still=document.createElement('button'),pause=document.createElement('button'),overview=document.createElement('button');
  still.textContent='Save actual frame';pause.textContent='Pause for inspection';overview.textContent='Hold next overview';
  for(const [i,control]of[still,pause,overview].entries())control.style.cssText=button.style.cssText+`;top:${184+i*48}px`;
  let holdOverview=false,frame=0;
  overview.onclick=()=>{holdOverview=!holdOverview;overview.textContent=holdOverview?'Next overview will pause':'Hold next overview';};
  const inspect=()=>{const game=getGame();if(holdOverview&&game?.arrival?.active){holdOverview=false;game.pause('capture');overview.textContent='Hold next overview';pause.textContent='Resume inspection';}requestAnimationFrame(inspect);};requestAnimationFrame(inspect);
  pause.onclick=()=>{const game=getGame();if(!game)return;if(game.mode==='capture'){game.resume();pause.textContent='Pause for inspection';}else{game.pause('capture');pause.textContent='Resume inspection';}};
  still.onclick=async()=>{
   still.disabled=true;
   try{
    // Capture immediately after a real renderer frame; no re-created geometry.
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    const response=await fetch(`/__dev/capture/summit-frame-${String(++frame).padStart(2,'0')}.png`,{method:'POST',headers:{'Content-Type':'image/png','X-Career-Capture':'actual-game'},body:blob});
    const result=await response.json();if(!response.ok)throw Error(result.error);still.title=result.path;still.textContent=`Saved frame ${frame}`;
   }catch(error){still.textContent='Frame save failed';still.title=error.message;}finally{still.disabled=false;}
  };
  document.body.append(still,pause,overview);
  const toggle=document.createElement('button');
  toggle.textContent='Hide QA controls';
  toggle.style.cssText=button.style.cssText+';top:8px;right:50%;transform:translateX(50%);padding:4px 8px;font-size:11px';
  let controlsHidden=false;
  toggle.onclick=()=>{controlsHidden=!controlsHidden;for(const control of[button,still,pause,overview,download].filter(Boolean))control.hidden=controlsHidden;toggle.textContent=controlsHidden?'Show QA controls':'Hide QA controls';toggle.blur();};
  document.body.append(toggle);
}
