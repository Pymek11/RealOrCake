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
	aiBtn.addEventListener("click", () => onRate('ai'));
	ratingButtonsRow.appendChild(aiBtn);

	const realBtn = document.createElement("button");
	realBtn.className = "rate-btn rate-real";
	realBtn.textContent = "REAL";
	realBtn.addEventListener("click", () => onRate('real'));
	ratingButtonsRow.appendChild(realBtn);
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
	videoEl.style.opacity = '1';
	if (currentIndex >= videos.length) {
		showDone();
		return;
	}

	loadCurrent();
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
