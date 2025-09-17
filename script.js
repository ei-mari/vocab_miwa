// TTS-only flashcard (MP3不要)
let cards = [];
let idx = 0;
let revealed = false;

const playBtn = document.getElementById('playBtn');
const track = document.getElementById('track');
const bar = document.getElementById('bar');
const rateSel = document.getElementById('rate');
const audioWrap = document.getElementById('audioWrap');

let synth = window.speechSynthesis;
let speechRate = 1.0;
let ttsTimer = null;

function detectLang(text){
  for (const ch of text){
    const c = ch.codePointAt(0);
    if ((c>=0x3040 && c<=0x30ff) || (c>=0x4e00 && c<=0x9fff)) return 'ja-JP';
  }
  return 'en-US';
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
  }else{
    qEl.classList.remove('hidden');
    aEl.classList.add('hidden');
    audioWrap.classList.add('hidden');
    stopTTS();
  }

  progressEl.textContent = `${idx + 1}/${cards.length}`;
  resetProgress();
}

function resetProgress(){ bar.style.width = '0%'; }
function stopTTS(){
  if (synth) synth.cancel();
  if (ttsTimer){ clearInterval(ttsTimer); ttsTimer = null; }
  updatePlayIcon(false);
}

function next(){
  stopTTS();
  if (idx < cards.length - 1){ idx++; revealed = false; render(); }
  else { idx++; render(); }
}
function prev(){ if (idx>0){ stopTTS(); idx--; revealed = false; render(); } }
function retry(){
  stopTTS();
  if (revealed) startTTS(); // 英語面で「もう一度」
}

function startTTS(){
  const text = (cards[idx] && cards[idx].a) || '';
  if (!text) return;

  const u = new SpeechSynthesisUtterance(text);
  u.rate = speechRate;
  u.lang = detectLang(text);
  u.onend = () => { updatePlayIcon(false); finishProgress(); };

  // ざっくり進捗（文字数ベースの見積もり）
  const estSec = Math.max(1.6, Math.min(6, text.length / 10)) / (speechRate || 1);
  const start = performance.now();
  if (ttsTimer) clearInterval(ttsTimer);
  ttsTimer = setInterval(()=>{
    const p = (performance.now() - start) / (estSec * 1000);
    bar.style.width = `${Math.min(100, p*100)}%`;
    if (p >= 1){ clearInterval(ttsTimer); ttsTimer = null; }
  }, 60);

  synth.cancel();            // 直前の読み上げを止めて
  synth.speak(u);            // 読み上げ
  updatePlayIcon(true);
}

function finishProgress(){ bar.style.width = '100%'; }
function updatePlayIcon(playing){
  playBtn.innerHTML = playing
    ? `<svg viewBox="0 0 24 24" width="22" height="22"><rect x="6" y="4" width="4" height="16" fill="currentColor"></rect><rect x="14" y="4" width="4" height="16" fill="currentColor"></rect></svg>`
    : `<svg viewBox="0 0 24 24" width="22" height="22"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor"></polygon></svg>`;
}

document.addEventListener('DOMContentLoaded', ()=>{
  load();

  // カードタップでQ/A切替（答え面でTTS UI表示）
  const card = document.getElementById('card');
  card.addEventListener('click', ()=>{ revealed = !revealed; render(); });

  // ナビ
  document.getElementById('next').addEventListener('click', next);
  document.getElementById('prev').addEventListener('click', prev);
  document.getElementById('retry').addEventListener('click', retry);

  // 再生ボタン（TTSトグル）
  playBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    if (synth && synth.speaking){ stopTTS(); }
    else { startTTS(); }
  });

  // 速度
  rateSel.addEventListener('change', (e)=>{
    speechRate = parseFloat(e.target.value);
    // 再生中なら速度変更後に読み直す
    if (synth && synth.speaking){
      stopTTS();
      startTTS();
    }
  });

  // キー操作
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
    if (e.key === ' ') { e.preventDefault(); revealed = !revealed; render(); }
  });
});
