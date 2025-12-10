const videoEl = document.getElementById("video");
const ratingButtonsRow = document.getElementById("rating-buttons");
const thanksScreen = document.getElementById("thanks-screen");
const playerCard = document.getElementById("player-card");
const startScreen = document.getElementById("start-screen");
const practiceScreen = document.getElementById("practice-screen");
const practiceCardDiv = document.querySelector(".practice-card");
const practiceVideoEl = document.getElementById("practice-video");
const practiceRatingButtonsRow = document.getElementById("practice-rating-buttons");
const practicePlayerDiv = document.getElementById("practice-player");
const practiceBtnEl = document.getElementById("practice-btn");
const practiceStartBtnEl = document.getElementById("practice-start-btn");
const practiceVideoSectionEl = document.getElementById("practice-video-section");

const consentCheckbox = document.getElementById('consent-checkbox');
if (consentCheckbox) {
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


const NUM_TEST_VIDEOS = 20;
const LAST_VIDEO_FILENAME = 'VideoLast_Ai.mp4';
const LAST_VIDEO_DIR = 'video_last_test'; 

// Create or retrieve user UUID
async function createUser(){
	try{
		const urlParams = new URLSearchParams(window.location.search);
		const uuidFromUrl = urlParams.get('UUID');
		
		const storedUUID = localStorage.getItem('roc_uuid');

		if (uuidFromUrl) {
			currentUUID = uuidFromUrl;
			localStorage.setItem('roc_uuid', uuidFromUrl);
		} else if (storedUUID) {
			currentUUID = storedUUID;
		} else {
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

// Fetch video list from server
async function fetchVideos() {
	try {
		const res = await fetch("/api/videos");
		if (!res.ok) throw new Error("Failed to load videos");
		const all = await res.json();
		await preparePlaylist(all);
	} catch (err) {
		console.error(err);
		videos = [];
	}
}

// Fetch practice videos from server
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

// Build rating buttons
function buildRatingButtons() {
    ratingButtonsRow.innerHTML = "";
    
    const aiLabel = document.createElement('span');
    aiLabel.textContent = 'AI';
    aiLabel.style.fontWeight = 'bold';
    aiLabel.style.marginRight = '10px';
    ratingButtonsRow.appendChild(aiLabel);
    
    const percentages = ['0%', '25%', '50%', '75%', '100%'];
    
    for (let i = 1; i <= 5; i++) {
        const b = document.createElement('button');
        b.className = 'rate-btn scale-btn';
        b.textContent = percentages[i - 1];
        b.addEventListener('click', () => { if (!ratingLocked) submitRating(i, false); });
        ratingButtonsRow.appendChild(b);
    }
    
    const realLabel = document.createElement('span');
    realLabel.textContent = 'REAL';
    realLabel.style.fontWeight = 'bold';
    realLabel.style.marginLeft = '10px';
    ratingButtonsRow.appendChild(realLabel);
}

// Build practice rating buttons
function buildPracticeRatingButtons() {
    practiceRatingButtonsRow.innerHTML = "";
    
    const aiLabel = document.createElement('span');
    aiLabel.textContent = 'AI';
    aiLabel.style.fontWeight = 'bold';
    aiLabel.style.marginRight = '10px';
    practiceRatingButtonsRow.appendChild(aiLabel);
    
    const percentages = ['0%', '25%', '50%', '75%', '100%'];
    
    for (let i = 1; i <= 5; i++) {
        const b = document.createElement('button');
        b.className = 'rate-btn scale-btn';
        b.textContent = percentages[i - 1];
        b.addEventListener('click', () => { if (!ratingLocked) submitRating(i, true); });
        practiceRatingButtonsRow.appendChild(b);
    }
    
    const realLabel = document.createElement('span');
    realLabel.textContent = 'REAL';
    realLabel.style.fontWeight = 'bold';
    realLabel.style.marginLeft = '10px';
    practiceRatingButtonsRow.appendChild(realLabel);
}

// Submit rating to server
async function submitRating(value, isPractice) {
	const item = !isPractice ? videos[currentIndex] : null;
	const videoPath = isPractice ? (practiceVideos[0] || null) : (item ? `${item.dir}/${item.filename}` : null);
	const currentResolution = `${window.innerWidth}x${window.innerHeight}`;
	try {
		console.log('Sending rating ->', { video: videoPath, uuid: currentUUID, rating: value, isPractice });
		
		if (!isPractice) {
			const videoName = videoPath ? videoPath.split('/').pop() : null;
            const payload = { videoId: videoName, rating: value, uuid: currentUUID, resolution: currentResolution };
			if (item && item.isFinal) payload.final = true;
			await fetch('/api/rate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
		}
	} catch (err) {
		console.error('Failed to send rating', err);
	}

	if (isPractice) {
		practiceRatingButtonsRow.style.display = 'none';
		setTimeout(() => {
			continuToTest();
		}, 1000);
		return;
	}
	
	ratingButtonsRow.style.display = 'none';
	
	currentIndex++;
	if (currentIndex >= videos.length) {
		showThanks();
		return;
	}
	setTimeout(() => {
		try { videoEl.style.opacity = '1'; } catch (e) {}
		ratingButtonsRow.style.display = 'flex';
		loadCurrent();
	}, RATING_SHOW_DELAY);
}

// Show thank you screen
function showThanks() {
	playerCard.classList.add("hidden");
	thanksScreen.classList.remove("hidden");
}

// Shuffle array utility
function shuffleArray(a) {
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
}

// Check if file exists on server
async function checkFileExists(filePath) {
  try {
    const [dir, filename] = filePath.split('/');
    const res = await fetch(`/api/stream/${dir}/${encodeURI(filename)}`, { method: 'HEAD' });
    return res.ok;
  } catch (e) {
    console.error('File check failed:', e);
    return false;
  }
}

// Prepare playlist with random videos and final clip
async function preparePlaylist(allVideos) {
	let pool = Array.isArray(allVideos) ? allVideos.slice() : [];
	pool = pool.filter(f => f !== LAST_VIDEO_FILENAME);
	shuffleArray(pool);
	const count = Math.min(NUM_TEST_VIDEOS, pool.length);
	const selected = pool.slice(0, count);
	videos = selected.map(f => ({ filename: f, dir: 'videos', isFinal: false }));
	const finalUrl = `${LAST_VIDEO_DIR}/${encodeURI(LAST_VIDEO_FILENAME)}`;
	if (await checkFileExists(finalUrl)) {
		videos.push({ filename: LAST_VIDEO_FILENAME, dir: LAST_VIDEO_DIR, isFinal: true });
		console.log('Appended final video:', `${LAST_VIDEO_DIR}/${LAST_VIDEO_FILENAME}`);
	} else {
		console.log('Final video not found, skipping append:', finalUrl);
	}
}

// Load current video
function loadCurrent() {
	const item = videos[currentIndex];
	if (!item) return;
	const filename = item.filename;
	if (!filename) return;
	try { videoEl.style.visibility = 'visible'; videoEl.style.display = ''; } catch (e) {}
	videoEl.src = `/api/stream/${item.dir}/${encodeURI(filename)}`;
	videoEl.controls = false;
	videoEl.loop = false;
	
	if (item.isFinal) {
		ratingButtonsRow.style.display = 'flex';
		ratingLocked = false;
		videoEl.onended = () => {
		};
		videoEl.play().catch(() => {});
		return;
	}
	
	ratingButtonsRow.style.display = 'flex';
	ratingLocked = false;
	
	videoEl.onended = () => {
	};
	
	videoEl.play().catch(() => {});
}

// Load practice video
function loadPracticeVideo() {
	if (!practiceVideos || practiceVideos.length === 0) return;
	const filename = practiceVideos[0];
	try { practiceVideoEl.style.visibility = 'visible'; practiceVideoEl.style.display = ''; } catch (e) {}
	practiceVideoEl.src = `/api/stream/video_test/${encodeURI(filename)}`;
	practiceVideoEl.controls = false;
	practiceVideoEl.loop = false;

	practiceRatingButtonsRow.style.display = 'none';
	ratingLocked = true;
	
	practiceVideoEl.onended = () => {
        setTimeout(() => {
            practiceRatingButtonsRow.style.display = 'flex';
            ratingLocked = false;
        }, RATING_SHOW_DELAY);
    };
	
	practiceVideoEl.play().catch(() => {});
}

// Handle practice button click
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
	
	buildPracticeRatingButtons();
});

// Handle practice start button click
practiceStartBtnEl?.addEventListener("click", () => {
	practiceStartBtnEl.style.display = "none";
	practiceVideoSectionEl.style.display = "block";
	loadPracticeVideo();
});

// Handle practice video ended event
practiceVideoEl?.addEventListener('ended', () => {
	try { practiceVideoEl.style.opacity = '0'; } catch (e) {}
	try { practiceVideoEl.style.transition = 'opacity 240ms ease'; } catch (e) {}
});

// Continue to main test after practice
function continuToTest() {
	practiceScreen.remove();
	
	const transitionScreen = document.getElementById("transition-screen");
	transitionScreen.classList.remove("hidden");
	
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

// Prevent seeking
videoEl.addEventListener("seeking", (e) => {
    e.preventDefault();
    videoEl.currentTime = 0;
});

// Prevent seeking in practice video
practiceVideoEl.addEventListener("seeking", (e) => {
    e.preventDefault();
    practiceVideoEl.currentTime = 0;
});

// Handle video ended event
videoEl.addEventListener('ended', () => {
	try {
		videoEl.pause();
		videoEl.style.opacity = '0';
	} catch (e) { }
	try {
		videoEl.style.transition = 'opacity 240ms ease';
	} catch (e) {}
});

// Block certain key actions
window.addEventListener("keydown", (e) => {
	const blocked = [" ", "Spacebar", "ArrowLeft", "ArrowRight", "MediaPlayPause", "k", "K"];
	if (blocked.includes(e.key)) {
		e.preventDefault();
		e.stopPropagation();
	}
});
