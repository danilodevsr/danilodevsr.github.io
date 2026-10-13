import { PROJECTS } from "./data/projects.js";

// Referencias del DOM
const searchInput = document.getElementById("search-input");
const projectsGrid = document.getElementById("projects-grid");
const filterPillsContainer = document.getElementById("filter-pills");
const featuredGrid = document.getElementById("featured-grid");
const currentYearSpan = document.getElementById("current-year");

// Estadísticas en Specs Bar
const statTotal = document.getElementById("stat-total");
const statTools = document.getElementById("stat-tools");
const statAtlas = document.getElementById("stat-atlas");
const statExperimental = document.getElementById("stat-experimental");
const statGames = document.getElementById("stat-games");
const catalogCountSpan = document.getElementById("catalog-count");

// Estado reactivo & soporte para deep-linking (?cat=tools, ?cat=games)
const urlParams = new URLSearchParams(window.location.search);
const initialCat = urlParams.get("cat") || urlParams.get("filter");
let currentCategory = (initialCat && ["all", "tools", "atlas", "experimental", "games"].includes(initialCat)) ? initialCat : "all";
let searchQuery = "";

// 1. Configurar año dinámico
if (currentYearSpan) {
  currentYearSpan.textContent = new Date().getFullYear();
}

// 2. Calcular y pintar métricas
const totalCount = PROJECTS.length;
const toolsCount = PROJECTS.filter(p => p.category === "tools").length;
const atlasCount = PROJECTS.filter(p => p.category === "atlas").length;
const expCount = PROJECTS.filter(p => p.category === "experimental").length;
const gamesCount = PROJECTS.filter(p => p.category === "games").length;

if (statTotal) statTotal.textContent = String(totalCount).padStart(2, "0");
if (statTools) statTools.textContent = String(toolsCount).padStart(2, "0");
if (statAtlas) statAtlas.textContent = String(atlasCount).padStart(2, "0");
if (statExperimental) statExperimental.textContent = String(expCount).padStart(2, "0");
if (statGames) statGames.textContent = String(gamesCount).padStart(2, "0");

// 3. Renderizar Proyectos Destacados (Curaduría Top 3: Trilogía Atlas)
const FEATURED_IDS = ["A01", "A02", "A03"]; // World Atlas, Human Atlas 3D, Species Atlas
const featuredList = PROJECTS.filter(p => FEATURED_IDS.includes(p.id));

if (featuredGrid) {
  featuredGrid.innerHTML = featuredList.map(p => {
    const categoryName = p.category === "atlas" 
      ? "ATLAS // EXPLORADOR VISUAL" 
      : (p.category === "tools" ? "HERRAMIENTA // UTILIDAD" : (p.category === "experimental" ? "LAB // EXPERIMENTAL" : "JUEGO // CANVAS"));
    return `
      <article class="featured-card">
        <div>
          <div class="f-card-header mono uppercase">
            <span class="f-card-id">#${p.id}</span>
            <span class="f-card-category">${categoryName}</span>
          </div>
          <h3 class="f-card-title">${p.title}</h3>
          <p class="f-card-desc">${p.desc}</p>
          <div class="f-card-tags mono">
            ${(p.tags || []).map(t => `<span class="f-card-tag">#${t}</span>`).join("")}
          </div>
        </div>
        <div class="f-card-footer mono uppercase">
          <span class="emoji-indicator">${p.emoji} OFFLINE</span>
          <a href="${p.path}" class="f-card-link" target="_blank" rel="noopener">
            ABRIR PROYECTO ↗
          </a>
        </div>
      </article>
    `;
  }).join("");
}

// 4. Renderizar Filtros Rápidos (Pills)
const categories = [
  { id: "all", label: "TODOS", count: totalCount },
  { id: "tools", label: "HERRAMIENTAS", count: toolsCount },
  { id: "atlas", label: "ATLAS", count: atlasCount },
  { id: "experimental", label: "EXPERIMENTAL", count: expCount },
  { id: "games", label: "JUEGOS", count: gamesCount }
];

if (filterPillsContainer) {
  filterPillsContainer.innerHTML = categories.map(cat => `
    <button class="filter-btn mono uppercase ${cat.id === currentCategory ? 'active' : ''}" data-cat="${cat.id}">
      ${cat.label} (${cat.count})
    </button>
  `).join("");

  filterPillsContainer.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    const cat = btn.getAttribute("data-cat");
    currentCategory = cat;

    // Actualizar clases activas
    filterPillsContainer.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    renderCatalog();
  });
}

// 5. Renderizar Catálogo General
function renderCatalog() {
  if (!projectsGrid) return;

  const filtered = PROJECTS.filter(p => {
    // Filtro por categoría
    const matchesCategory = currentCategory === "all" || p.category === currentCategory;

    // Filtro por búsqueda
    const haystack = [p.id, p.title, p.desc, ...(p.tags || [])].join(" ").toLowerCase();
    const matchesSearch = !searchQuery || haystack.includes(searchQuery);

    return matchesCategory && matchesSearch;
  });

  if (catalogCountSpan) {
    catalogCountSpan.textContent = `#${String(filtered.length).padStart(2, "0")} RESULTADOS`;
  }

  if (filtered.length === 0) {
    projectsGrid.innerHTML = `
      <div class="empty-state mono">
        <h3>[ 0 RESULTADOS ENCONTRADOS ]</h3>
        <p>No se encontraron herramientas o proyectos con el criterio "${searchQuery}".</p>
      </div>
    `;
    return;
  }

  projectsGrid.innerHTML = filtered.map(p => `
    <article class="project-card">
      <div>
        <div class="p-card-top mono">
          <span class="p-card-id">#${p.id}</span>
          <span class="p-card-emoji">${p.emoji}</span>
        </div>
        <h3 class="p-card-title">${p.title}</h3>
        <p class="p-card-desc">${p.desc}</p>
        <div class="p-card-tags mono">
          ${(p.tags || []).map(t => `<span class="p-card-tag">${t}</span>`).join("")}
        </div>
      </div>
      <a href="${p.path}" class="p-card-action mono uppercase" target="_blank" rel="noopener">
        <span>ABRIR PROYECTO</span>
        <span>↗</span>
      </a>
    </article>
  `).join("");
}

// 6. Listener de Búsqueda Reactiva
searchInput?.addEventListener("input", (e) => {
  searchQuery = e.target.value.trim().toLowerCase();
  renderCatalog();
});

// Render inicial
renderCatalog();

// Soporte para subpáginas de tools y games
const toolsGrid = document.getElementById("tools-grid");
if (toolsGrid) {
  toolsGrid.innerHTML = PROJECTS.filter(p => p.category === "tools").map(p => `
    <article class="card">
      <div class="card-icon">${p.emoji}</div>
      <div class="card-title">${p.title}</div>
      <p class="card-desc">${p.desc}</p>
      <a class="card-link" href="${p.path}">Abrir →</a>
    </article>
  `).join("");
}

const gamesGrid = document.getElementById("games-grid");
if (gamesGrid) {
  gamesGrid.innerHTML = PROJECTS.filter(p => p.category === "games").map(p => `
    <article class="card">
      <div class="card-icon">${p.emoji}</div>
      <div class="card-title">${p.title}</div>
      <p class="card-desc">${p.desc}</p>
      <a class="card-link" href="${p.path}">Abrir →</a>
    </article>
  `).join("");
}

// ============================================================
// 7. GENERATIVE AUDIO BITSTREAM VISUALIZER (BITS EQUALIZER)
// ============================================================
const bitstreamCanvas = document.getElementById("bitstream-canvas");
if (bitstreamCanvas) {
  const ctx = bitstreamCanvas.getContext("2d");
  let width, height;

  function resizeCanvas() {
    if (!bitstreamCanvas.parentElement) return;
    const rect = bitstreamCanvas.parentElement.getBoundingClientRect();
    width = bitstreamCanvas.width = Math.floor(rect.width);
    height = bitstreamCanvas.height = Math.floor(rect.height);
  }

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  const barWidth = 3;
  const gap = 2;
  const step = barWidth + gap;

  function drawBitstream(t) {
    if (!ctx || width === 0) return requestAnimationFrame(drawBitstream);
    ctx.clearRect(0, 0, width, height);

    const time = t * 0.0028;
    const numBars = Math.ceil(width / step);
    const centerY = Math.floor(height / 2);

    for (let i = 0; i < numBars; i++) {
      // Ondas armónicas superpuestas que emulan el compás de un track electrónico
      const w1 = Math.sin(i * 0.048 + time * 2.3);
      const w2 = Math.cos(i * 0.085 - time * 1.5);
      const w3 = Math.sin(i * 0.015 + time * 0.85);
      const beat = Math.pow((Math.sin(time * 1.7 + i * 0.015) + 1) / 2, 4);

      // Amplitud normalizada entre 0.08 y 1
      const amp = Math.max(0.08, ((w1 * 0.45 + w2 * 0.35 + w3 * 0.2 + 1) / 2) * (0.6 + beat * 0.5));
      const barHeight = Math.max(2, Math.round(amp * (height - 8)));

      const x = i * step;
      const y = Math.round(centerY - barHeight / 2);

      ctx.fillStyle = "#000000";
      ctx.fillRect(x, y, barWidth, barHeight);
    }

    requestAnimationFrame(drawBitstream);
  }

  requestAnimationFrame(drawBitstream);
}
