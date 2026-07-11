const STORAGE_KEY = "ofertaCertaV14Products";

const MAX_IMAGES = 8;
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const IMAGE_MAX_WIDTH = 1200;
const IMAGE_QUALITY = 0.78;

const form = document.getElementById("productForm");
const productId = document.getElementById("productId");
const affiliateLink = document.getElementById("affiliateLink");
const title = document.getElementById("title");
const price = document.getElementById("price");
const oldPrice = document.getElementById("oldPrice");
const category = document.getElementById("category");
const badge = document.getElementById("badge");
const description = document.getElementById("description");
const imageFiles = document.getElementById("imageFiles");
const imagesPreview = document.getElementById("imagesPreview");
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

let selectedImages = [];
let coverIndex = 0;
let processingImages = false;
let publishing = false;

function getProducts() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (!Array.isArray(saved)) {
      return [];
    }

    return saved.map(product => {
      const images =
        Array.isArray(product.images) && product.images.length
          ? product.images
          : product.image
            ? [product.image]
            : [];

      return {
        ...product,
        images,
        image: images[0] || product.image || ""
      };
    });
  } catch (error) {
    console.error("Erro ao carregar produtos:", error);
    return [];
  }
}

function saveProducts(products) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    return true;
  } catch (error) {
    console.error("Erro ao salvar produtos:", error);

    if (
      error.name === "QuotaExceededError" ||
      error.code === 22 ||
      error.code === 1014
    ) {
      alert(
        "O armazenamento do navegador ficou cheio.\n\n" +
        "Exclua produtos antigos ou use menos fotos por produto.\n" +
        "As imagens já são comprimidas, mas o navegador possui limite de espaço."
      );
    } else {
      alert("Não foi possível salvar o produto. Tente novamente.");
    }

    return false;
  }
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

    const hostname = parsed.hostname.toLowerCase();

    return (
      parsed.protocol === "https:" &&
      (
        hostname === "meli.la" ||
        hostname === "mercadolivre.com.br" ||
        hostname.endsWith(".mercadolivre.com.br") ||
        hostname === "mercadolivre.com" ||
        hostname.endsWith(".mercadolivre.com")
      )
    );
  } catch {
    return false;
  }
}

function getProductImages(product) {
  if (Array.isArray(product.images) && product.images.length) {
    return product.images;
  }

  if (product.image) {
    return [product.image];
  }

  return [];
}

function getCoverImage() {
  if (!selectedImages.length) {
    return "";
  }

  if (coverIndex < 0 || coverIndex >= selectedImages.length) {
    coverIndex = 0;
  }

  return selectedImages[coverIndex];
}

function updatePreview() {
  previewTitle.textContent =
    title.value.trim() || "Título do produto";

  previewPrice.textContent = money(price.value);

  previewCategory.textContent =
    category.value || "Categoria";

  coverPreview.dataset.category =
    category.value || "Outros";

  if (oldPrice.value) {
    previewOldPrice.textContent = money(oldPrice.value);
    previewOldPrice.classList.remove("hidden");
  } else {
    previewOldPrice.textContent = "";
    previewOldPrice.classList.add("hidden");
  }

  if (badge.value) {
    previewBadge.textContent = badge.value;
    previewBadge.classList.remove("hidden");
  } else {
    previewBadge.textContent = "";
    previewBadge.classList.add("hidden");
  }

  const coverImage = getCoverImage();

  previewImage.src =
    coverImage ||
    "https://placehold.co/800x800?text=Foto+do+produto";
}

function renderImagesPreview() {
  if (!imagesPreview) return;

  if (!selectedImages.length) {
    imagesPreview.innerHTML = `
      <div class="images-empty">
        Nenhuma foto selecionada.
      </div>
    `;

    updatePreview();
    return;
  }

  imagesPreview.innerHTML = selectedImages.map((image, index) => `
    <div class="image-preview-item ${index === coverIndex ? "cover" : ""}">
      ${index === coverIndex
        ? '<span class="cover-label">CAPA</span>'
        : ""
      }

      <img
        src="${image}"
        alt="Foto ${index + 1} do produto"
      />

      <div class="image-preview-actions">
        <button
          type="button"
          class="set-cover-button"
          data-image-action="cover"
          data-index="${index}"
        >
          ${index === coverIndex ? "Capa atual" : "Usar como capa"}
        </button>

        <button
          type="button"
          class="remove-image-button"
          data-image-action="remove"
          data-index="${index}"
        >
          Excluir
        </button>
      </div>
    </div>
  `).join("");

  updatePreview();
}

function resetForm() {
  form.reset();

  productId.value = "";
  selectedImages = [];
  coverIndex = 0;
  processingImages = false;
  publishing = false;

  if (imageFiles) {
    imageFiles.value = "";
    imageFiles.disabled = false;
  }

  saveBtn.disabled = false;
  saveBtn.textContent = "Publicar produto";

  formTitle.textContent = "Cadastrar produto";
  cancelEditBtn.classList.add("hidden");

  renderImagesPreview();
  updatePreview();
}

function renderList() {
  const products = getProducts();

  totalProducts.textContent = products.length;

  totalFeatured.textContent =
    products.filter(product => product.featured).length;

  totalClicks.textContent = products.reduce(
    (sum, product) => sum + Number(product.clicks || 0),
    0
  );

  if (!products.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div>📦</div>
        <h3>Nenhum produto cadastrado</h3>
        <p>Use o formulário acima para publicar o primeiro produto.</p>
      </div>
    `;

    return;
  }

  list.innerHTML = products.map(product => {
    const images = getProductImages(product);

    const cover =
      product.image ||
      images[0] ||
      "https://placehold.co/300x300?text=Sem+foto";

    return `
      <article class="admin-product-item">
        <img
          src="${escapeHtml(cover)}"
          alt="${escapeHtml(product.title)}"
        />

        <div>
          <h3>${escapeHtml(product.title)}</h3>

          <p>
            ${escapeHtml(product.category)}
            • ${money(product.price)}
            • ${images.length} foto(s)
            • ${Number(product.clicks || 0)} clique(s)
          </p>
        </div>

        <div class="item-actions">
          <button
            class="mini-btn"
            type="button"
            data-action="edit"
            data-id="${escapeHtml(product.id)}"
          >
            Editar
          </button>

          <a
            class="mini-btn"
            href="${escapeHtml(product.affiliateLink)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            Testar link
          </a>

          <button
            class="mini-btn danger"
            type="button"
            data-action="delete"
            data-id="${escapeHtml(product.id)}"
          >
            Excluir
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function editProduct(id) {
  const product = getProducts().find(item => item.id === id);

  if (!product) {
    alert("Produto não encontrado.");
    return;
  }

  productId.value = product.id;
  affiliateLink.value = product.affiliateLink || "";
  title.value = product.title || "";
  price.value = product.price || "";
  oldPrice.value = product.oldPrice || "";
  category.value = product.category || "";
  badge.value = product.badge || "";
  description.value = product.description || "";
  featured.checked = Boolean(product.featured);

  selectedImages = getProductImages(product);

  const savedCover = product.image;
  const savedCoverIndex = selectedImages.indexOf(savedCover);

  coverIndex = savedCoverIndex >= 0 ? savedCoverIndex : 0;

  if (imageFiles) {
    imageFiles.value = "";
  }

  formTitle.textContent = "Editar produto";
  saveBtn.textContent = "Salvar alterações";
  cancelEditBtn.classList.remove("hidden");

  renderImagesPreview();
  updatePreview();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function deleteProduct(id) {
  const products = getProducts();
  const product = products.find(item => item.id === id);

  if (!product) return;

  const confirmed = confirm(
    `Excluir o produto "${product.title}"?`
  );

  if (!confirmed) return;

  const updatedProducts =
    products.filter(item => item.id !== id);

  if (!saveProducts(updatedProducts)) {
    return;
  }

  renderList();

  if (productId.value === id) {
    resetForm();
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(
      new Error("Não foi possível ler a imagem.")
    );

    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(
      new Error("Não foi possível carregar a imagem.")
    );

    image.src = dataUrl;
  });
}

async function compressImage(file) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);

  let width = image.naturalWidth;
  let height = image.naturalHeight;

  if (width > IMAGE_MAX_WIDTH) {
    height = Math.round(
      height * (IMAGE_MAX_WIDTH / width)
    );

    width = IMAGE_MAX_WIDTH;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", {
    alpha: false
  });

  if (!context) {
    throw new Error("Seu navegador não conseguiu processar a imagem.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL(
    "image/jpeg",
    IMAGE_QUALITY
  );
}

async function processSelectedImages(files) {
  if (processingImages) return;

  const availableSlots =
    MAX_IMAGES - selectedImages.length;

  if (availableSlots <= 0) {
    alert(`Você já adicionou o máximo de ${MAX_IMAGES} fotos.`);
    imageFiles.value = "";
    return;
  }

  const chosenFiles =
    Array.from(files).slice(0, availableSlots);

  if (files.length > availableSlots) {
    alert(
      `Foram selecionadas mais de ${MAX_IMAGES} fotos.\n` +
      `Somente ${availableSlots} foto(s) serão adicionadas.`
    );
  }

  const invalidFile = chosenFiles.find(
    file => !file.type.startsWith("image/")
  );

  if (invalidFile) {
    alert(
      `"${invalidFile.name}" não é uma imagem válida.`
    );

    imageFiles.value = "";
    return;
  }

  const oversizedFile = chosenFiles.find(
    file => file.size > MAX_FILE_SIZE
  );

  if (oversizedFile) {
    alert(
      `"${oversizedFile.name}" possui mais de 8 MB.\n` +
      "Escolha uma foto menor."
    );

    imageFiles.value = "";
    return;
  }

  processingImages = true;
  imageFiles.disabled = true;

  const originalButtonText = saveBtn.textContent;

  saveBtn.disabled = true;
  saveBtn.textContent = "Processando fotos...";

  try {
    for (let index = 0; index < chosenFiles.length; index++) {
      saveBtn.textContent =
        `Processando foto ${index + 1} de ${chosenFiles.length}...`;

      const compressed =
        await compressImage(chosenFiles[index]);

      selectedImages.push(compressed);
    }

    if (selectedImages.length === chosenFiles.length) {
      coverIndex = 0;
    }

    renderImagesPreview();
  } catch (error) {
    console.error(error);

    alert(
      "Não foi possível processar uma das fotos.\n" +
      "Tente escolher outra imagem."
    );
  } finally {
    processingImages = false;
    imageFiles.disabled = false;
    imageFiles.value = "";
    saveBtn.disabled = false;

    saveBtn.textContent =
      productId.value
        ? "Salvar alterações"
        : originalButtonText;
  }
}

if (imageFiles) {
  imageFiles.addEventListener("change", async event => {
    const files = event.target.files;

    if (!files || !files.length) return;

    await processSelectedImages(files);
  });
}

if (imagesPreview) {
  imagesPreview.addEventListener("click", event => {
    const button =
      event.target.closest("[data-image-action]");

    if (!button) return;

    const action = button.dataset.imageAction;
    const index = Number(button.dataset.index);

    if (
      Number.isNaN(index) ||
      index < 0 ||
      index >= selectedImages.length
    ) {
      return;
    }

    if (action === "cover") {
      coverIndex = index;
      renderImagesPreview();
    }

    if (action === "remove") {
      selectedImages.splice(index, 1);

      if (!selectedImages.length) {
        coverIndex = 0;
      } else if (index < coverIndex) {
        coverIndex--;
      } else if (coverIndex >= selectedImages.length) {
        coverIndex = selectedImages.length - 1;
      }

      renderImagesPreview();
    }
  });
}

[
  title,
  price,
  oldPrice,
  category,
  badge
].forEach(element => {
  element.addEventListener("input", updatePreview);
  element.addEventListener("change", updatePreview);
});

form.addEventListener("submit", async event => {
  event.preventDefault();

  if (publishing || processingImages) {
    return;
  }

  const link = affiliateLink.value.trim();

  if (!isValidAffiliateUrl(link)) {
    alert(
      "Cole um link válido do Mercado Livre, como:\n" +
      "https://meli.la/..."
    );

    affiliateLink.focus();
    return;
  }

  if (!title.value.trim()) {
    alert("Informe o título do produto.");
    title.focus();
    return;
  }

  if (!price.value || Number(price.value) <= 0) {
    alert("Informe um preço válido.");
    price.focus();
    return;
  }

  if (!category.value) {
    alert("Selecione uma categoria.");
    category.focus();
    return;
  }

  if (!selectedImages.length) {
    alert("Selecione pelo menos uma foto para o produto.");
    imageFiles.focus();
    return;
  }

  publishing = true;
  saveBtn.disabled = true;

  const editingId = productId.value;
  saveBtn.textContent =
    editingId
      ? "Salvando alterações..."
      : "Publicando...";

  try {
    const products = getProducts();

    const orderedImages = [...selectedImages];

    if (coverIndex > 0) {
      const selectedCover =
        orderedImages.splice(coverIndex, 1)[0];

      orderedImages.unshift(selectedCover);
    }

    const oldProduct = editingId
      ? products.find(product => product.id === editingId)
      : null;

    const product = {
      id:
        editingId ||
        (
          window.crypto &&
          typeof window.crypto.randomUUID === "function"
            ? window.crypto.randomUUID()
            : `${Date.now()}-${Math.random()
                .toString(16)
                .slice(2)}`
        ),

      affiliateLink: link,
      title: title.value.trim(),
      price: Number(price.value),

      oldPrice:
        oldPrice.value
          ? Number(oldPrice.value)
          : null,

      category: category.value,
      badge: badge.value,
      description: description.value.trim(),

      images: orderedImages,

      // Mantém compatibilidade com o app.js antigo.
      image: orderedImages[0],

      featured: featured.checked,

      clicks:
        oldProduct
          ? Number(oldProduct.clicks || 0)
          : 0,

      createdAt:
        oldProduct?.createdAt ||
        new Date().toISOString(),

      updatedAt:
        new Date().toISOString()
    };

    if (editingId) {
      const index = products.findIndex(
        item => item.id === editingId
      );

      if (index >= 0) {
        products[index] = product;
      } else {
        products.unshift(product);
      }
    } else {
      products.unshift(product);
    }

    const saved = saveProducts(products);

    if (!saved) {
      return;
    }

    renderList();
    resetForm();

    alert(
      editingId
        ? "Produto atualizado com sucesso."
        : "Produto publicado com sucesso."
    );
  } catch (error) {
    console.error("Erro ao publicar produto:", error);

    alert(
      "Ocorreu um erro ao publicar o produto.\n" +
      "Tente novamente."
    );
  } finally {
    publishing = false;
    saveBtn.disabled = false;

    if (productId.value) {
      saveBtn.textContent = "Salvar alterações";
    } else {
      saveBtn.textContent = "Publicar produto";
    }
  }
});

list.addEventListener("click", event => {
  const button =
    event.target.closest("[data-action]");

  if (!button) return;

  const { action, id } = button.dataset;

  if (action === "edit") {
    editProduct(id);
  }

  if (action === "delete") {
    deleteProduct(id);
  }
});

resetBtn.addEventListener("click", resetForm);
cancelEditBtn.addEventListener("click", resetForm);

renderList();
renderImagesPreview();
updatePreview();
