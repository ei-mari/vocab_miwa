// Simple flashcard quiz for GitHub Pages
let cards = [];
let idx = 0;
let revealed = false;
let correctCount = 0;
let synth = window.speechSynthesis;
let speechRate = 1.0;

function detectLang(text) {
  // crude detection: if includes Hiragana/Katakana/Kanji, assume Japanese
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (
      (code >= 0x3040 && code <= 0x30ff) || // Hiragana/Katakana
      (code >= 0x4e00 && code <= 0x9fff)    // CJK Unified Ideographs
    ) return 'ja-JP';
  }
  return 'en-US';
}

function speak(text) {
  if (!synth) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = speechRate;
  u.lang = detectLang(text);
  synth.cancel();
  synth.speak(u);
}

async function load() {
  try {
    const res = await fetch('data.json', { cache: 'no-store' });
    cards = await res.json();
  } catch (e) {
    cards = [{ q: '読み込みに失敗しました', a: 'Failed to load data.json' }];
  }
  document.getElementById('progress').textContent = `1/${cards.length}`;
  render();
}

function render() {
  const qEl = document.getElementById('question');
  const aEl = document.getElementById('answer');
  const revealBtn = document.getElementById('reveal');
  const gotBtn = document.getElementById('gotIt');
  const missBtn = document.getElementById('missed');
  const nextBtn = document.getElementById('next');
  const resultEl = document.getElementById('result');

  // END screen first (avoid out-of-range access)
  if (idx >= cards.length) {
    qEl.textContent = '修了！おつかれさま 🎉';
    aEl.textContent = `できた数: ${correctCount} / ${cards.length}`;
    aEl.classList.remove('hidden');
    aEl.classList.add('revealed');
    revealBtn.disabled = true;
    nextBtn.disabled = true;
    if (gotBtn) gotBtn.disabled = true;
    if (missBtn) missBtn.disabled = true;
    resultEl.classList.remove('hidden');
    resultEl.textContent = '「最初から」を押すとリセットできます。';
    document.getElementById('progress').textContent = `${cards.length}/${cards.length}`;
    return;
  }

  const card = cards[idx];
  qEl.textContent = card.q;
  aEl.textContent = card.a;

  // reveal state
  if (revealed) {
    aEl.classList.remove('hidden');
    aEl.classList.add('revealed');
    revealBtn.textContent = '隠す';
  } else {
    aEl.classList.add('hidden');
    aEl.classList.remove('revealed');
    revealBtn.textContent = '答えを表示';
  }

  // progress
  document.getElementById('progress').textContent = `${idx + 1}/${cards.length}`;

  // normal state
  revealBtn.disabled = false;
  nextBtn.disabled = false;
  if (gotBtn) gotBtn.disabled = false;
  if (missBtn) missBtn.disabled = false;
  resultEl.classList.add('hidden');
}

function next() {
  if (idx < cards.length - 1) {
    idx++;
    revealed = false;
    render();
  } else if (idx === cards.length - 1) {
    // move to end screen
    idx++;
    render();
  }
}

function toggleReveal() {
  revealed = !revealed;
  render();
}

function restart() {
  idx = 0;
  revealed = false;
  correctCount = 0;
  render();
}

function gotIt() {
  correctCount++;
  next();
}

function missed() {
  next();
}

document.addEventListener('DOMContentLoaded', () => {
  load();

  document.getElementById('reveal').addEventListener('click', toggleReveal);
  document.getElementById('next').addEventListener('click', next);
  document.getElementById('restart').addEventListener('click', restart);
  document.getElementById('gotIt').addEventListener('click', gotIt);
  document.getElementById('missed').addEventListener('click', missed);

  document.getElementById('speakQ').addEventListener('click', () => {
    const card = cards[Math.min(idx, cards.length - 1)];
    speak(card.q || '');
  });
  document.getElementById('speakA').addEventListener('click', () => {
    const card = cards[Math.min(idx, cards.length - 1)];
    speak(card.a || '');
  });

  document.getElementById('rate').addEventListener('change', (e) => {
    speechRate = parseFloat(e.target.value);
  });

  // keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === ' ') { e.preventDefault(); toggleReveal(); }
    if (e.key === 'ArrowRight') next();
  });
});
