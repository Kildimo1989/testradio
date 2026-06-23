const NATIVE_IRISH_STATIONS = [
  { 
    id: "rte-1", 
    name: "RTÉ Radio 1", 
    stream: "https://ie-live-mp3-128.vcdn.space/rte-radio1", 
    logo: "https://www.rte.ie/assets/static/images/logo-rte-radio1.png", 
    genre: "Talk / News" 
  },
  { 
    id: "rte-2fm", 
    name: "RTÉ 2FM", 
    stream: "https://ie-live-mp3-128.vcdn.space/rte-2fm", 
    logo: "https://www.rte.ie/assets/static/images/logo-rte-2fm.png", 
    genre: "Pop / Chart" 
  },
  { 
    id: "rte-lyric", 
    name: "RTÉ Lyric FM", 
    stream: "https://ie-live-mp3-128.vcdn.space/rte-lyricfm", 
    logo: "https://www.rte.ie/assets/static/images/logo-rte-lyric.png", 
    genre: "Classical / Arts" 
  },
  { 
    id: "rte-raidio-na-gaeltachta", 
    name: "RTÉ RnaG", 
    stream: "https://ie-live-mp3-128.vcdn.space/rte-rnag", 
    logo: "https://www.rte.ie/assets/static/images/logo-rte-rnag.png", 
    genre: "Irish Language" 
  },
  { 
    id: "today-fm", 
    name: "Today FM", 
    stream: "https://stream.audioxi.com/TFM", 
    logo: "https://www.todayfm.com/assets/images/logo.png", 
    genre: "Rock / Indie" 
  },
  { 
    id: "newstalk", 
    name: "Newstalk", 
    stream: "https://stream.audioxi.com/NT", 
    logo: "https://www.newstalk.com/assets/images/logo.png", 
    genre: "National Talk" 
  },
  { 
    id: "spin-1038", 
    name: "SPIN 1038", 
    stream: "https://stream.audioxi.com/SPIN", 
    logo: "https://www.spin1038.com/assets/images/logo.png", 
    genre: "Urban Hits" 
  },
  { 
    id: "spin-southwest", 
    name: "SPIN South West", 
    stream: "https://stream.audioxi.com/SSW", 
    logo: "https://www.spinsouthwest.com/assets/images/logo.png", 
    genre: "Urban Hits" 
  },
  { 
    id: "98fm", 
    name: "98FM", 
    stream: "https://stream.audioxi.com/98", 
    logo: "https://www.98fm.com/assets/images/logo.png", 
    genre: "Dublin Hits" 
  },
  { 
    id: "fm104", 
    name: "FM104", 
    stream: "https://wms.sharp-stream.com/live/fm104.mp3", 
    logo: "https://www.fm104.ie/assets/images/logo.png", 
    genre: "Dublin Chart" 
  },
  { 
    id: "q102", 
    name: "Dublin's Q102", 
    stream: "https://wms.sharp-stream.com/live/q102.mp3", 
    logo: "https://www.q102.ie/assets/images/logo.png", 
    genre: "Classic Hits" 
  },
  { 
    id: "classic-hits", 
    name: "Ireland's Classic Hits", 
    stream: "https://stream.classichits.ie/live/mp3/icecast.audio", 
    logo: "https://www.classichits.ie/assets/images/logo.png", 
    genre: "80s / 90s / 00s" 
  },
  { 
    id: "radio-nova", 
    name: "Radio Nova", 
    stream: "https://stream.radionova.ie/live/mp3/icecast.audio", 
    logo: "https://www.nova.ie/assets/images/logo.png", 
    genre: "Guitar Rock" 
  },
  { 
    id: "corks-96fm", 
    name: "Cork's 96FM", 
    stream: "https://wms.sharp-stream.com/live/96fm.mp3", 
    logo: "https://www.96fm.ie/assets/images/logo.png", 
    genre: "Cork Adult Pop" 
  },
  { 
    id: "corks-redfm", 
    name: "Cork's RedFM", 
    stream: "https://wms.sharp-stream.com/live/redfm.mp3", 
    logo: "https://www.redfm.ie/assets/images/logo.png", 
    genre: "Cork Pop / Chat" 
  }
];

class AudioPipelineManager {
  constructor() {
    this.audioElement = new Audio();
    this.activeStation = null;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.playbackSeconds = 0;
    this.timerInterval = null;
    this.stations = [];
    this.editingTargetId = null;
    this.isAddingNew = false;

    this.initAudioListeners();
    this.loadStateEngine();
    this.registerServiceWorker();
  }

  loadStateEngine() {
    const localStore = localStorage.getItem('radio_wave_stations');
    if (localStore) {
      this.stations = JSON.parse(localStore);
    } else {
      this.stations = [...NATIVE_IRISH_STATIONS];
      localStorage.setItem('radio_wave_stations', JSON.stringify(this.stations));
    }
    this.renderGrids();
  }

  initAudioListeners() {
    this.audioElement.preload = "none";

    this.audioElement.addEventListener('playing', () => {
      this.clearRecoveryLoops();
      document.getElementById('status-dot').className = "status-dot live";
      document.getElementById('status-text').innerText = "Live";
      document.getElementById('scrub-fill').style.background = "#4cd964";
      document.getElementById('vinyl-disc').classList.add('spinning');
      document.getElementById('master-play-btn').innerText = "‖";
      this.startDurationCounter();
      this.updateNativeMediaSession();
    });

    this.audioElement.addEventListener('waiting', () => {
      document.getElementById('status-dot').className = "status-dot buffering";
      document.getElementById('status-text').innerText = "Buffering...";
      document.getElementById('scrub-fill').style.background = "#ffcc00";
    });

    this.audioElement.addEventListener('error', () => this.triggerAutoReconnect());
    this.audioElement.addEventListener('stalled', () => this.triggerAutoReconnect());

    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => this.resumeTrack());
      navigator.mediaSession.setActionHandler('pause', () => this.pauseTrack());
    }
  }

  renderGrids() {
    const savedGrid = document.getElementById('saved-grid');
    const allGrid = document.getElementById('all-grid');
    savedGrid.innerHTML = "";
    allGrid.innerHTML = "";

    this.stations.forEach((station, index) => {
      const card = document.createElement('div');
      card.className = "station-card";
      card.innerHTML = `
        <div class="edit-badge" onclick="event.stopPropagation(); window.app.openEditModal('${station.id}')">✏️</div>
        <div class="station-logo-wrapper">
          <img src="${station.logo}" onerror="this.src='icon.png'">
        </div>
        <div class="station-name">${station.name}</div>
        <div class="station-meta">${station.genre || 'Irish'}</div>
      `;
      card.onclick = () => this.launchPlayerView(station);

      if (index < 2) {
        savedGrid.appendChild(card);
      } else {
        allGrid.appendChild(card);
      }
    });
  }

  launchPlayerView(station) {
    this.activeStation = station;
    document.getElementById('home-view').style.display = "none";
    const pView = document.getElementById('player-view');
    pView.style.display = "flex";

    document.getElementById('player-station-name').innerText = station.name;
    document.getElementById('player-center-logo').src = station.logo;
    document.getElementById('player-center-logo').onerror = function() { this.src = 'icon.png'; };
    document.getElementById('player-edit-shortcut').onclick = () => this.openEditModal(station.id);
    
    this.resetTimerMetrics();
    
    this.audioElement.src = station.stream;
    this.audioElement.load();
    
    document.getElementById('status-dot').className = "status-dot";
    document.getElementById('status-text').innerText = "Tap Play to Start";
    document.getElementById('vinyl-disc').classList.remove('spinning');
    document.getElementById('master-play-btn').innerText = "▶";
  }

  triggerAutoReconnect() {
    if (this.reconnectTimer || !this.activeStation) return;
    
    document.getElementById('status-dot').className = "status-dot error";
    document.getElementById('status-text').innerText = "Reconnect looping...";
    document.getElementById('vinyl-disc').classList.remove('spinning');
    document.getElementById('scrub-fill').style.background = "#ff3b30";

    this.reconnectTimer = setInterval(() => {
      this.reconnectAttempts++;
      if (this.reconnectAttempts > 5) {
        this.clearRecoveryLoops();
        document.getElementById('status-text').innerText = "Offline - Link Dead";
        return;
      }
      this.audioElement.src = this.activeStation.stream;
      this.audioElement.load();
      this.audioElement.play().catch(() => {});
    }, 5000);
  }

  clearRecoveryLoops() {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
  }

  togglePlayback() {
    if (this.audioElement.paused) {
      this.resumeTrack();
    } else {
      this.pauseTrack();
    }
  }

  resumeTrack() {
    this.audioElement.play().catch(err => console.log("Playback error:", err));
  }

  pauseTrack() {
    this.audioElement.pause();
    document.getElementById('vinyl-disc').classList.remove('spinning');
    document.getElementById('master-play-btn').innerText = "▶";
    clearInterval(this.timerInterval);
  }

  startDurationCounter() {
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.playbackSeconds++;
      const hrs = String(Math.floor(this.playbackSeconds / 3600)).padStart(2, '0');
      const mins = String(Math.floor((this.playbackSeconds % 3600) / 60)).padStart(2, '0');
      const secs = String(this.playbackSeconds % 60).padStart(2, '0');
      document.getElementById('playback-timer').innerText = `${hrs}:${mins}:${secs}`;
    }, 1000);
  }

  resetTimerMetrics() {
    clearInterval(this.timerInterval);
    this.playbackSeconds = 0;
    document.getElementById('playback-timer').innerText = "00:00:00";
  }

  updateNativeMediaSession() {
    if ('mediaSession' in navigator && this.activeStation) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.activeStation.name,
        artist: "Live Broadcast",
        album: "Radio Wave Network",
        artwork: [{ src: this.activeStation.logo, sizes: '512x512', type: 'image/png' }]
      });
    }
  }

  openEditModal(id) {
    this.isAddingNew = false;
    this.editingTargetId = id;
    const target = this.stations.find(st => st.id === id);
    if (!target) return;

    document.getElementById('modal-title').innerText = "Edit Station Configurations";
    document.getElementById('edit-name').value = target.name;
    document.getElementById('edit-stream').value = target.stream;
    document.getElementById('edit-logo').value = target.logo;
    document.getElementById('edit-modal').style.display = "flex";
  }

  openAddModal() {
    this.isAddingNew = true;
    document.getElementById('modal-title').innerText = "Add Custom Station";
    document.getElementById('edit-name').value = "";
    document.getElementById('edit-stream').value = "";
    document.getElementById('edit-logo').value = "";
    document.getElementById('edit-modal').style.display = "flex";
  }

  saveStationEdits() {
    const updatedName = document.getElementById('edit-name').value;
    const updatedStream = document.getElementById('edit-stream').value;
    const updatedLogo = document.getElementById('edit-logo').value || 'icon.png';

    if (!updatedName || !updatedStream) {
      alert("Name and Stream URL are completely required.");
      return;
    }

    if (this.isAddingNew) {
      const newId = "custom-" + Date.now();
      this.stations.push({ id: newId, name: updatedName, stream: updatedStream, logo: updatedLogo, genre: "User Station" });
    } else {
      this.stations = this.stations.map(st => {
        if (st.id === this.editingTargetId) {
          return { ...st, name: updatedName, stream: updatedStream, logo: updatedLogo };
        }
        return st;
      });
    }

    localStorage.setItem('radio_wave_stations', JSON.stringify(this.stations));
    this.renderGrids();
    
    if (!this.isAddingNew && this.activeStation && this.activeStation.id === this.editingTargetId) {
      this.activeStation = this.stations.find(st => st.id === this.editingTargetId);
      document.getElementById('player-station-name').innerText = this.activeStation.name;
      document.getElementById('player-center-logo').src = this.activeStation.logo;
      
      this.audioElement.src = this.activeStation.stream;
      this.audioElement.load();
    }
    
    this.closeModal();
  }

  closeModal() {
    document.getElementById('edit-modal').style.display = "none";
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(err => console.log(err));
    }
  }
}

function closePlayer() {
  document.getElementById('player-view').style.display = "none";
  document.getElementById('home-view').style.display = "block";
}

function closeModal() { window.app.closeModal(); }
function saveStationEdits() { window.app.saveStationEdits(); }
function togglePlayback() { window.app.togglePlayback(); }

window.addEventListener('DOMContentLoaded', () => {
  window.app = new AudioPipelineManager();
});
