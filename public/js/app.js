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


const NUM_TEST_VIDEOS = 26;
const LAST_VIDEO_FILENAME = 'VideoLast_Ai.mp4';
const LAST_VIDEO_DIR = 'video_last_test'; 

function lockRatingUI() {
    ratingLocked = true;

    const mainContainer = document.getElementById('rating-container');
    const practiceContainer = document.getElementById('practice-rating-container');
    
    if (mainContainer) mainContainer.style.display = 'none';
    
    if (practiceContainer) practiceContainer.style.display = 'none';
}


function unlockRatingUI() {
    ratingLocked = false;

    const mainContainer = document.getElementById('rating-container');
    const practiceContainer = document.getElementById('practice-rating-container');

    // Pokaż główne
    if (mainContainer) mainContainer.style.display = 'flex';
    
    if (practiceContainer) practiceContainer.style.display = 'flex';
}
// Create or retrieve user UUID - Generated based on current timestamp, stored in session
async function createUser(){
	try{
		const urlParams = new URLSearchParams(window.location.search);
		const uuidFromUrl = urlParams.get('UUID');

		if (uuidFromUrl) {
			currentUUID = uuidFromUrl;
			sessionStorage.setItem('roc_uuid', uuidFromUrl);
		} else {
			// Check if UUID exists in session storage
			const storedUUID = sessionStorage.getItem('roc_uuid');
			if (storedUUID) {
				currentUUID = storedUUID;
			} else {
				// Generate UUID based on current timestamp with hash (resets on browser close)
				const timestamp = Date.now();
				const hash = await hashTimestamp(timestamp);
				currentUUID = hash;
				sessionStorage.setItem('roc_uuid', currentUUID);
			}
		}
		
		// Validate UUID with server
		const res = await fetch('/api/user',{method:'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({uuid: currentUUID})});
		if(!res.ok) throw new Error('user validation failed');
		const data = await res.json();
		currentUUID = data.uuid;
		console.log(`UUID: ${currentUUID}`);
	}catch(e){
		console.warn('UUID creation failed:', e);
	}
}

// Hash timestamp to create a deterministic UUID-like string
async function hashTimestamp(timestamp) {
	const encoder = new TextEncoder();
	const data = encoder.encode(timestamp.toString());
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
	// Format as UUID-like string (8-4-4-4-12)
	return hashHex.substring(0, 8) + '-' + 
	       hashHex.substring(8, 12) + '-' + 
	       hashHex.substring(12, 16) + '-' + 
	       hashHex.substring(16, 20) + '-' + 
	       hashHex.substring(20, 32);
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
	const ratingContainer = document.getElementById('rating-container');
	if (!ratingContainer) return;
    ratingContainer.innerHTML = "";
    ratingContainer.style.display = 'flex';
    ratingContainer.style.alignItems = 'center';
    ratingContainer.style.gap = '12px';
    
    // Add AI label
    const aiLabel = document.createElement('div');
    aiLabel.style.fontWeight = 'bold';
    aiLabel.style.fontSize = '14px';
    aiLabel.style.minWidth = '30px';
    aiLabel.textContent = 'Ai';
    ratingContainer.appendChild(aiLabel);
    
    // Create buttons wrapper
    const buttonsWrapper = document.createElement('div');
    buttonsWrapper.id = 'rating-buttons';
    buttonsWrapper.setAttribute('aria-label', 'rating buttons');
    
    const percentages = ['0%', '25%', '50%', '75%', '100%'];
    
    for (let i = 1; i <= 5; i++) {
        const b = document.createElement('button');
        b.className = 'rate-btn scale-btn';
        b.textContent = percentages[i - 1];
        b.addEventListener('click', () => { if (!ratingLocked) submitRating(i, false); });
        buttonsWrapper.appendChild(b);
    }
    
    ratingContainer.appendChild(buttonsWrapper);
    
    // Add REAL label
    const realLabel = document.createElement('div');
    realLabel.style.fontWeight = 'bold';
    realLabel.style.fontSize = '14px';
    realLabel.style.minWidth = '30px';
    realLabel.textContent = 'Real';
    ratingContainer.appendChild(realLabel);
}

// Build practice rating buttons
function buildPracticeRatingButtons() {
    const practiceRatingContainer = document.getElementById('practice-rating-container');
	if (!practiceRatingContainer) return;
    practiceRatingContainer.innerHTML = "";
    practiceRatingContainer.style.display = 'flex';
	practiceRatingContainer.style.alignItems = 'center';
	practiceRatingContainer.style.justifyContent = 'center';
    practiceRatingContainer.style.gap = '12px';
	practiceRatingContainer.style.marginTop = '12px';
    
    // Add AI label
    const aiLabel = document.createElement('div');
    aiLabel.style.fontWeight = 'bold';
    aiLabel.style.fontSize = '14px';
    aiLabel.style.minWidth = '30px';
    aiLabel.textContent = 'Ai';
    practiceRatingContainer.appendChild(aiLabel);
    
    // Create buttons wrapper
    const buttonsWrapper = document.createElement('div');
    buttonsWrapper.id = 'practice-rating-buttons';
    buttonsWrapper.setAttribute('aria-label', 'rating buttons');
    
    const percentages = ['0%', '25%', '50%', '75%', '100%'];
    
    for (let i = 1; i <= 5; i++) {
        const b = document.createElement('button');
        b.className = 'rate-btn scale-btn';
        b.textContent = percentages[i - 1];
        b.addEventListener('click', () => { if (!ratingLocked) submitRating(i, true); });
        buttonsWrapper.appendChild(b);
    }
    
    practiceRatingContainer.appendChild(buttonsWrapper);
    
    // Add REAL label
    const realLabel = document.createElement('div');
    realLabel.style.fontWeight = 'bold';
    realLabel.style.fontSize = '14px';
    realLabel.style.minWidth = '30px';
    realLabel.textContent = 'Real';
    practiceRatingContainer.appendChild(realLabel);
}

// Submit rating to server
async function submitRating(value, isPractice) {
	if (ratingLocked) return; 
    lockRatingUI();
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
	unlockRatingUI();
	const item = videos[currentIndex];
	if (!item) return;
	const filename = item.filename;
	if (!filename) return;
	try { videoEl.style.visibility = 'visible'; videoEl.style.display = ''; } catch (e) {}
	videoEl.src = `/api/stream/${item.dir}/${encodeURI(filename)}`;
	videoEl.controls = false;
	videoEl.loop = false;
	
	if (item.isFinal) {
		ratingLocked = false;
		videoEl.onended = () => {
		};
		videoEl.play().catch(() => {});
		return;
	}
		
	videoEl.onended = () => {
	};
	
	videoEl.play().catch(() => {});
}

// Load practice video
function loadPracticeVideo() {
	unlockRatingUI();
	if (!practiceVideos || practiceVideos.length === 0) return;
	const filename = practiceVideos[0];
	try { practiceVideoEl.style.visibility = 'visible'; practiceVideoEl.style.display = ''; } catch (e) {}
	practiceVideoEl.src = `/api/stream/video_test/${encodeURI(filename)}`;
	practiceVideoEl.controls = false;
	practiceVideoEl.loop = false;

	const practiceRatingRow = document.getElementById('practice-rating-row');

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
