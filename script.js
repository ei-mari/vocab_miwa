// TTS-only flashcard: tap to reveal & auto speak with female voice
let cards = [];
let idx = 0;
let revealed = false;

const playBtn = document.getElementById('playBtn');
const bar = document.getElementById('bar');
const rateSel = document.getElementById('rate');
const audioWrap = document.getElementById('audioWrap');

let synth = window.speechSynthesis;
let speechRate = 1.0;
let ttsTimer = null;
let voices = [];

// ---- voice helpers ----
function loadVoices() { voices = synth ? synth.getVoices() : []; }
if (synth) {
  loadVoices();
  synth.onvoiceschanged = loadVoices;
}

// 名前で“女性らしい”声を優先（端末により異なるためベストエフォート）
const FEMALE_CANDIDATES = {
  'ja': ['Kyoko','Nozomi','Mizuki','Hina','Nanami','Sakura','Sayaka','Google 日本語'],
  'en-US': ['Samantha','Aria','Jenny','Zira','Google US English'],
  'en-GB': ['Google UK English Female','Sonia','Libby']
};
function pickFemaleVoice(lang) {
  if (!voices.length) return null;
  const base = lang.split('-')[0];          // 'ja', 'en'
  const inLang = voices.filter(v => v.lang && v.lang.startsWith(lang) || v.lang.startsWith(base));
  const names = (FEMALE_CANDIDATES[lang] || []).concat(FEMALE_CANDIDATES[base] || []);
  for (const name of names) {
    const hit = inLang.find(v => v.name.includes(name));
    if (hit) return hit;
  }
  // fallback:その言語の最初の声
  return inLang[0] || null;
}

function detectLang(text){
  for (const ch of text){
    const c = ch.codePointAt(0);
    if ((c>=0x3040 && c<=0x30ff) || (c>=0x4e00 && c<=0x9fff)) return 'ja-JP';
  }
  return 'en-US';
}

// ---- app ----
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
    // 画面タップで答え面になった瞬間に自動再生
    startTTS();
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

function next(){ stopTTS(); if (idx < cards.length - 1){ idx++; revealed = false; render(); } else { idx++; render(); } }
function prev(){ if (idx>0){ stopTTS(); idx--; revealed = false; render(); } }
function retry(){ stopTTS(); if (revealed) startTTS(); }

function startTTS(){
  const text = (cards[idx] && cards[idx].a) || '';
  if (!text) return;

  // voicesがまだ来てない場合のリトライ（ブラウザ仕様対策）
  if (synth && voices.length === 0) { setTimeout(startTTS, 120); return; }

  const u = new SpeechSynthesisUtterance(text);
  u.rate = speechRate;
  const lang = detectLang(text);
  u.lang = lang;
  const voice = pickFemaleVoice(lang);
  if (voice) u.voice = voice;

  u.onend = () => { updatePlayIcon(false); finishProgress(); };

  // 簡易プログレス（文字数から推定）
  const estSec = Math.max(1.6, Math.min(6, text.length / 10)) / (speechRate || 1);
  const start = performance.now();
  if (ttsTimer) clearInterval(ttsTimer);
  ttsTimer = setInterval(()=>{
    const p = (performance.now() - start) / (estSec * 1000);
    bar.style.width = `${Math.min(100, p*100)}%`;
    if (p >= 1){ clearInterval(ttsTimer); ttsTimer = null; }
  }, 60);

  synth.cancel();            // 直前の読み上げを止める
  synth.speak(u);            // 再生
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

  // カード全体をタップでQ/A切替 → 答え面なら即TTS
  document.getElementById('card').addEventListener('click', ()=>{
    revealed = !revealed; render();
  });

  // ナビ
  document.getElementById('next').addEventListener('click', next);
  document.getElementById('prev').addEventListener('click', prev);
  document.getElementById('retry').addEventListener('click', retry);

  // 再生ボタン（手動トグル）
  playBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    if (synth && synth.speaking){ stopTTS(); } else { startTTS(); }
  });

  // 速度
  rateSel.addEventListener('change', (e)=>{
    speechRate = parseFloat(e.target.value);
    if (synth && synth.speaking){ stopTTS(); startTTS(); }
  });

  // キー操作
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
    if (e.key === ' ') { e.preventDefault(); revealed = !revealed; render(); }
  });
});
