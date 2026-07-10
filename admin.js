const STORAGE_KEY = "ofertaCertaV14Products";

const form = document.getElementById("productForm");
const productId = document.getElementById("productId");
const affiliateLink = document.getElementById("affiliateLink");
const title = document.getElementById("title");
const price = document.getElementById("price");
const oldPrice = document.getElementById("oldPrice");
const category = document.getElementById("category");
const badge = document.getElementById("badge");
const description = document.getElementById("description");
const imageFile = document.getElementById("imageFile");
const featured = document.getElementById("featured");

const previewImage = document.getElementById("previewImage");
const previewTitle = document.getElementById("previewTitle");
const previewPrice = document.getElementById("previewPrice");
const previewOldPrice = document.getElementById("previewOldPrice");
const previewCategory = document.getElementById("previewCategory");
const previewBadge = document.getElementById("previewBadge");
const coverPreview = document.getElementById("coverPreview");

const list = document.getElementById("adminProductsList");
const totalProducts = document.getElementById("totalProducts");
const totalFeatured = document.getElementById("totalFeatured");
const totalClicks = document.getElementById("totalClicks");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const resetBtn = document.getElementById("resetBtn");
const formTitle = document.getElementById("formTitle");
const saveBtn = document.getElementById("saveBtn");

let imageData = "";

function getProducts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
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

function isValidAffiliateUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" &&
      (
        parsed.hostname === "meli.la" ||
        parsed.hostname.endsWith("mercadolivre.com.br") ||
        parsed.hostname.endsWith("mercadolivre.com")
      );
  } catch {
    return false;
  }
}

function updatePreview() {
  previewTitle.textContent = title.value.trim() || "Título do produto";
  previewPrice.textContent = money(price.value);
  previewCategory.textContent = category.value || "Categoria";
  coverPreview.dataset.category = category.value || "Outros";

  if (oldPrice.value) {
    previewOldPrice.textContent = money(oldPrice.value);
    previewOldPrice.classList.remove("hidden");
  } else {
    previewOldPrice.classList.add("hidden");
  }

  if (badge.value) {
    previewBadge.textContent = badge.value;
    previewBadge.classList.remove("hidden");
  } else {
    previewBadge.classList.add("hidden");
  }

  if (imageData) previewImage.src = imageData;
}

function resetForm() {
  form.reset();
  productId.value = "";
  imageData = "";
  previewImage.src = "https://placehold.co/800x800?text=Foto+do+produto";
  formTitle.textContent = "Cadastrar produto";
  saveBtn.textContent = "Publicar produto";
  cancelEditBtn.classList.add("hidden");
  updatePreview();
}

function renderList() {
  const products = getProducts();

  totalProducts.textContent = products.length;
  totalFeatured.textContent = products.filter(p => p.featured).length;
  totalClicks.textContent = products.reduce((sum, p) => sum + Number(p.clicks || 0), 0);

  if (!products.length) {
    list.innerHTML = `<div class="empty-state">
      <div>📦</div>
      <h3>Nenhum produto cadastrado</h3>
      <p>Use o formulário acima para publicar o primeiro produto.</p>
    </div>`;
    return;
  }

  list.innerHTML = products.map(product => `
    <article class="admin-product-item">
      <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.title)}" />
      <div>
        <h3>${escapeHtml(product.title)}</h3>
        <p>${escapeHtml(product.category)} • ${money(product.price)} • ${Number(product.clicks || 0)} clique(s)</p>
      </div>
      <div class="item-actions">
        <button class="mini-btn" data-action="edit" data-id="${escapeHtml(product.id)}">Editar</button>
        <a class="mini-btn" href="${escapeHtml(product.affiliateLink)}" target="_blank" rel="noopener">Testar link</a>
        <button class="mini-btn danger" data-action="delete" data-id="${escapeHtml(product.id)}">Excluir</button>
      </div>
    </article>
  `).join("");
}

function editProduct(id) {
  const product = getProducts().find(p => p.id === id);
  if (!product) return;

  productId.value = product.id;
  affiliateLink.value = product.affiliateLink;
  title.value = product.title;
  price.value = product.price;
  oldPrice.value = product.oldPrice || "";
  category.value = product.category;
  badge.value = product.badge || "";
  description.value = product.description || "";
  featured.checked = Boolean(product.featured);
  imageData = product.image;
  previewImage.src = product.image;

  formTitle.textContent = "Editar produto";
  saveBtn.textContent = "Salvar alterações";
  cancelEditBtn.classList.remove("hidden");
  updatePreview();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteProduct(id) {
  const products = getProducts();
  const product = products.find(p => p.id === id);
  if (!product) return;

  const confirmed = confirm(`Excluir "${product.title}"?`);
  if (!confirmed) return;

  saveProducts(products.filter(p => p.id !== id));
  renderList();
  if (productId.value === id) resetForm();
}

imageFile.addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("Selecione um arquivo de imagem.");
    imageFile.value = "";
    return;
  }

  if (file.size > 2.5 * 1024 * 1024) {
    alert("A imagem deve ter no máximo 2,5 MB para não sobrecarregar o navegador.");
    imageFile.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    imageData = reader.result;
    updatePreview();
  };
  reader.readAsDataURL(file);
});

[title, price, oldPrice, category, badge].forEach(element => {
  element.addEventListener("input", updatePreview);
  element.addEventListener("change", updatePreview);
});

form.addEventListener("submit", event => {
  event.preventDefault();

  const link = affiliateLink.value.trim();

  if (!isValidAffiliateUrl(link)) {
    alert("Cole um link válido do Mercado Livre, como https://meli.la/...");
    affiliateLink.focus();
    return;
  }

  if (!imageData && !productId.value) {
    alert("Selecione uma imagem para o produto.");
    imageFile.focus();
    return;
  }

  const products = getProducts();
  const editingId = productId.value;

  const product = {
    id: editingId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    affiliateLink: link,
    title: title.value.trim(),
    price: Number(price.value),
    oldPrice: oldPrice.value ? Number(oldPrice.value) : null,
    category: category.value,
    badge: badge.value,
    description: description.value.trim(),
    image: imageData,
    featured: featured.checked,
    clicks: 0
  };

  if (editingId) {
    const index = products.findIndex(p => p.id === editingId);
    if (index >= 0) {
      product.clicks = Number(products[index].clicks || 0);
      products[index] = product;
    }
  } else {
    products.unshift(product);
  }

  saveProducts(products);
  renderList();
  resetForm();
  alert(editingId ? "Produto atualizado com sucesso." : "Produto publicado com sucesso.");
});

list.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;
  if (action === "edit") editProduct(id);
  if (action === "delete") deleteProduct(id);
});

resetBtn.addEventListener("click", resetForm);
cancelEditBtn.addEventListener("click", resetForm);

renderList();
updatePreview();
