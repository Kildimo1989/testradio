const NATIVE_IRISH_STATIONS = [
  { 
    id: "rte-1", 
    name: "RTÉ Radio 1", 
    stream: "https://edge.audio.rte.ie/rte1/audio/icecast.audio", 
    logo: "https://www.rte.ie/assets/static/images/logo-rte-radio1.png", 
    genre: "Talk / News" 
  },
  { 
    id: "rte-2fm", 
    name: "RTÉ 2FM", 
    stream: "https://edge.audio.rte.ie/2fm/audio/icecast.audio", 
    logo: "https://www.rte.ie/assets/static/images/logo-rte-2fm.png", 
    genre: "Pop / Chart" 
  },
  { 
    id: "rte-lyric", 
    name: "RTÉ Lyric FM", 
    stream: "https://edge.audio.rte.ie/lyric/audio/icecast.audio", 
    logo: "https://www.rte.ie/assets/static/images/logo-rte-lyric.png", 
    genre: "Classical / Arts" 
  },
  { 
    id: "rte-raidio-na-gaeltachta", 
    name: "RTÉ RnaG", 
    stream: "https://edge.audio.rte.ie/rnag/audio/icecast.audio", 
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
    id: "radio-nova", 
    name: "Radio Nova", 
    stream: "https://stream.radionova.ie/live/mp3/icecast.audio", 
    logo: "https://www.nova.ie/assets/images/logo.png", 
    genre: "Guitar Rock" 
  },
  { 
    id: "classic-hits", 
    name: "Ireland's Classic Hits", 
    stream: "https://stream.classichits.ie/live/mp3/icecast.audio", 
    logo: "https://www.classichits.ie/assets/images/logo.png", 
    genre: "80s / 90s / 00s" 
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

    this.initAudioListeners();
    this.loadStateEngine();
    this.registerServiceWorker();
  }

  loadStateEngine() {
    const localStore = localStorage.getItem('radio_wave_stations');
    if (localStore) {
      this.stations = JSON.parse(localStore);
      // Force refresh data if the local profile contains old references
      if (this.stations && this.stations.stream.includes('lwr.rte.ie')) {
        this.stations = [...NATIVE_IRISH_STATIONS];
        localStorage.setItem('radio_wave_stations', JSON.stringify(this.stations));
      }
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
    });

    this.audioElement.addEventListener('waiting', () => {
      document.getElementById('status-dot').className = "status-dot buffering";
      document.getElementById('status-text').innerText = "Buffering...";
      document.getElementById('scrub-fill').style.background = "#ffcc00";
    });

    this.audioElement.addEventListener('error', () => this.triggerAutoReconnect());
    this.audioElement.addEventListener('stalled', () => this.triggerAutoReconnect());
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
        <div class="station-logo-wrapper">
          <img src="${station.logo}" onerror="this.src='icon.png'">
        </div>
        <div class="station-name">${station.name}</div>
        <div class="station-meta">${station.genre || 'Irish'}</div>
      `;
      // User gesture directly starts audio here to comply with browser autoplay blocks
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
    document.getElementById('player-view').style.display = "flex";

    document.getElementById('player-station-name').innerText = station.name;
    document.getElementById('player-center-logo').src = station.logo;
    document.getElementById('player-center-logo').onerror = function() { this.src = 'icon.png'; };
    
    this.resetTimerMetrics();
    
    // Set parameters and fire auto-play directly inside user action scope
    this.audioElement.src = station.stream;
    this.audioElement.load();
    this.audioElement.play().catch(err => {
      console.log("Autoplay blocked:", err);
      document.getElementById('status-dot').className = "status-dot error";
      document.getElementById('status-text').innerText = "Tap Play to Start";
    });
  }

  triggerAutoReconnect() {
    if (this.reconnectTimer || !this.activeStation) return;
    
    document.getElementById('status-dot').className = "status-dot error";
    document.getElementById('status-text').innerText = "Reconnecting...";
    document.getElementById('vinyl-disc').classList.remove('spinning');

    this.reconnectTimer = setInterval(() => {
      this.reconnectAttempts++;
      if (this.reconnectAttempts > 5) {
        this.clearRecoveryLoops();
        document.getElementById('status-text').innerText = "Offline";
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
      this.audioElement.play().catch(err => console.log(err));
    } else {
      this.audioElement.pause();
      document.getElementById('vinyl-disc').classList.remove('spinning');
      document.getElementById('master-play-btn').innerText = "▶";
      clearInterval(this.timerInterval);
    }
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
function togglePlayback() { window.app.togglePlayback(); }

window.addEventListener('DOMContentLoaded', () => {
  window.app = new AudioPipelineManager();
});