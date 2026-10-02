// public/app.js

const API_TMDB = "/api/tmdb";
const API_EXTRACT = "/api/extract";

const elements = {
  grid: document.getElementById("mediaGrid"),
  searchInput: document.getElementById("searchInput"),
  searchBtn: document.getElementById("searchBtn"),
  modal: document.getElementById("playerModal"),
  closeModal: document.getElementById("closeModal"),
  playerContainer: document.getElementById("playerContainer"),
  sourceSelect: document.getElementById("sourceSelect"),
  title: document.getElementById("modalTitle"),
  tvControls: document.getElementById("tvControls"),
  seasonSelect: document.getElementById("seasonSelect"),
  episodeSelect: document.getElementById("episodeSelect"),
  gridTitle: document.getElementById("gridTitle"),
  logo: document.querySelector(".logo")
};

let currentMedia = null;
let currentSeasonsData = [];
let availableSources = [];
let hlsInstance = null;

document.addEventListener("DOMContentLoaded", () => {
  loadTrending();

  elements.searchBtn.addEventListener("click", handleSearch);
  elements.searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSearch();
  });

  elements.logo.addEventListener("click", () => {
    elements.searchInput.value = "";
    elements.gridTitle.innerText = "Tendances de la semaine";
    loadTrending();
  });

  elements.closeModal.addEventListener("click", hidePlayer);
  elements.sourceSelect.addEventListener("change", (e) => switchSource(e.target.value));
  
  // Écouteurs pour le changement de saison/épisode
  elements.seasonSelect.addEventListener("change", populateEpisodes);
  elements.episodeSelect.addEventListener("change", loadStreams);
});

async function loadTrending() {
  try {
    const res = await fetch(`${API_TMDB}?endpoint=/trending/all/week`);
    const data = await res.json();
    renderGrid(data.results || []);
  } catch (err) {
    elements.grid.innerHTML = "<p style='color:#e50914;'>Erreur de connexion aux services TMDB.</p>";
  }
}

async function handleSearch() {
  const query = elements.searchInput.value.trim();
  if (!query) return;

  try {
    const res = await fetch(`${API_TMDB}?endpoint=/search/multi&query=${encodeURIComponent(query)}`);
    const data = await res.json();
    elements.gridTitle.innerText = `Résultats pour "${query}"`;
    renderGrid(data.results || []);
  } catch (err) {
    console.error("Erreur de recherche :", err);
  }
}

function renderGrid(items) {
  elements.grid.innerHTML = "";
  if (items.length === 0) {
    elements.grid.innerHTML = "<p style='color:#aaa;'>Aucun contenu trouvé.</p>";
    return;
  }

  items.forEach((item) => {
    if (!item.poster_path) return;
    const title = item.title || item.name;
    const mediaType = item.media_type || (item.first_air_date ? "tv" : "movie");

    const card = document.createElement("div");
    card.className = "media-card";
    card.innerHTML = `
      <img src="https://image.tmdb.org/t/p/w500${item.poster_path}" alt="${title}">
      <div class="media-card-info"><h4>${title}</h4></div>
    `;

    card.addEventListener("click", () => preparePlayer(item.id, mediaType, title));
    elements.grid.appendChild(card);
  });
}

async function preparePlayer(id, type, title) {
  currentMedia = { id, type, title };
  elements.title.innerText = title;
  elements.modal.classList.add("active");
  elements.playerContainer.innerHTML = "<p style='color:#fff;'>Initialisation...</p>";

  if (type === "tv") {
    elements.tvControls.style.display = "flex";
    await fetchTVDetails(id);
  } else {
    elements.tvControls.style.display = "none";
    loadStreams();
  }
}

async function fetchTVDetails(id) {
  try {
    const res = await fetch(`${API_TMDB}?endpoint=/tv/${id}`);
    const data = await res.json();
    
    // Filtrer la saison 0 (Bonus) et stocker les données
    currentSeasonsData = (data.seasons || []).filter(s => s.season_number > 0);
    
    elements.seasonSelect.innerHTML = "";
    currentSeasonsData.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.season_number;
      opt.innerText = `Saison ${s.season_number}`;
      elements.seasonSelect.appendChild(opt);
    });

    populateEpisodes();
  } catch (err) {
    console.error("Erreur de récupération des saisons", err);
  }
}

function populateEpisodes() {
  const selectedSeasonNumber = parseInt(elements.seasonSelect.value, 10);
  const seasonData = currentSeasonsData.find(s => s.season_number === selectedSeasonNumber);
  
  elements.episodeSelect.innerHTML = "";
  if (seasonData) {
    for (let i = 1; i <= seasonData.episode_count; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.innerText = `Épisode ${i}`;
      elements.episodeSelect.appendChild(opt);
    }
  }
  
  loadStreams();
}

async function loadStreams() {
  elements.playerContainer.innerHTML = "<p style='color:#fff;'>Recherche des serveurs vidéo en cours...</p>";
  
  let url = `${API_EXTRACT}?id=${currentMedia.id}&type=${currentMedia.type}`;
  if (currentMedia.type === "tv") {
    url += `&season=${elements.seasonSelect.value}&episode=${elements.episodeSelect.value}`;
  }

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (!data.sources || data.sources.length === 0) {
      elements.playerContainer.innerHTML = "<p style='color:#e50914;'>Aucune source disponible.</p>";
      return;
    }

    availableSources = data.sources;
    elements.sourceSelect.innerHTML = "";
    availableSources.forEach((src, index) => {
      const opt = document.createElement("option");
      opt.value = index;
      opt.innerText = `${src.name} (${src.quality})`;
      elements.sourceSelect.appendChild(opt);
    });

    switchSource(0);
  } catch (err) {
    elements.playerContainer.innerHTML = "<p style='color:#e50914;'>Erreur lors de la récupération des flux.</p>";
  }
}

function switchSource(index) {
  cleanPlayer();
  const source = availableSources[index];
  if (!source) return;

  if (source.type === "iframe") {
    const iframe = document.createElement("iframe");
    iframe.src = source.embedUrl;
    iframe.allowFullscreen = true;
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-presentation allow-popups");
    iframe.setAttribute("allow", "autoplay; encrypted-media; fullscreen");
    elements.playerContainer.appendChild(iframe);
  } else if (source.type === "hls") {
    const video = document.createElement("video");
    video.controls = true;
    video.autoplay = true;
    elements.playerContainer.appendChild(video);

    const initialUrl = `${API_EXTRACT}?streamUrl=${encodeURIComponent(source.url)}&referer=${encodeURIComponent(source.referer || '')}`;

    if (Hls.isSupported()) {
      hlsInstance = new Hls({
        xhrSetup: (xhr, url) => {
          if (!url.includes(API_EXTRACT)) {
            xhr.open('GET', `${API_EXTRACT}?streamUrl=${encodeURIComponent(url)}`, true);
          }
        }
      });
      hlsInstance.loadSource(initialUrl);
      hlsInstance.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = initialUrl;
    }
  }
}

function cleanPlayer() {
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
  elements.playerContainer.innerHTML = "";
}

function hidePlayer() {
  cleanPlayer();
  elements.modal.classList.remove("active");
}
