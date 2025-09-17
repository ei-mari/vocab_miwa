// Flashcard with audio player (MP3 -> fallback TTS)
let cards = [];
let idx = 0;
let revealed = false;

const audio = document.getElementById('audio');
const playBtn = document.getElementById('playBtn');
const track = document.getElementById('track');
const bar = document.getElementById('bar');
const rateSel = document.getElementById('rate');
const audioWrap = document.getElementById('audioWrap');

let usingTTS = false;           // MP3が無い時はTTSを使う
let ttsTimer = null;            // 簡易プログレス用
let synth = window.speechSynthesis;
let speechRate = 1.0;

// ====== ここを章ごとに調整 ======
// audio/chapter1/pattern1/file00001.mp3 ... の並びを想定
const AUDIO_BASE = 'audio/chapter1/pattern1';
const audioFileName = (i) => `file${String(i+1).padStart(5,'0')}.mp3`;
// =================================

function detectLang(text){
  for (const ch of text){
    const c = ch.codePointAt(0);
    if ((c>=0x3040 && c<=0x30ff) || (c>=0x4e00 && c<=0x9fff)) return 'ja-JP';
  }
  return 'en-US';
}
function speak(text){
  if(!synth) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = speechRate;
  u.lang = detectLang(text);
  synth.cancel(); synth.speak(u);
}

async function load(){
  try{
    const res = await fetch('data.json', { cache: 'no-store' });
    cards = await res.json();
  }catch(e){
    cards = [{ q: '読み込みに失敗しました', a: 'Failed to load data.json' }];
  }
  render();
}

function setAudioSource(i){
  // MP3の存在チェックは直接できないので、一旦srcを差してonerrorでTTSに切替
  usingTTS = false;
  clearTtsTimer();
  audio.src = `${AUDIO_BASE}/${audioFileName(i)}`;
  audio.playbackRate = speechRate;
}

function render(){
  const qEl = document.getElementById('question');
  const aEl = document.getElementById('answer');
  const progressEl = document.getElementById('progress');

  if (idx >= cards.length){
    qEl.textContent = '修了！おつかれさま 🎉';
    aEl.textContent = `カード数: ${cards.length}`;
    qEl.classList.remove('hidden'); aEl.classList.remove('hidden');
    audioWrap.classList.add('hidden');
    progressEl.textContent = `${cards.length}/${cards.length}`;
    return;
  }

  const card = cards[idx];
  qEl.textContent = card.q;
  aEl.textContent = card.a;

  if (revealed){
    qEl.classList.add('hidden');
    aEl.classList.remove('hidden');
    audioWrap.classList.remove('hidden');
    setAudioSource(idx);
  }else{
    qEl.classList.remove('hidden');
    aEl.classList.add('hidden');
    audioWrap.classList.add('hidden');
    stopAllAudio();
  }

  progressEl.textContent = `${idx + 1}/${cards.length}`;
  resetProgress();
}

function resetProgress(){ bar.style.width = '0%'; }
function stopAllAudio(){
  // 音声停止
  try{ audio.pause(); audio.currentTime = 0; }catch(_){}
  // TTS停止
  if (synth) synth.cancel();
  clearTtsTimer();
}
function clearTtsTimer(){ if (ttsTimer){ clearInterval(ttsTimer); ttsTimer = null; } }

function next(){
  stopAllAudio();
  if (idx < cards.length - 1){ idx++; revealed = false; render(); }
  else { idx++; render(); }
}
function prev(){ if (idx>0){ stopAllAudio(); idx--; revealed = false; render(); } }
function retry(){
  stopAllAudio();
  if (revealed){
    // もう一度：英語面の音声を先頭から
    setAudioSource(idx);
    // 自動再生はせずボタン操作に任せる
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  load();

  // カードタップでQ/A切替
  const card = document.getElementById('card');
  card.addEventListener('click', ()=>{ revealed = !revealed; render(); });

  // ナビ
  document.getElementById('next').addEventListener('click', next);
  document.getElementById('prev').addEventListener('click', prev);
  document.getElementById('retry').addEventListener('click', retry);

  // キー操作
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
    if (e.key === ' ') { e.preventDefault(); revealed = !revealed; render(); }
  });

  // 再生ボタン
  playBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    if (usingTTS){
      // TTS 再生トグル
      if (synth && synth.speaking){ synth.cancel(); clearTtsTimer(); updatePlayIcon(false); }
      else { startTTS(); updatePlayIcon(true); }
      return;
    }
    if (audio.paused){ audio.play(); } else { audio.pause(); }
  });

  // 速度
  rateSel.addEventListener('change', (e)=>{
    speechRate = parseFloat(e.target.value);
    audio.playbackRate = speechRate;
  });

  // audioイベント
  audio.addEventListener('timeupdate', ()=>{
    if (!isFinite(audio.duration) || audio.duration === 0) return;
    bar.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
  });
  audio.addEventListener('ended', ()=>{ updatePlayIcon(false); });
  audio.addEventListener('play', ()=>{ updatePlayIcon(true); });
  audio.addEventListener('pause', ()=>{ updatePlayIcon(false); });
  audio.addEventListener('error', ()=>{
    // MP3が無い → TTSへフォールバック
    usingTTS = true;
    resetProgress();
  });

  // トラッククリックでシーク（MP3のみ）
  track.addEventListener('click', (e)=>{
    e.stopPropagation();
    if (usingTTS) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left)/rect.width));
    if (isFinite(audio.duration) && audio.duration>0){
      audio.currentTime = ratio * audio.duration;
    }
  });
});

function startTTS(){
  // ざっくり進捗(2.5sで100%など)にしたい場合は調整
  const text = (cards[idx] && cards[idx].a) || '';
  const approxSec = Math.max(1.8, Math.min(6, text.length / 10)) / (speechRate || 1);
  const start = performance.now();
  speak(text);
  clearTtsTimer();
  ttsTimer = setInterval(()=>{
    const t = (performance.now() - start) / (approxSec*1000);
    bar.style.width = `${Math.min(100, t*100)}%`;
    if (t>=1){ clearTtsTimer(); updatePlayIcon(false); }
  }, 60);
}

function updatePlayIcon(playing){
  playBtn.innerHTML = playing
    ? `<svg viewBox="0 0 24 24" width="22" height="22"><rect x="6" y="4" width="4" height="16" fill="currentColor"></rect><rect x="14" y="4" width="4" height="16" fill="currentColor"></rect></svg>`
    : `<svg viewBox="0 0 24 24" width="22" height="22"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor"></polygon></svg>`;
}
