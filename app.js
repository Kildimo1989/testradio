const NATIVE_IRISH_STATIONS = [
  { id: "rte-1", name: "RTÉ Radio 1", stream: "https://edge.audio.lwr.rte.ie/lrn/live/radio1/playlist.m3u8", logo: "https://www.rte.ie/assets/static/images/logo-rte-radio1.png", genre: "Talk / News" },
  { id: "rte-2fm", name: "RTÉ 2FM", stream: "https://edge.audio.lwr.rte.ie/lrn/live/2fm/playlist.m3u8", logo: "https://www.rte.ie/assets/static/images/logo-rte-2fm.png", genre: "Pop / Chart" },
  { id: "today-fm", name: "Today FM", stream: "https://stream.revma.ihrhls.com/zc3393", logo: "https://www.todayfm.com/assets/images/logo.png", genre: "Rock / Indie" },
  { id: "newstalk", name: "Newstalk", stream: "https://stream.revma.ihrhls.com/zc3389", logo: "https://www.newstalk.com/assets/images/logo.png", genre: "National Talk" },
  { id: "spin-1038", name: "SPIN 1038", stream: "https://stream.revma.ihrhls.com/zc3391", logo: "https://www.spin1038.com/assets/images/logo.png", genre: "Urban Hits" }
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
    this.connectToStreamSource(station.stream);
  }

  connectToStreamSource(url) {
    this.audioElement.src = url;
    this.audioElement.load();
    this.audioElement.play().catch(() => {
      document.getElementById('status-dot').className = "status-dot error";
      document.getElementById('status-text').innerText = "Tap Play to Start";
    });
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
    this.audioElement.play();
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
      this.connectToStreamSource(this.activeStation.stream);
    }
    
    this.closeModal();
  }

  closeModal() {
    document.getElementById('edit-modal').style.display = "none";
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(err => console.log(err));
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