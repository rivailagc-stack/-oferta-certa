const form = document.getElementById("produtoForm");
const lista = document.getElementById("listaProdutosAdmin");
const buscaAdmin = document.getElementById("buscaAdmin");
const botaoAtualizar = document.getElementById("atualizarLista");
const botaoCancelar = document.getElementById("cancelarEdicao");
const botaoSalvar = document.getElementById("salvarProduto");
const tituloFormulario = document.getElementById("tituloFormulario");
const formMensagem = document.getElementById("formMensagem");
const imageFilesInput = document.getElementById("image_files");
const imagesPreview = document.getElementById("imagesPreview");
const productTypeSelect = document.getElementById("product_type");
const affiliateLinkField = document.getElementById("affiliateLinkField");
const marketplaceField = document.getElementById("marketplaceField");
const ownProductFields = document.querySelectorAll(".own-product-field");

const STORAGE_BUCKET = "products";
const MAX_IMAGES = 5;

let produtosAdmin = [];
let arquivosSelecionados = [];
let imagensExistentes = [];

document.addEventListener("DOMContentLoaded", carregarProdutosAdmin);
form.addEventListener("submit", salvarProduto);
buscaAdmin.addEventListener("input", renderizarListaAdmin);
botaoAtualizar.addEventListener("click", carregarProdutosAdmin);
botaoCancelar.addEventListener("click", () => limparFormulario());
imageFilesInput.addEventListener("change", selecionarImagens);
productTypeSelect.addEventListener("change", atualizarCamposTipoProduto);

lista.addEventListener("click", async (event) => {
  const botao = event.target.closest("button[data-action]");
  if (!botao) return;

  const id = botao.dataset.id;
  const acao = botao.dataset.action;

  if (acao === "edit") editarProduto(id);
  if (acao === "delete") await excluirProduto(id);
});

imagesPreview.addEventListener("click", (event) => {
  const botao = event.target.closest("button[data-preview-action]");
  if (!botao) return;

  const index = Number(botao.dataset.index);
  const acao = botao.dataset.previewAction;

  if (acao === "remove-existing") removerImagemExistente(index);
  if (acao === "remove-new") removerNovaImagem(index);
});

async function selecionarImagens(event) {
  const novosArquivos = Array.from(event.target.files || []);
  if (!novosArquivos.length) return;

  const total =
    imagensExistentes.length +
    arquivosSelecionados.length +
    novosArquivos.length;

  if (total > MAX_IMAGES) {
    mostrarMensagem("Você pode selecionar no máximo 5 fotos.", "error");
    imageFilesInput.value = "";
    return;
  }

  for (const arquivo of novosArquivos) {
    if (!arquivo.type.startsWith("image/")) {
      mostrarMensagem("Escolha somente arquivos de imagem.", "error");
      imageFilesInput.value = "";
      return;
    }

    if (arquivo.size > 8 * 1024 * 1024) {
      mostrarMensagem("Cada foto deve ter no máximo 8 MB.", "error");
      imageFilesInput.value = "";
      return;
    }

    arquivosSelecionados.push({
      file: arquivo,
      preview: URL.createObjectURL(arquivo)
    });
  }

  imageFilesInput.value = "";
  renderizarPreviews();
  esconderMensagem();
}

function renderizarPreviews() {
  const itens = [
    ...imagensExistentes.map((url, index) => ({
      url,
      tipo: "existente",
      index
    })),
    ...arquivosSelecionados.map((item, index) => ({
      url: item.preview,
      tipo: "nova",
      index
    }))
  ];

  imagesPreview.innerHTML = itens.map((item, posicao) => `
    <article class="preview-card">
      ${posicao === 0 ? '<span class="cover-label">CAPA</span>' : ""}
      <img src="${escaparAtributo(item.url)}" alt="Foto do produto">
      <button
        type="button"
        data-preview-action="${item.tipo === "existente" ? "remove-existing" : "remove-new"}"
        data-index="${item.index}"
      >
        Remover
      </button>
    </article>
  `).join("");
}

function removerImagemExistente(index) {
  imagensExistentes.splice(index, 1);
  renderizarPreviews();
}

function removerNovaImagem(index) {
  const item = arquivosSelecionados[index];

  if (item?.preview) {
    URL.revokeObjectURL(item.preview);
  }

  arquivosSelecionados.splice(index, 1);
  renderizarPreviews();
}

async function prepararImagemParaUpload(arquivo) {
  try {
    const imagem = await carregarImagem(arquivo);
    const limite = 1400;
    const proporcao = Math.min(
      1,
      limite / Math.max(imagem.width, imagem.height)
    );

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(imagem.width * proporcao));
    canvas.height = Math.max(1, Math.round(imagem.height * proporcao));

    canvas
      .getContext("2d")
      .drawImage(imagem, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        resultado =>
          resultado
            ? resolve(resultado)
            : reject(new Error("Falha ao converter imagem")),
        "image/jpeg",
        0.82
      );
    });

    return new File(
      [blob],
      `produto-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
      { type: "image/jpeg" }
    );
  } catch (error) {
    console.warn("Imagem enviada sem compressão:", error);
    return arquivo;
  }
}

function carregarImagem(arquivo) {
  return new Promise((resolve, reject) => {
    const imagem = new Image();
    const url = URL.createObjectURL(arquivo);

    imagem.onload = () => {
      URL.revokeObjectURL(url);
      resolve(imagem);
    };

    imagem.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Formato não compatível com compressão"));
    };

    imagem.src = url;
  });
}

async function uploadImagens() {
  const urls = [...imagensExistentes];

  for (const item of arquivosSelecionados) {
    const arquivo = await prepararImagemParaUpload(item.file);

    let extensao = arquivo.name.split(".").pop()?.toLowerCase() || "jpg";
    if (extensao === "jpeg") extensao = "jpg";

    const caminho =
      `catalogo/${Date.now()}-${crypto.randomUUID()}.${extensao}`;

    const { error } = await supabaseClient.storage
      .from(STORAGE_BUCKET)
      .upload(caminho, arquivo, {
        cacheControl: "3600",
        upsert: false,
        contentType: arquivo.type || "image/jpeg"
      });

    if (error) throw error;

    const { data } = supabaseClient.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(caminho);

    if (!data?.publicUrl) {
      throw new Error("Não foi possível gerar o link público da imagem.");
    }

    urls.push(data.publicUrl);
  }

  return urls.slice(0, MAX_IMAGES);
}

async function carregarProdutosAdmin() {
  lista.innerHTML =
    '<div class="loading-admin">Carregando produtos...</div>';

  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    lista.innerHTML = `
      <div class="message error">
        Erro ao carregar: ${escaparTexto(error.message)}
      </div>
    `;
    return;
  }

  produtosAdmin = data || [];
  atualizarEstatisticas();
  renderizarListaAdmin();
}

async function salvarProduto(event) {
  event.preventDefault();
  bloquearBotao(true);
  esconderMensagem();

  const id = document.getElementById("produtoId").value;

  if (imagensExistentes.length + arquivosSelecionados.length < 1) {
    bloquearBotao(false);
    mostrarMensagem("Escolha pelo menos uma foto.", "error");
    return;
  }

  try {
    botaoSalvar.textContent = "Enviando fotos...";

    const urls = await uploadImagens();

    const produto = {
      title: document.getElementById("title").value.trim(),
      description:
        document.getElementById("description").value.trim() || null,
      price: converterNumero(document.getElementById("price").value),
      old_price: converterNumero(document.getElementById("old_price").value),
      category: document.getElementById("category").value,
      image_url: urls[0],
      image_urls: urls,
      affiliate_link:
        document.getElementById("affiliate_link").value.trim(),
      marketplace: document.getElementById("marketplace").value,
      featured: document.getElementById("featured").checked,
      active: document.getElementById("active").checked
    };

    const resposta = id
      ? await supabaseClient
          .from("products")
          .update(produto)
          .eq("id", id)
          .select()
          .single()
      : await supabaseClient
          .from("products")
          .insert(produto)
          .select()
          .single();

    if (resposta.error) throw resposta.error;

    mostrarMensagem(
      id ? "Produto atualizado com sucesso!" : "Produto adicionado com sucesso!",
      "success"
    );

    limparFormulario(false);
    await carregarProdutosAdmin();
  } catch (error) {
    mostrarMensagem("Erro ao salvar: " + error.message, "error");
  } finally {
    bloquearBotao(false);
  }
}

function renderizarListaAdmin() {
  const termo = buscaAdmin.value.trim().toLowerCase();

  const filtrados = produtosAdmin.filter(produto =>
    [produto.title, produto.category, produto.marketplace]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(termo)
  );

  if (!filtrados.length) {
    lista.innerHTML = `
      <div class="empty-admin">
        <strong>Nenhum produto cadastrado</strong>
      </div>
    `;
    return;
  }

  lista.innerHTML = filtrados.map(produto => `
    <article class="admin-product-card">
      <img
        src="${escaparAtributo(produto.image_url || "")}"
        alt="${escaparAtributo(produto.title || "Produto")}"
        onerror="this.src='https://placehold.co/200x200?text=Sem+imagem'"
      >

      <div class="admin-product-info">
        <div class="admin-tags">
          <span>${produto.active ? "Ativo" : "Inativo"}</span>
          <span>
            ${(produto.image_urls || [produto.image_url]).filter(Boolean).length}
            foto(s)
          </span>
          <span>${produto.product_type === "own" ? "Produto próprio" : "Afiliado"}</span>
          <span>${Number(produto.clicks || 0)} clique(s)</span>
        </div>

        <strong>${escaparTexto(produto.title || "Sem nome")}</strong>

        <small>
          ${escaparTexto(produto.category || "Sem categoria")}
          •
          ${formatarPreco(produto.price) || "Sem preço"}
        </small>
      </div>

      <div class="admin-actions">
        <button
          type="button"
          class="icon-button edit"
          data-action="edit"
          data-id="${escaparAtributo(produto.id)}"
        >
          Editar
        </button>

        <button
          type="button"
          class="icon-button delete"
          data-action="delete"
          data-id="${escaparAtributo(produto.id)}"
        >
          Excluir
        </button>
      </div>
    </article>
  `).join("");
}

function editarProduto(id) {
  const produto = produtosAdmin.find(
    item => String(item.id) === String(id)
  );

  if (!produto) {
    window.alert("Produto não encontrado.");
    return;
  }

  document.getElementById("produtoId").value = produto.id;
  document.getElementById("title").value = produto.title || "";
  document.getElementById("description").value = produto.description || "";
  document.getElementById("price").value = numeroParaCampo(produto.price);
  document.getElementById("old_price").value =
    numeroParaCampo(produto.old_price);
  document.getElementById("category").value = produto.category || "";
  document.getElementById("affiliate_link").value =
    produto.affiliate_link || "";
  document.getElementById("marketplace").value =
    produto.marketplace || "Mercado Livre";
  document.getElementById("featured").checked =
    Boolean(produto.featured);
  document.getElementById("active").checked =
    Boolean(produto.active);

  imagensExistentes =
    Array.isArray(produto.image_urls) && produto.image_urls.length
      ? [...produto.image_urls]
      : produto.image_url
        ? [produto.image_url]
        : [];

  arquivosSelecionados.forEach(item => {
    if (item.preview) URL.revokeObjectURL(item.preview);
  });

  arquivosSelecionados = [];
  imageFilesInput.value = "";
  renderizarPreviews();

  tituloFormulario.textContent = "Editar produto";
  botaoSalvar.textContent = "Atualizar produto";
  botaoCancelar.classList.remove("hidden");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function excluirProduto(id) {
  const produto = produtosAdmin.find(
    item => String(item.id) === String(id)
  );

  const confirmado = window.confirm(
    `Excluir "${produto?.title || "este produto"}"?`
  );

  if (!confirmado) return;

  const { error } = await supabaseClient
    .from("products")
    .delete()
    .eq("id", id);

  if (error) {
    window.alert("Erro ao excluir: " + error.message);
    return;
  }

  produtosAdmin = produtosAdmin.filter(
    item => String(item.id) !== String(id)
  );

  atualizarEstatisticas();
  renderizarListaAdmin();
}

function limparFormulario(apagarMensagem = true) {
  form.reset();

  document.getElementById("produtoId").value = "";
  document.getElementById("active").checked = true;
  document.getElementById("marketplace").value = "Mercado Livre";

  arquivosSelecionados.forEach(item => {
    if (item.preview) URL.revokeObjectURL(item.preview);
  });

  arquivosSelecionados = [];
  imagensExistentes = [];
  imageFilesInput.value = "";
  imagesPreview.innerHTML = "";

  tituloFormulario.textContent = "Adicionar produto";
  botaoSalvar.textContent = "Salvar produto";
  botaoCancelar.classList.add("hidden");

  if (apagarMensagem) esconderMensagem();
}

function atualizarEstatisticas() {
  document.getElementById("totalProdutos").textContent =
    produtosAdmin.length;

  document.getElementById("totalDestaques").textContent =
    produtosAdmin.filter(produto => produto.featured).length;

  document.getElementById("totalCategorias").textContent =
    new Set(
      produtosAdmin.map(produto => produto.category).filter(Boolean)
    ).size;

  const totalCliques = produtosAdmin.reduce(
    (soma, produto) => soma + Number(produto.clicks || 0),
    0
  );

  const campoCliques = document.getElementById("totalCliques");
  if (campoCliques) campoCliques.textContent = totalCliques;
}

function converterNumero(valor) {
  const limpo = String(valor || "")
    .trim()
    .replace(/\./g, "")
    .replace(",", ".");

  if (!limpo) return null;

  const numero = Number(limpo);
  return Number.isFinite(numero) ? numero : null;
}

function numeroParaCampo(valor) {
  if (valor === null || valor === undefined || valor === "") return "";

  return Number(valor)
    .toFixed(2)
    .replace(".", ",");
}

function formatarPreco(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "";

  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function bloquearBotao(bloqueado) {
  botaoSalvar.disabled = bloqueado;

  if (!bloqueado) {
    botaoSalvar.textContent =
      document.getElementById("produtoId").value
        ? "Atualizar produto"
        : "Salvar produto";
  }
}

function mostrarMensagem(texto, tipo) {
  formMensagem.className = `message ${tipo}`;
  formMensagem.textContent = texto;
}

function esconderMensagem() {
  formMensagem.className = "message hidden";
  formMensagem.textContent = "";
}

function escaparTexto(valor = "") {
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escaparAtributo(valor = "") {
  return escaparTexto(valor);
}


function atualizarCamposTipoProduto() {
  const produtoProprio = productTypeSelect.value === "own";
  const affiliateInput = document.getElementById("affiliate_link");

  ownProductFields.forEach(campo => {
    campo.classList.toggle("hidden", !produtoProprio);
  });

  affiliateLinkField.classList.toggle("hidden", produtoProprio);
  marketplaceField.classList.toggle("hidden", produtoProprio);

  affiliateInput.required = !produtoProprio;
  document.getElementById("stock").required = produtoProprio;
}

atualizarCamposTipoProduto();
