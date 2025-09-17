// Flashcard logic (card tap to reveal, pastel UI)
let cards = [];
let idx = 0;
let revealed = false;
let synth = window.speechSynthesis;
let speechRate = 1.0;

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

function render(){
  const qEl = document.getElementById('question');
  const aEl = document.getElementById('answer');
  const progressEl = document.getElementById('progress');

  if (idx >= cards.length){
    // end screen
    qEl.textContent = '修了！おつかれさま 🎉';
    aEl.textContent = `カード数: ${cards.length}`;
    qEl.classList.remove('hidden'); aEl.classList.remove('hidden');
    progressEl.textContent = `${cards.length}/${cards.length}`;
    return;
  }

  const card = cards[idx];
  qEl.textContent = card.q;
  aEl.textContent = card.a;

  // show/hide
  if (revealed){
    qEl.classList.add('hidden');
    aEl.classList.remove('hidden');
  }else{
    qEl.classList.remove('hidden');
    aEl.classList.add('hidden');
  }
  progressEl.textContent = `${idx + 1}/${cards.length}`;
}

function next(){
  if (idx < cards.length - 1){ idx++; revealed = false; render(); }
  else { idx++; render(); }
}
function prev(){
  if (idx > 0){ idx--; revealed = false; render(); }
}
function retry(){
  revealed = false; render();
}
function restartAll(){
  idx = 0; revealed = false; render();
}

document.addEventListener('DOMContentLoaded', ()=>{
  load();

  // card tap to toggle reveal
  const card = document.getElementById('card');
  card.addEventListener('click', ()=>{ revealed = !revealed; render(); });

  // nav buttons
  document.getElementById('next').addEventListener('click', next);
  document.getElementById('prev').addEventListener('click', prev);
  document.getElementById('retry').addEventListener('click', retry);
  document.getElementById('restart').addEventListener('click', restartAll);

  // menu toggle
  const menuBtn = document.getElementById('menuBtn');
  const menu = document.getElementById('menuPanel');
  menuBtn.addEventListener('click', ()=>{
    menu.classList.toggle('hidden');
  });
  document.addEventListener('click', (e)=>{
    if (!menu.contains(e.target) && e.target !== menuBtn) menu.classList.add('hidden');
  });

  // rate
  document.getElementById('rate').addEventListener('change', (e)=>{
    speechRate = parseFloat(e.target.value);
  });

  // keyboard shortcuts
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
    if (e.key === ' ') { e.preventDefault(); revealed = !revealed; render(); }
  });

  // optional: speak when revealing answer (comment out if不要)
  // card.addEventListener('click', ()=>{ if(revealed) speak(cards[idx].a || ''); else speak(cards[idx].q || ''); });
});
