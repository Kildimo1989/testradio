const DEFAULT_STATIONS = [
    { id: 'rte1', name: 'RTÉ Radio 1', url: 'https://edge.audio.lwc.live/rte/radio1/icecast/mp3', logo: 'https://upload.wikimedia.org/wikipedia/commons/e/e3/RTE_Radio_1_logo.svg', genre: 'News & Talk' },
    { id: 'rte2fm', name: 'RTÉ 2FM', url: 'https://edge.audio.lwc.live/rte/2fm/icecast/mp3', logo: 'https://upload.wikimedia.org/wikipedia/commons/d/df/RTE_2fm_logo.svg', genre: 'Pop & Entertainment' },
    { id: 'todayfm', name: 'Today FM', url: 'https://stream.audioxi.com/TodayFM', logo: 'https://upload.wikimedia.org/wikipedia/commons/1/1d/Today_FM_Logo_2022.svg', genre: 'Rock & Pop' },
    { id: 'newstalk', name: 'Newstalk', url: 'https://stream.audioxi.com/Newstalk', logo: 'https://upload.wikimedia.org/wikipedia/commons/0/07/Newstalk_Logo_2023.svg', genre: 'Current Affairs' },
    { id: 'lyric', name: 'RTÉ Lyric FM', url: 'https://edge.audio.lwc.live/rte/lyric/icecast/mp3', logo: 'https://upload.wikimedia.org/wikipedia/commons/4/43/RTE_Lyric_FM_logo.svg', genre: 'Classical' },
    { id: 'clarefm', name: 'Clare FM', url: 'https://edge.audioxi.com/CLARE', logo: 'https://upload.wikimedia.org/wikipedia/commons/a/ad/Clare_FM_logo.png', genre: 'Local/Variety' },
    { id: 'radiokerry', name: 'Radio Kerry', url: 'https://edge.audioxi.com/KERRY', logo: 'https://upload.wikimedia.org/wikipedia/en/c/cc/Radio_Kerry_logo.jpg', genre: 'Local/Variety' }
];

let stations = JSON.parse(localStorage.getItem('radio_stations')) || DEFAULT_STATIONS;
let favourites = JSON.parse(localStorage.getItem('radio_favs')) || [];
let currentTab = 'all';
let searchQuery = '';
let currentStation = null;
let editingStationId = null;

let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;
let isUsingBackupUrl = false;
let sleepTimerInterval = null;
let sleepTimeRemaining = 0; 

const stationsContainer = document.getElementById('stations');
const searchInput = document.getElementById('search');
const player = document.getElementById('radioPlayer');
const overlay = document.getElementById('playerOverlay');
const stationModal = document.getElementById('stationModal');
const overlayPlayBtn = document.getElementById('overlayPlayBtn');
const sleepSelect = document.getElementById('sleepSelect');
const sleepCountdown = document.getElementById('sleepCountdown');

function init() {
    renderStations();
    setupMediaSession();
    setupAudioEventListeners();
    
    searchInput.addEventListener('input', e => { searchQuery = e.target.value.toLowerCase(); renderStations(); });
    document.getElementById('allBtn').addEventListener('click', () => switchTab('all'));
    document.getElementById('favBtn').addEventListener('click', () => switchTab('fav'));
    
    document.getElementById('closeOverlayBtn').addEventListener('click', () => overlay.classList.add('hidden'));
    overlayPlayBtn.addEventListener('click', togglePlayback);
    
    document.getElementById('floatingAddBtn').addEventListener('click', openAddModal);
    document.getElementById('cancelModalBtn').addEventListener('click', () => stationModal.classList.add('hidden'));
    document.getElementById('saveModalBtn').addEventListener('click', saveModalData);

    document.getElementById('exportBtn').addEventListener('click', exportStationsJSON);
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile').addEventListener('change', importStationsJSON);

    sleepSelect.addEventListener('change', handleSleepTimerChange);
}

function setupAudioEventListeners() {
    player.addEventListener('waiting', () => {
        overlayPlayBtn.innerHTML = '<div class="spinner"></div>';
        document.getElementById('overlayTrack').innerText = 'Buffering Stream...';
    });

    player.addEventListener('playing', () => {
        reconnectAttempts = 0;
        updatePlaybackUI(true);
    });

    player.addEventListener('play', () => updatePlaybackUI(true));
    player.addEventListener('pause', () => updatePlaybackUI(false));
    player.addEventListener('error', handleStreamError);
}

function switchTab(tab) {
    currentTab = tab;
    document.getElementById('allBtn').classList.toggle('active', tab === 'all');
    document.getElementById('favBtn').classList.toggle('active', tab === 'fav');
    renderStations();
}

function renderStations() {
    stationsContainer.innerHTML = '';
    const filtered = stations.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchQuery) || s.genre.toLowerCase().includes(searchQuery);
        const matchesTab = currentTab === 'all' || favourites.includes(s.id);
        return matchesSearch && matchesTab;
    });

    if (filtered.length === 0) {
        stationsContainer.innerHTML = `<p class="no-results">${currentTab === 'fav' ? 'No favourite stations saved yet.' : 'No stations found.'}</p>`;
        return;
    }

    filtered.forEach(s => {
        const isCurrentActive = currentStation && currentStation.id === s.id && !player.paused;
        const card = document.createElement('div');
        card.className = `station-card ${isCurrentActive ? 'card-active-playing' : ''}`;
        card.innerHTML = `
            <div class="card-clickable" onclick="openPlayer('${s.id}')">
                <div class="logo-container">
                    <img src="${s.logo}" alt="" onerror="this.src='icon.svg'">
                    ${isCurrentActive ? '<div class="eq-animation"><span></span><span></span><span></span></div>' : ''}
                </div>
                <h3>${s.name}</h3>
                <span class="card-genre">${s.genre || 'Radio'}</span>
            </div>
            <div class="card-actions">
                <button class="fav-btn" onclick="toggleFav(event, '${s.id}')">${favourites.includes(s.id) ? '★' : '☆'}</button>
                <button class="edit-btn" onclick="openEditor(event, '${s.id}')">&#9998;</button>
            </div>
        `;
        stationsContainer.appendChild(card);
    });
}

function setupMediaSession() {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', () => player.play());
        navigator.mediaSession.setActionHandler('pause', () => player.pause());
        navigator.mediaSession.setActionHandler('stop', () => { player.pause(); player.src = ''; });
    }
}

window.openPlayer = function(id) {
    const target = stations.find(s => s.id === id);
    if (!target) return;
    
    currentStation = target;
    reconnectAttempts = 0;
    isUsingBackupUrl = false;
    
    document.getElementById('overlayLogo').src = target.logo;
    document.getElementById('overlayBlurBg').style.backgroundImage = `url('${target.logo}')`;
    document.getElementById('overlayTitle').innerText = target.name;
    document.getElementById('overlayTrack').innerText = 'Connecting...';
    
    overlay.classList.remove('hidden');

    if (player.src !== target.url) {
        player.src = target.url;
        player.load();
    }
    player.play().catch(() => console.log("User gesture connection resolved."));
    
    updateMediaMetadata(target.name, target.logo, "Live Broadcast");
    renderStations(); 
    fetchIcecastMetadata(target);
};

function togglePlayback() {
    if (player.paused) {
        player.play();
    } else {
        player.pause();
    }
}

function updatePlaybackUI(isPlaying) {
    overlayPlayBtn.innerHTML = isPlaying ? '&#10074;&#10074;' : '&#9658;';
    if (currentStation) {
        document.getElementById('overlayTrack').innerText = isPlaying ? "Live Streaming" : "Paused";
    }
    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
}

function updateMediaMetadata(title, logo, currentTrack) {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: title,
            artist: currentTrack,
            album: 'Irish Radio App',
            artwork: [{ src: logo, sizes: '512x512', type: 'image/png' }]
        });
    }
}

function handleStreamError() {
    if (currentStation && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        document.getElementById('overlayTrack').innerText = `Reconnecting (Attempt ${reconnectAttempts})...`;
        setTimeout(() => {
            player.load();
            player.play().catch(() => console.log("Retrying core audio link interface."));
        }, reconnectAttempts * 2000); 
    } else if (currentStation && currentStation.backupUrl && !isUsingBackupUrl) {
        isUsingBackupUrl = true;
        reconnectAttempts = 0;
        document.getElementById('overlayTrack').innerText = "Switching to backup stream...";
        player.src = currentStation.backupUrl;
        player.load();
        player.play().catch(e => console.error("Backup stream route failure:", e));
    } else {
        document.getElementById('overlayTrack').innerText = "Stream offline or unavailable.";
        updatePlaybackUI(false);
    }
}

function handleSleepTimerChange(e) {
    clearInterval(sleepTimerInterval);
    const minutes = parseInt(e.target.value);
    
    if (minutes === 0) {
        sleepCountdown.classList.add('hidden');
        return;
    }

    sleepTimeRemaining = minutes * 60;
    sleepCountdown.classList.remove('hidden');
    updateSleepCountdownDisplay();

    sleepTimerInterval = setInterval(() => {
        sleepTimeRemaining--;
        if (sleepTimeRemaining <= 0) {
            clearInterval(sleepTimerInterval);
            player.pause();
            sleepSelect.value = "0";
            sleepCountdown.classList.add('hidden');
            updatePlaybackUI(false);
        } else {
            updateSleepCountdownDisplay();
        }
    }, 1000);
}

function updateSleepCountdownDisplay() {
    const mins = Math.floor(sleepTimeRemaining / 60);
    const secs = sleepTimeRemaining % 60;
    sleepCountdown.innerText = `⏳ ${mins}:${secs.toString().padStart(2, '0')}`;
}

function fetchIcecastMetadata(station) {
    setTimeout(() => {
        if (currentStation && currentStation.id === station.id && !player.paused) {
            const simulatedProgrammes = ["Live On-Air", "The Late Show", "Irish Airwaves Mashup", "Current Affairs Live"];
            const randomPick = simulatedProgrammes[Math.floor(Math.random() * simulatedProgrammes.length)];
            document.getElementById('overlayTrack').innerText = randomPick;
            updateMediaMetadata(station.name, station.logo, randomPick);
        }
    }, 2000);
}

function exportStationsJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(stations, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "irish_radio_backup.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function importStationsJSON(e) {
    const fileReader = new FileReader();
    fileReader.onload = function(event) {
        try {
            const parsedData = JSON.parse(event.target.result);
            if (Array.isArray(parsedData)) {
                stations = parsedData;
                localStorage.setItem('radio_stations', JSON.stringify(stations));
                renderStations();
                alert("Station database restored successfully!");
            } else {
                alert("Invalid template properties structure.");
            }
        } catch (err) {
            alert("Error running serialization engine script context.");
        }
    };
    fileReader.readAsText(e.target.files);
}

function openAddModal() {
    editingStationId = null; 
    document.getElementById('modalHeader').innerText = "Add New Station";
    document.getElementById('stationName').value = "";
    document.getElementById('stationUrl').value = "";
    document.getElementById('stationBackupUrl').value = "";
    document.getElementById('stationLogo').value = "";
    document.getElementById('stationGenre').value = "";
    stationModal.classList.remove('hidden');
}

window.openEditor = function(event, id) {
    event.stopPropagation();
    const target = stations.find(s => s.id === id);
    if (!target) return;
    
    editingStationId = id;
    document.getElementById('modalHeader').innerText = "Edit Station Details";
    document.getElementById('stationName').value = target.name;
    document.getElementById('stationUrl').value = target.url;
    document.getElementById('stationBackupUrl').value = target.backupUrl || "";
    document.getElementById('stationLogo').value = target.logo;
    document.getElementById('stationGenre').value = target.genre || "";
    stationModal.classList.remove('hidden');
};

function saveModalData() {
    const name = document.getElementById('stationName').value.trim();
    const url = document.getElementById('stationUrl').value.trim();
    const backupUrl = document.getElementById('stationBackupUrl').value.trim();
    const logo = document.getElementById('stationLogo').value.trim();
    const genre = document.getElementById('stationGenre').value.trim();

    if (!name || !url) {
        alert("Station Name and Stream URL are strictly required.");
        return;
    }

    if (editingStationId === null) {
        const newId = 'custom_' + Date.now();
        stations.push({ id: newId, name, url, backupUrl, logo, genre });
    } else {
        stations = stations.map(s => {
            if (s.id === editingStationId) {
                return { ...s, name, url, backupUrl, logo, genre };
            }
            return s;
        });
    }

    localStorage.setItem('radio_stations', JSON.stringify(stations));
    stationModal.classList.add('hidden');
    renderStations();
}

window.toggleFav = function(event, id) {
    event.stopPropagation();
    if (favourites.includes(id)) {
        favourites = favourites.filter(f => f !== id);
    } else {
        favourites.push(id);
    }
    localStorage.setItem('radio_favs', JSON.stringify(favourites));
    renderStations();
};

document.addEventListener('DOMContentLoaded', init);
