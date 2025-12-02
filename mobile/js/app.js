const videoEl = document.getElementById('video');
const card = document.getElementById('card');
const leftBtn = document.getElementById('choose-left');
const rightBtn = document.getElementById('choose-right');
const leftLabel = document.getElementById('leftLabel');
const rightLabel = document.getElementById('rightLabel');
const doneEl = document.getElementById('done');

let videos = [];
let currentIndex = 0;
let currentUserId = null;
let pendingPrimaryMobile = null; // store primary choice until certainty is selected
const RATING_SHOW_DELAY = 500;
let ratingLockedMobile = false;

function lockMobileUI() {
  ratingLockedMobile = true;
  try {
    const controls = document.querySelector('.controls');
    if (controls) controls.classList.add('locked');
    for (const b of document.querySelectorAll('.controls button')) {
      b.disabled = true;
      b.hidden = true;
    }
  } catch (e) {}
}

function unlockMobileUI() {
  ratingLockedMobile = false;
  try {
    const controls = document.querySelector('.controls');
    if (controls) controls.classList.remove('locked');
    for (const b of document.querySelectorAll('.controls button')) {
      b.disabled = false;
      b.hidden = false;
    }
  } catch (e) {}
}

async function createUser(){
  try{
    const res = await fetch('/api/user',{method:'POST'});
    if(res.ok){ const data = await res.json(); currentUserId = data.userId }
  }catch(e){console.warn('user create failed', e)}
}

async function fetchVideos(){
  try{
    const r = await fetch('/api/videos'); if(!r.ok) throw 0; videos = await r.json();
  }catch(e){videos=[]}
}

function loadCurrent(){
  if(!videos || currentIndex>=videos.length){ showDone(); return }
  const filename = videos[currentIndex];
  // ensure video is visible when loading
  try { videoEl.style.visibility = 'visible'; videoEl.style.display = ''; videoEl.style.opacity = '1'; } catch (e) {}
  // ensure card is visible (remove hidden if present)
  try { card.classList.remove('hidden'); } catch (e) {}
  videoEl.src = `/videos/${encodeURI(filename)}`;
  videoEl.currentTime = 0;
  // reset transform
  card.classList.remove('swipe-left','swipe-right');
  leftLabel.style.opacity = 0; rightLabel.style.opacity = 0;
}

function showDone(){
  card.classList.add('hidden');
  leftBtn.disabled = true; rightBtn.disabled = true;
  doneEl.classList.remove('hidden');
}

async function submitRating(rating, certainty){
  const filename = videos[currentIndex];
  try{
    // If certainty is provided, include it in the payload
    await fetch('/api/rate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({videoId:filename,rating,certainty,userId:currentUserId})});
  }catch(e){console.warn('rate failed',e)}
}

function animateChoice(dir){
  if(dir === 'left'){
    card.classList.add('swipe-left'); leftLabel.style.opacity=1
  } else {
    card.classList.add('swipe-right'); rightLabel.style.opacity=1
  }
}

function buildCertaintyButtonsMobile() {
  // replace controls with 1..5 certainty buttons
  const controls = document.querySelector('.controls');
  controls.innerHTML = '';
  const prompt = document.createElement('div');
  prompt.className = 'certainty-prompt';
  prompt.textContent = 'How certain are you?';
  controls.appendChild(prompt);
  for (let i = 1; i <= 5; i++) {
    const b = document.createElement('button');
    b.className = 'choice certainty';
    b.textContent = String(i);
    if (ratingLockedMobile) b.disabled = true;
    b.addEventListener('click', async () => {
      // submit both primary and certainty
      if (!pendingPrimaryMobile || ratingLockedMobile) return;
      // lock UI so additional taps are ignored while we pause
      lockMobileUI();
      await submitRating(pendingPrimaryMobile, i);
      // restore controls to original buttons and advance
      pendingPrimaryMobile = null;
      restoreChoiceButtons();
      // ensure restored controls also get locked (buttons created by restoreChoiceButtons are new)
      lockMobileUI();
      nextVideoMobile();
    });
    controls.appendChild(b);
  }
}

function nextVideoMobile() {
  currentIndex++;
  if (currentIndex >= videos.length) {
    showDone();
    return;
  }

  setTimeout(() => {
    try { videoEl.style.opacity = '1'; } catch (e) {}
    // unlock inputs again when next video appears
    unlockMobileUI();
    loadCurrent();
  }, RATING_SHOW_DELAY);
}

function restoreChoiceButtons(){
  const controls = document.querySelector('.controls');
  controls.innerHTML = '';
  const left = document.createElement('button');
  left.id = 'choose-left'; left.className = 'choice left'; left.textContent = 'REAL';
  const right = document.createElement('button');
  right.id = 'choose-right'; right.className = 'choice right'; right.textContent = 'AI';
  left.addEventListener('click', ()=> { if (!ratingLockedMobile) choose('left') });
  right.addEventListener('click', ()=> { if (!ratingLockedMobile) choose('right') });
  // reflect locked state on newly created controls
  try { left.disabled = ratingLockedMobile; right.disabled = ratingLockedMobile; left.hidden = ratingLockedMobile; right.hidden = ratingLockedMobile; } catch (e) {}
  controls.appendChild(left);
  controls.appendChild(right);
}

async function choose(dir){
  if (ratingLockedMobile) return; // ignore gestures/clicks while locked
  if(!videos || currentIndex>=videos.length) return;
  const rating = dir === 'left' ? 5 : 1; // left=real(5), right=ai(1)
  pendingPrimaryMobile = rating;
  // show animation then present certainty choices
  animateChoice(dir);
  setTimeout(()=>{
    // reset swipe classes to keep the card in place
    card.classList.remove('swipe-left','swipe-right');
    leftLabel.style.opacity = 0; rightLabel.style.opacity = 0;
    buildCertaintyButtonsMobile();
  }, 320);
}

// touch handling for swipe gestures
let startX = 0; let isTouching = false;
card.addEventListener('touchstart', e=>{ if (ratingLockedMobile) return; isTouching=true; startX = e.touches[0].clientX });
card.addEventListener('touchmove', e=>{
  if(!isTouching) return;
  const dx = e.touches[0].clientX - startX;
  card.style.transform = `translateX(${dx}px) rotate(${dx/20}deg)`;
  if(dx > 40) { rightLabel.style.opacity=1; leftLabel.style.opacity=0 }
  else if(dx < -40) { leftLabel.style.opacity=1; rightLabel.style.opacity=0 }
});
card.addEventListener('touchend', e=>{
  isTouching=false; card.style.transform='';
  const endX = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : startX;
  const dx = endX - startX;
  if(dx > 80){ choose('right') }
  else if(dx < -80){ choose('left') }
  else { leftLabel.style.opacity=0; rightLabel.style.opacity=0 }
});

// mouse drag support (for desktop testing)
let isDraggingMouse = false;
card.addEventListener('mousedown', e => {
  if (ratingLockedMobile) return;
  isDraggingMouse = true;
  startX = e.clientX;
  e.preventDefault();
});
document.addEventListener('mousemove', e => {
  if (!isDraggingMouse) return;
  const dx = e.clientX - startX;
  card.style.transform = `translateX(${dx}px) rotate(${dx/20}deg)`;
  if (dx > 40) { rightLabel.style.opacity = 1; leftLabel.style.opacity = 0 }
  else if (dx < -40) { leftLabel.style.opacity = 1; rightLabel.style.opacity = 0 }
});
document.addEventListener('mouseup', e => {
  if (!isDraggingMouse) return;
  isDraggingMouse = false;
  card.style.transform = '';
  const dx = e.clientX - startX;
  if (dx > 80) { choose('right') }
  else if (dx < -80) { choose('left') }
  else { leftLabel.style.opacity = 0; rightLabel.style.opacity = 0 }
});

// click buttons
leftBtn.addEventListener('click', ()=> { if (!ratingLockedMobile) choose('left') });
rightBtn.addEventListener('click', ()=> { if (!ratingLockedMobile) choose('right') });

// hide video when playback completes so the last frozen frame isn't visible
videoEl.addEventListener('ended', () => {
  try {
    // pause and fade to black — keep the element present until the user submits certainty
    videoEl.pause();
    try { videoEl.style.transition = 'opacity 240ms ease'; } catch (e) {}
    try { videoEl.style.opacity = '0'; } catch (e) {}
    // keep the card visible so the user can still rate the item; clear labels
    leftLabel.style.opacity = 0; rightLabel.style.opacity = 0;
  } catch (e) {}
  // If nothing happens, ensure the primary rating controls reappear after a short delay
  setTimeout(() => {
    try {
      const controls = document.querySelector('.controls');
      if (!pendingPrimaryMobile && controls && !controls.querySelector('button')) {
        restoreChoiceButtons();
      }
    } catch (e) {}
  }, 500);
});

// startup
(async function(){
  await createUser();
  await fetchVideos();
  loadCurrent();
})();
