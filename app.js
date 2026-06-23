const NATIVE_IRISH_STATIONS = [
  { 
    id: "rte-1", 
    name: "RTÉ Radio 1", 
    stream: "https://www.rte.ie/manifests/radio1.m3u8", 
    logo: "https://www.rte.ie/assets/static/images/logo-rte-radio1.png", 
    genre: "Talk / News" 
  },
  { 
    id: "rte-2fm", 
    name: "RTÉ 2FM", 
    stream: "https://www.rte.ie/manifests/2fm.m3u8", 
    logo: "https://www.rte.ie/assets/static/images/logo-rte-2fm.png", 
    genre: "Pop / Chart" 
  },
  { 
    id: "rte-lyric", 
    name: "RTÉ Lyric FM", 
    stream: "https://www.rte.ie/manifests/lyric.m3u8", 
    logo: "https://www.rte.ie/assets/static/images/logo-rte-lyric.png", 
    genre: "Classical / Arts" 
  },
  { 
    id: "rte-rnag", 
    name: "RTÉ RnaG", 
    stream: "https://www.rte.ie/manifests/rnag.m3u8", 
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
  }
];

class AudioPipelineManager {
  constructor() {
    this.audioElement = new Audio();
    this.hlsInstance = null;
    this.activeStation = null;
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
      // Fallback check if user profile stores dead links from prior runs
      if (this.stations[0] && !this.stations[0].stream.includes('manifests')) {
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
    this.audioElement.addEventListener('playing', () => {
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
      card.onclick = () => this.launchPlayerView(station);

      if (index < 2) { savedGrid.appendChild(card); } 
      else { allGrid.appendChild(card); }
    });
  }

  launchPlayerView(station) {
    this.activeStation = station;
    document.getElementById('home-view').style.display = "none";
    document.getElementById('player-view').style.display = "flex";

    document.getElementById('player-station-name').innerText = station.name;
    document.getElementById('player-center-logo').src = station.logo;
    
    this.resetTimerMetrics();
    this.setupAudioStream(station.stream);

    document.getElementById('status-dot').className = "status-dot";
    document.getElementById('status-text').innerText = "Tap Play to Start";
    document.getElementById('vinyl-disc').classList.remove('spinning');
    document.getElementById('master-play-btn').innerText = "▶";
  }

  setupAudioStream(url) {
    // Teardown any running HLS engines cleanly
    if (this.hlsInstance) {
      this.hlsInstance.destroy();
      this.hlsInstance = null;
    }

    if (url.endsWith('.m3u8')) {
      if (Hls.isSupported()) {
        this.hlsInstance = new Hls({ enableWorker: true });
        this.hlsInstance.loadSource(url);
        this.hlsInstance.attachMedia(this.audioElement);
      } else if (this.audioElement.canPlayType('application/vnd.apple.mpegurl')) {
        // Native fallback engine for Safari
        this.audioElement.src = url;
      }
    } else {
      // Standard fallback for raw MP3 files
      this.audioElement.src = url;
    }
    this.audioElement.load();
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