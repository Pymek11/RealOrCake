const videoEl = document.getElementById("video");
const titleEl = document.getElementById("video-title");
const ratingButtonsRow = document.getElementById("rating-buttons");
const thanksScreen = document.getElementById("thanks-screen");
const playerCard = document.getElementById("player-card");
const restartBtn = document.getElementById("restart");
const startScreen = document.getElementById("start-screen");
const startBtn = document.getElementById("start-btn");

let videos = [];
let currentIndex = 0;
let pendingPrimary = null; // temporarily store primary choice ('ai' or 'real') until certainty is given
const RATING_SHOW_DELAY = 500;
let ratingLocked = false; // prevent inputs while a gap is in progress

function lockRatingUI() {
	ratingLocked = true;
	try {
		for (const b of ratingButtonsRow.querySelectorAll('button')) b.disabled = true, b.hidden = true;
	} catch (e) {}
}

function unlockRatingUI() {
	ratingLocked = false;
	try {
		for (const b of ratingButtonsRow.querySelectorAll('button')) b.disabled = false, b.hidden = false;
	} catch (e) {}
}
async function fetchVideos() {
	try {
		const res = await fetch("/api/videos");
		if (!res.ok) throw new Error("Failed to load videos");
		videos = await res.json();
	} catch (err) {
		console.error(err);
		videos = [];
	}
}

function buildRatingButtons() {
	ratingButtonsRow.innerHTML = "";
	// two choices: AI (left) and REAL (right). Map to numeric ratings for storage.
	const aiBtn = document.createElement("button");
	aiBtn.className = "rate-btn rate-ai";
	aiBtn.textContent = "AI";
	aiBtn.addEventListener("click", () => { if (!ratingLocked) initiatePrimaryRating('ai'); });
	if (ratingLocked) aiBtn.disabled = true;
	ratingButtonsRow.appendChild(aiBtn);

	const realBtn = document.createElement("button");
	realBtn.className = "rate-btn rate-real";
	realBtn.textContent = "REAL";
	realBtn.addEventListener("click", () => { if (!ratingLocked) initiatePrimaryRating('real'); });
	if (ratingLocked) realBtn.disabled = true;
	ratingButtonsRow.appendChild(realBtn);
}

function buildCertaintyButtons() {
	// replace rating row with certainty choices 1..5
	ratingButtonsRow.innerHTML = "";
	const prompt = document.getElementById('rating-prompt');
	if (prompt) prompt.textContent = 'How certain are you? (1 = not sure, 5 = very sure)';

	for (let i = 1; i <= 5; i++) {
		const b = document.createElement('button');
		b.className = 'rate-btn certainty-btn';
		b.textContent = String(i);
		b.addEventListener('click', () => { if (!ratingLocked) submitFullRating(i); });
		if (ratingLocked) b.disabled = true;
		ratingButtonsRow.appendChild(b);
	}
}

function resetPrimaryButtons() {
	const prompt = document.getElementById('rating-prompt');
	if (prompt) prompt.textContent = 'Oceń ten materiał — czy jest realny czy AI';
	buildRatingButtons();
}

function initiatePrimaryRating(choice) {
	// user clicked AI/REAL — store and prompt for certainty
	if (ratingLocked) return;
	pendingPrimary = choice;
	// visually lock primary buttons
	// build certainty UI (1..5)
	buildCertaintyButtons();
}

async function submitFullRating(certaintyValue) {
	// pendingPrimary should be set
	if (!pendingPrimary) return console.warn('No primary rating selected');
	const filename = videos[currentIndex];
	try {
		let ratingToSend = pendingPrimary;
		if (pendingPrimary === 'ai') ratingToSend = 1;
		if (pendingPrimary === 'real') ratingToSend = 5;
		await fetch('/api/rate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ videoId: filename, rating: ratingToSend, certainty: certaintyValue, userId: currentUserId }),
		});
	} catch (err) {
		console.error('Failed to send rating', err);
	}

	// reset state and move to next
	pendingPrimary = null;
	resetPrimaryButtons();
	// lock input to prevent accidental clicks while we pause and transition
	lockRatingUI();
	nextVideo();
}


async function onRate(value) {
	const filename = videos[currentIndex];
	try {
		// Map binary choice to numeric rating to preserve DB schema: ai->1, real->5
		let ratingToSend = value;
		if (value === 'ai') ratingToSend = 1;
		if (value === 'real') ratingToSend = 5;
		await fetch("/api/rate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ videoId: filename, rating: ratingToSend, userId: currentUserId }),
		});
	} catch (err) {
		console.error("Failed to send rating", err);
	}

	nextVideo();
}

function nextVideo() {
	currentIndex++;
	// keep the last-frame / black gap visible briefly so the user has a small pause
	// before the next video appears
	if (currentIndex >= videos.length) {
		showDone();
		return;
	}

	setTimeout(() => {
		try { videoEl.style.opacity = '1'; } catch (e) {}
		// unlock inputs shortly before/after the new video appears
		unlockRatingUI();
		loadCurrent();
	}, 500);
}

function showThanks() {
	playerCard.classList.add("hidden");
	thanksScreen.classList.remove("hidden");
}

// Desktop version of mobile's showDone: hide player, disable rating buttons and show thanks

function showDone(){
  card.classList.add('hidden');
  leftBtn.disabled = true; rightBtn.disabled = true;
  doneEl.classList.remove('hidden');
}


function reset() {
	currentIndex = 0;
	thanksScreen.classList.add("hidden");
	playerCard.classList.remove("hidden");
	loadCurrent();
}

function loadCurrent() {
	const filename = videos[currentIndex];
	if (!filename) return;
	// title is intentionally hidden in CSS; no visible filename shown
	// ensure video element is visible and ready when loading a new file
	try { videoEl.style.visibility = 'visible'; videoEl.style.display = ''; } catch (e) {}
	// filename may include subfolders; use encodeURI so slashes are preserved
	videoEl.src = `videos/${encodeURI(filename)}`;
	// ensure user cannot control playback via native controls
	videoEl.controls = false;
	// do not loop: when video ends, leave it on the last frame
	videoEl.loop = false;
	// start playback programmatically
	videoEl.play().catch(() => {});
}

async function start() {
	await fetchVideos();
	if (!videos || videos.length === 0) {
		titleEl.textContent = "Brak dostępnych filmów w katalogu /videos";
		return;
	}
	buildRatingButtons();
	loadCurrent();
}

// Start button: hide start screen, show player, begin test
startBtn.addEventListener("click", async () => {
	// remove the entire start screen from DOM so it won't be shown again
	try { startScreen.remove(); } catch (e) {}
	playerCard.classList.remove("hidden");
	await start();
});

// if user wants to return to start from thanks screen, reload the page
if (restartBtn) {
	restartBtn.addEventListener("click", () => {
		try { videoEl.pause(); } catch (e) {}
		videoEl.src = "";
		currentIndex = 0;
		thanksScreen.classList.add("hidden");
		playerCard.classList.add("hidden");
		// reload to restore start screen
		window.location.reload();
	});
}

// If video ends without rating (we loop), provide a fallback: after many loops advance automatically
// Prevent user from pausing, seeking or using context menu / keyboard shortcuts
//let lastSafeTime = 0;
//videoEl.addEventListener("timeupdate", () => {
	// track the last safe playback time so we can prevent seeking
//	if (!isNaN(videoEl.currentTime)) lastSafeTime = videoEl.currentTime;
//});

videoEl.addEventListener("seeking", () => {
	// revert any user attempt to seek back to the last known time
	try {
		if (Math.abs(videoEl.currentTime - lastSafeTime) > 0.1) {
			videoEl.currentTime = lastSafeTime;
		}
	} catch (e) {
		// ignore
	}
});

///videoEl.addEventListener("pause", () => {
	// if the video was paused before it ended, resume playback
	//if (!videoEl.ended) {
//		videoEl.play().catch(() => {});
//	}
//});

videoEl.addEventListener("contextmenu", (e) => e.preventDefault());
videoEl.addEventListener("dblclick", (e) => e.preventDefault());

// When playback finishes, fade to black and pause. Keep paused until user rates.
videoEl.addEventListener('ended', () => {
	try {
		videoEl.pause();
		videoEl.style.opacity = '0';
	} catch (e) { }
	try {
		videoEl.style.transition = 'opacity 240ms ease';
	} catch (e) {}
	// ensure rating buttons are visible after a short delay if user didn't interact
	setTimeout(() => {
		try {
			if (!pendingPrimary) resetPrimaryButtons();
		} catch (e) {}
	}, RATING_SHOW_DELAY);
});

// block common keys that can control playback (space, arrow keys, media keys)
window.addEventListener("keydown", (e) => {
	const blocked = [" ", "Spacebar", "ArrowLeft", "ArrowRight", "MediaPlayPause", "k", "K"];
	if (blocked.includes(e.key)) {
		e.preventDefault();
		e.stopPropagation();
	}
});

start();
