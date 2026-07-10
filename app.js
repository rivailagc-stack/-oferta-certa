const STORAGE_KEY = "ofertaCertaV14Products";

const sampleProducts = [
  {
    id: "demo-1",
    title: "Máquina Inversora de Solda 150A",
    price: 499.90,
    oldPrice: 599.90,
    category: "Ferramentas",
    badge: "OFERTA",
    description: "Compacta, potente e indicada para trabalhos de manutenção e pequenos reparos.",
    image: "https://placehold.co/900x900/ffffff/ff6b00?text=Seu+Produto",
    affiliateLink: "https://meli.la/2nGbR5G",
    featured: true,
    clicks: 0
  }
];

function getProducts() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleProducts));
    return sampleProducts;
  }
  try {
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

function saveProducts(products) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const grid = document.getElementById("productsGrid");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const productCount = document.getElementById("productCount");

function trackClick(id) {
  const products = getProducts();
  const product = products.find(item => item.id === id);
  if (product) {
    product.clicks = Number(product.clicks || 0) + 1;
    saveProducts(products);
  }
}

function renderCategories(products) {
  const current = categoryFilter.value;
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
  categoryFilter.innerHTML =
    '<option value="">Todas as categorias</option>' +
    categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  categoryFilter.value = current;
}

function renderProducts() {
  const products = getProducts();
  const term = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;

  const filtered = products.filter(product => {
    const matchesText =
      product.title.toLowerCase().includes(term) ||
      (product.description || "").toLowerCase().includes(term);
    const matchesCategory = !category || product.category === category;
    return matchesText && matchesCategory;
  });

  productCount.textContent = `${filtered.length} produto${filtered.length === 1 ? "" : "s"}`;

  if (!filtered.length) {
    grid.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  grid.innerHTML = filtered.map(product => `
    <article class="product-card" data-category="${escapeHtml(product.category)}">
      <div class="product-image-wrap">
        ${product.badge ? `<span class="badge">${escapeHtml(product.badge)}</span>` : ""}
        ${product.featured ? '<span class="featured-star" title="Destaque">⭐</span>' : ""}
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.title)}" loading="lazy" />
      </div>
      <div class="product-body">
        <span class="category-tag">${escapeHtml(product.category)}</span>
        <h3>${escapeHtml(product.title)}</h3>
        ${product.description ? `<p class="product-description">${escapeHtml(product.description)}</p>` : ""}
        <div class="price-row">
          <strong>${money(product.price)}</strong>
          ${product.oldPrice ? `<del>${money(product.oldPrice)}</del>` : ""}
        </div>
        <a
          class="buy-button"
          href="${escapeHtml(product.affiliateLink)}"
          target="_blank"
          rel="noopener sponsored"
          data-id="${escapeHtml(product.id)}"
        >Comprar no Mercado Livre</a>
      </div>
    </article>
  `).join("");

  document.querySelectorAll(".buy-button[data-id]").forEach(button => {
    button.addEventListener("click", () => trackClick(button.dataset.id));
  });
}

renderCategories(getProducts());
renderProducts();

searchInput.addEventListener("input", renderProducts);
categoryFilter.addEventListener("change", renderProducts);
window.addEventListener("storage", () => {
  renderCategories(getProducts());
  renderProducts();
});
