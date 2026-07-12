
const mlProductSource = document.getElementById("mlProductSource");
const mlImportButton = document.getElementById("mlImportButton");
const mlImportMessage = document.getElementById("mlImportMessage");

if (mlImportButton) {
  mlImportButton.addEventListener("click", importarMercadoLivre);
}

if (mlProductSource) {
  mlProductSource.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      importarMercadoLivre();
    }
  });
}

async function importarMercadoLivre() {
  const source = mlProductSource.value.trim();

  if (!source) {
    mostrarMensagemMl("Cole o código MLB ou o link público do produto.", "error");
    return;
  }

  mlImportButton.disabled = true;
  mlImportButton.textContent = "Buscando...";
  esconderMensagemMl();

  try {
    const response = await fetch("/api/importar-mercadolivre", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Não foi possível importar o produto.");
    }

    preencherFormularioMl(data.product);
    mostrarMensagemMl(
      `Produto carregado. Agora cole seu link afiliado e confira título, preço e fotos.`,
      "success"
    );

    window.scrollTo({
      top: document.getElementById("produtoForm").offsetTop - 20,
      behavior: "smooth"
    });
  } catch (error) {
    mostrarMensagemMl(error.message, "error");
  } finally {
    mlImportButton.disabled = false;
    mlImportButton.textContent = "Buscar produto";
  }
}

function preencherFormularioMl(product) {
  document.getElementById("produtoId").value = "";
  document.getElementById("title").value = product.title || "";
  document.getElementById("description").value = product.description || "";
  document.getElementById("price").value =
    product.price == null ? "" : numeroParaCampo(product.price);
  document.getElementById("old_price").value =
    product.old_price == null ? "" : numeroParaCampo(product.old_price);

  const category = document.getElementById("category");
  if (category) {
    const matched = [...category.options].find(option =>
      normalizarMl(option.value).includes(normalizarMl(product.category)) ||
      normalizarMl(product.category).includes(normalizarMl(option.value))
    );

    category.value = matched ? matched.value : "Outros";
  }

  const marketplace = document.getElementById("marketplace");
  if (marketplace) marketplace.value = "Mercado Livre";

  const productType = document.getElementById("product_type");
  if (productType) {
    productType.value = "affiliate";
    productType.dispatchEvent(new Event("change"));
  }

  document.getElementById("affiliate_link").value = "";
  document.getElementById("featured").checked = false;
  document.getElementById("active").checked = true;

  arquivosSelecionados.forEach(item => URL.revokeObjectURL(item.preview));
  arquivosSelecionados = [];
  imagensExistentes = Array.isArray(product.images)
    ? product.images.slice(0, 5)
    : [];

  renderizarPreviews();

  tituloFormulario.textContent = "Produto importado — confira e salve";
  botaoCancelar.classList.remove("hidden");
}

function normalizarMl(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function mostrarMensagemMl(text, type) {
  mlImportMessage.className = `message ${type}`;
  mlImportMessage.textContent = text;
}

function esconderMensagemMl() {
  mlImportMessage.className = "message hidden";
  mlImportMessage.textContent = "";
}
