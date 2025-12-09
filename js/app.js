const videoEl = document.getElementById("video");
const titleEl = document.getElementById("video-title");
const ratingButtonsRow = document.getElementById("rating-buttons");
const thanksScreen = document.getElementById("thanks-screen");
const playerCard = document.getElementById("player-card");
const startScreen = document.getElementById("start-screen");
const practiceScreen = document.getElementById("practice-screen");
const practiceCardDiv = document.querySelector(".practice-card");
const practiceVideoEl = document.getElementById("practice-video");
const practiceTitleEl = document.getElementById("practice-video-title");
const practiceRatingButtonsRow = document.getElementById("practice-rating-buttons");
const practicePlayerDiv = document.getElementById("practice-player");
const practiceBtnEl = document.getElementById("practice-btn");
const practiceStartBtnEl = document.getElementById("practice-start-btn");
const practiceVideoSectionEl = document.getElementById("practice-video-section");

// Checkbox zgody — odblokowuje przycisk startu
const consentCheckbox = document.getElementById('consent-checkbox');
if (consentCheckbox) {
	// Ustaw stan przycisku zgodnie z checkboxem przy ładowaniu
	try { practiceBtnEl.disabled = !consentCheckbox.checked; } catch (e) {}
	consentCheckbox.addEventListener('change', () => {
		try { practiceBtnEl.disabled = !consentCheckbox.checked; } catch (e) {}
	});
}

let videos = [];
let practiceVideos = [];
let currentIndex = 0;
let isTestPhase = false;
const RATING_SHOW_DELAY = 500;
let ratingLocked = false;
let currentUUID = null;

async function createUser(){
	try{
		// Check if UUID is in URL
		const urlParams = new URLSearchParams(window.location.search);
		const uuidFromUrl = urlParams.get('UUID');
		
		const storedUUID = localStorage.getItem('roc_uuid');

		// If UUID in URL, use that; otherwise use stored UUID; otherwise generate new
		if (uuidFromUrl) {
			currentUUID = uuidFromUrl;
			localStorage.setItem('roc_uuid', uuidFromUrl);
		} else if (storedUUID) {
			currentUUID = storedUUID;
		} else {
			// Generate new UUID
			const res = await fetch('/api/user',{method:'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({})});
			if(!res.ok) throw new Error('user create failed');
			const data = await res.json();
			currentUUID = data.uuid;
			localStorage.setItem('roc_uuid', currentUUID);
		}
		
		console.log(`UUID: ${currentUUID}`);
	}catch(e){
		console.warn('UUID creation failed:', e);
	}
}

function lockRatingUI() {
	ratingLocked = true;
	try {
		for (const b of ratingButtonsRow.querySelectorAll('button')) {
			b.disabled = true;
			b.hidden = true;
		}
	} catch (e) {}
}

function unlockRatingUI() {
	ratingLocked = false;
	try {
		for (const b of ratingButtonsRow.querySelectorAll('button')) {
			b.disabled = false;
			b.hidden = false;
		}
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

async function fetchPracticeVideos() {
	try {
		const res = await fetch("/api/practice-videos");
		if (!res.ok) throw new Error("Failed to load practice videos");
		practiceVideos = await res.json();
	} catch (err) {
		console.error(err);
		practiceVideos = [];
	}
}

function buildRatingButtons() {
	ratingButtonsRow.innerHTML = "";
	for (let i = 1; i <= 5; i++) {
		const b = document.createElement('button');
		b.className = 'rate-btn scale-btn';
		b.textContent = String(i);
		b.addEventListener('click', () => { if (!ratingLocked) submitRating(i, false); });
		if (ratingLocked) b.disabled = true;
		ratingButtonsRow.appendChild(b);
	}
}

function buildPracticeRatingButtons() {
	practiceRatingButtonsRow.innerHTML = "";
	for (let i = 1; i <= 5; i++) {
		const b = document.createElement('button');
		b.className = 'rate-btn scale-btn';
		b.textContent = String(i);
		b.addEventListener('click', () => { if (!ratingLocked) submitRating(i, true); });
		if (ratingLocked) b.disabled = true;
		practiceRatingButtonsRow.appendChild(b);
	}
}

async function submitRating(value, isPractice) {
	const filename = isPractice ? practiceVideos[0] : videos[currentIndex];
	try {
		console.log('Sending rating ->', { video: filename, uuid: currentUUID, rating: value, isPractice });
		
		// Nie zapisuj practice testów
		if (!isPractice) {
			await fetch('/api/rate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ videoId: filename, rating: value, uuid: currentUUID }),
			});
		}
	} catch (err) {
		console.error('Failed to send rating', err);
	}

	lockRatingUI();
	
	// Jeśli to practice, przejdź do pełnego testu
	if (isPractice) {
		setTimeout(() => {
			continuToTest();
		}, 1000);
		return;
	}
	
	currentIndex++;
	if (currentIndex >= videos.length) {
		showThanks();
		return;
	}
	setTimeout(() => {
		try { videoEl.style.opacity = '1'; } catch (e) {}
		unlockRatingUI();
		loadCurrent();
	}, RATING_SHOW_DELAY);
}

function showThanks() {
	playerCard.classList.add("hidden");
	thanksScreen.classList.remove("hidden");
}

function loadCurrent() {
	const filename = videos[currentIndex];
	if (!filename) return;
	try { videoEl.style.visibility = 'visible'; videoEl.style.display = ''; } catch (e) {}
	videoEl.src = `videos/${encodeURI(filename)}`;
	videoEl.controls = false;
	videoEl.loop = false;
	titleEl.textContent = filename;
	
	// W prawdziwym badaniu przyciski oceny są zawsze widoczne
	ratingButtonsRow.style.display = 'flex';
	unlockRatingUI(); // Odblokuj przyciski
	ratingLocked = false;
	
	videoEl.onended = () => {
		// W prawdziwym badaniu nic się nie zmienia po skończeniu wideo
	};
	
	videoEl.play().catch(() => {});
}

function loadPracticeVideo() {
	if (!practiceVideos || practiceVideos.length === 0) return;
	const filename = practiceVideos[0];
	try { practiceVideoEl.style.visibility = 'visible'; practiceVideoEl.style.display = ''; } catch (e) {}
	practiceVideoEl.src = `video_test/${encodeURI(filename)}`;
	practiceVideoEl.controls = false;
	practiceVideoEl.loop = false;
	practiceTitleEl.textContent = filename;
	
	// Show rating buttons when video ends (after 5 seconds)
	practiceVideoEl.onended = () => {
		setTimeout(() => {
			practiceRatingButtonsRow.style.display = 'flex';
			ratingLocked = false;
		}, RATING_SHOW_DELAY);
	};
	
	practiceVideoEl.play().catch(() => {});
}

// Przycisk do testu praktycznego
practiceBtnEl?.addEventListener("click", async () => {
	try { startScreen.remove(); } catch (e) {}
	practiceScreen.classList.remove("hidden");
	practiceCardDiv.classList.add("show");
	practicePlayerDiv.classList.add("show");
	await createUser();
	await fetchPracticeVideos();
	
	if (!practiceVideos || practiceVideos.length === 0) {
		practiceTitleEl.textContent = "Brak dostępnych filmów w katalogu /video_test";
		return;
	}
	
	// Weź jeden losowy film do practice
	practiceVideos = [practiceVideos[Math.floor(Math.random() * practiceVideos.length)]];
	buildPracticeRatingButtons();
});

// Przycisk rozpoczęcia testu praktycznego
practiceStartBtnEl?.addEventListener("click", () => {
	practiceStartBtnEl.style.display = "none";
	practiceVideoSectionEl.style.display = "block";
	loadPracticeVideo();
});

// Event listener na koniec practice video
practiceVideoEl?.addEventListener('ended', () => {
	try { practiceVideoEl.style.opacity = '0'; } catch (e) {}
	try { practiceVideoEl.style.transition = 'opacity 240ms ease'; } catch (e) {}
});

// Przejście do pełnego testu po ocenie practice
function continuToTest() {
	practiceScreen.remove();
	
	// Pokaż ekran przejściowy
	const transitionScreen = document.getElementById("transition-screen");
	transitionScreen.classList.remove("hidden");
	
	// Po 3 sekundach przejdź do głównego testu
	setTimeout(async () => {
		await fetchVideos();
		transitionScreen.remove();
		playerCard.classList.remove("hidden");
		currentIndex = 0;
		isTestPhase = true;
		buildRatingButtons();
		loadCurrent();
	}, 3000);
}

videoEl.addEventListener("contextmenu", (e) => e.preventDefault());
videoEl.addEventListener("dblclick", (e) => e.preventDefault());

videoEl.addEventListener('ended', () => {
	try {
		videoEl.pause();
		videoEl.style.opacity = '0';
	} catch (e) { }
	try {
		videoEl.style.transition = 'opacity 240ms ease';
	} catch (e) {}
});

window.addEventListener("keydown", (e) => {
	const blocked = [" ", "Spacebar", "ArrowLeft", "ArrowRight", "MediaPlayPause", "k", "K"];
	if (blocked.includes(e.key)) {
		e.preventDefault();
		e.stopPropagation();
	}
});
