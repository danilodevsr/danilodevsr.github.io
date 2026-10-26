import { DEMOS } from "./data/demos.js";

const demosGrid = document.getElementById("demos-grid");
const searchInput = document.getElementById("search");
const filterButtons = document.querySelectorAll(".filter-btn");

let currentCategory = "all";
let currentQuery = "";

function cardHTML(demo) {
  const isReady = demo.status.toLowerCase() === "listo";
  const tagsHTML = (demo.tags || []).map(t => `<span class="tag">${t}</span>`).join("");
  const statusClass = isReady ? "badge-status-listo" : "badge-status-maqueta";

  return `
    <article class="card-demo">
      <div>
        <div class="card-top">
          <span class="demo-emoji">${demo.emoji}</span>
          <div class="badges">
            <span class="badge ${statusClass}">${demo.status}</span>
          </div>
        </div>
        <div class="framework-pill">${demo.framework}</div>
        <h3>${demo.title}</h3>
        <p>${demo.desc}</p>
        <div class="tags">${tagsHTML}</div>
      </div>
      <div class="card-footer">
        <span style="font-size: 11px; color: var(--text-muted);">ID: #${demo.id}</span>
        ${
          isReady
            ? `<a href="${demo.path}" class="demo-link">Ver Demo en vivo ↗</a>`
            : `<span class="demo-link disabled">Próximamente ⏳</span>`
        }
      </div>
    </article>
  `;
}

function render() {
  if (!demosGrid) return;

  const filtered = DEMOS.filter(item => {
    const matchCategory = currentCategory === "all" || item.category === currentCategory;
    const haystack = [
      item.id,
      item.title,
      item.desc,
      item.framework,
      ...(item.tags || [])
    ].join(" ").toLowerCase();
    const matchQuery = !currentQuery || haystack.includes(currentQuery);

    return matchCategory && matchQuery;
  });

  if (filtered.length === 0) {
    demosGrid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--muted);">
        <p style="font-size: 20px; margin-bottom: 8px;">🔍 No se encontraron maquetas</p>
        <p style="font-size: 14px;">Prueba buscando con otro término o seleccionando "Todos".</p>
      </div>
    `;
    return;
  }

  demosGrid.innerHTML = filtered.map(cardHTML).join("");
}

// Event Listeners para Búsqueda
searchInput?.addEventListener("input", (e) => {
  currentQuery = e.target.value.trim().toLowerCase();
  render();
});

// Event Listeners para Filtros
filterButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    filterButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentCategory = btn.dataset.category || "all";
    render();
  });
});

// Render inicial
render();
