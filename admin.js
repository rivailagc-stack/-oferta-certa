const form = document.getElementById("produtoForm");
const lista = document.getElementById("listaProdutosAdmin");
const buscaAdmin = document.getElementById("buscaAdmin");
const botaoAtualizar = document.getElementById("atualizarLista");
const botaoCancelar = document.getElementById("cancelarEdicao");
const botaoSalvar = document.getElementById("salvarProduto");
const tituloFormulario = document.getElementById("tituloFormulario");
const formMensagem = document.getElementById("formMensagem");

const imageFileInput = document.getElementById("image_file");
const imageUrlInput = document.getElementById("image_url");
const imagePreviewWrap = document.getElementById("imagePreviewWrap");
const imagePreview = document.getElementById("imagePreview");
const removerImagemButton = document.getElementById("removerImagem");

const STORAGE_BUCKET = "products";
let produtosAdmin = [];
let arquivoImagemSelecionado = null;
let imagemAtualUrl = "";

document.addEventListener("DOMContentLoaded", carregarProdutosAdmin);
form.addEventListener("submit", salvarProduto);
buscaAdmin.addEventListener("input", renderizarListaAdmin);
botaoAtualizar.addEventListener("click", carregarProdutosAdmin);
botaoCancelar.addEventListener("click", () => limparFormulario());
imageFileInput.addEventListener("change", selecionarImagem);
removerImagemButton.addEventListener("click", removerImagemSelecionada);

async function selecionarImagem(event) {
  const arquivo = event.target.files?.[0];
  if (!arquivo) return;

  if (!arquivo.type.startsWith("image/")) {
    mostrarMensagem("Escolha uma imagem válida.", "error");
    imageFileInput.value = "";
    return;
  }

  if (arquivo.size > 8 * 1024 * 1024) {
    mostrarMensagem("A imagem deve ter no máximo 8 MB.", "error");
    imageFileInput.value = "";
    return;
  }

  try {
    arquivoImagemSelecionado = await comprimirImagem(arquivo);
    mostrarPreview(URL.createObjectURL(arquivoImagemSelecionado));
    esconderMensagem();
  } catch (error) {
    console.error(error);
    mostrarMensagem("Não foi possível preparar a imagem.", "error");
  }
}

async function comprimirImagem(arquivo) {
  const imagem = await carregarImagemLocal(arquivo);
  const limite = 1400;
  const proporcao = Math.min(1, limite / Math.max(imagem.width, imagem.height));
  const largura = Math.max(1, Math.round(imagem.width * proporcao));
  const altura = Math.max(1, Math.round(imagem.height * proporcao));

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  canvas.getContext("2d").drawImage(imagem, 0, 0, largura, altura);

  const tipo = arquivo.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      resultado => resultado ? resolve(resultado) : reject(new Error("Falha ao comprimir")),
      tipo,
      tipo === "image/png" ? undefined : 0.82
    );
  });

  return new File(
    [blob],
    `produto-${Date.now()}.${tipo === "image/png" ? "png" : "jpg"}`,
    { type: tipo }
  );
}

function carregarImagemLocal(arquivo) {
  return new Promise((resolve, reject) => {
    const imagem = new Image();
    const url = URL.createObjectURL(arquivo);
    imagem.onload = () => {
      URL.revokeObjectURL(url);
      resolve(imagem);
    };
    imagem.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Imagem inválida"));
    };
    imagem.src = url;
  });
}

function mostrarPreview(url) {
  imagePreview.src = url;
  imagePreviewWrap.classList.remove("hidden");
}

function removerImagemSelecionada() {
  arquivoImagemSelecionado = null;
  imagemAtualUrl = "";
  imageUrlInput.value = "";
  imageFileInput.value = "";
  imagePreview.src = "";
  imagePreviewWrap.classList.add("hidden");
}

async function uploadImagem() {
  if (!arquivoImagemSelecionado) return imagemAtualUrl || imageUrlInput.value || "";

  const extensao = arquivoImagemSelecionado.name.split(".").pop()?.toLowerCase() || "jpg";
  const caminho = `catalogo/${Date.now()}-${crypto.randomUUID()}.${extensao}`;

  const { error } = await supabaseClient.storage
    .from(STORAGE_BUCKET)
    .upload(caminho, arquivoImagemSelecionado, {
      cacheControl: "3600",
      upsert: false,
      contentType: arquivoImagemSelecionado.type
    });

  if (error) throw error;

  const { data } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(caminho);
  if (!data?.publicUrl) throw new Error("Falha ao gerar o link da imagem.");
  return data.publicUrl;
}

async function carregarProdutosAdmin() {
  lista.innerHTML = '<div class="loading-admin">Carregando produtos...</div>';

  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    lista.innerHTML = '<div class="message error">Erro ao carregar os produtos.</div>';
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

  if (!arquivoImagemSelecionado && !imagemAtualUrl && !imageUrlInput.value) {
    bloquearBotao(false);
    mostrarMensagem("Escolha uma imagem para o produto.", "error");
    return;
  }

  try {
    botaoSalvar.textContent = arquivoImagemSelecionado ? "Enviando imagem..." : "Salvando...";
    const imageUrl = await uploadImagem();

    const produto = {
      title: document.getElementById("title").value.trim(),
      description: document.getElementById("description").value.trim() || null,
      price: converterNumero(document.getElementById("price").value),
      old_price: converterNumero(document.getElementById("old_price").value),
      category: document.getElementById("category").value.trim() || null,
      image_url: imageUrl,
      affiliate_link: document.getElementById("affiliate_link").value.trim(),
      marketplace: document.getElementById("marketplace").value,
      featured: document.getElementById("featured").checked,
      active: document.getElementById("active").checked
    };

    const resposta = id
      ? await supabaseClient.from("products").update(produto).eq("id", id).select().single()
      : await supabaseClient.from("products").insert(produto).select().single();

    if (resposta.error) throw resposta.error;

    mostrarMensagem(id ? "Produto atualizado com sucesso!" : "Produto adicionado com sucesso!", "success");
    limparFormulario(false);
    await carregarProdutosAdmin();
  } catch (error) {
    console.error(error);
    mostrarMensagem("Erro ao salvar: " + (error.message || "tente novamente"), "error");
  } finally {
    bloquearBotao(false);
  }
}

function renderizarListaAdmin() {
  const termo = buscaAdmin.value.trim().toLowerCase();
  const filtrados = produtosAdmin.filter(produto =>
    [produto.title, produto.category, produto.marketplace]
      .filter(Boolean).join(" ").toLowerCase().includes(termo)
  );

  if (!filtrados.length) {
    lista.innerHTML = `
      <div class="empty-admin">
        <strong>Nenhum produto cadastrado</strong>
        <span>Use o formulário para adicionar sua primeira oferta.</span>
      </div>`;
    return;
  }

  lista.innerHTML = filtrados.map(produto => `
    <article class="admin-product-card">
      <img src="${escaparAtributo(produto.image_url)}"
           alt="${escaparAtributo(produto.title)}"
           onerror="this.src='https://placehold.co/200x200?text=Sem+imagem'">
      <div class="admin-product-info">
        <div class="admin-tags">
          <span>${produto.active ? "Ativo" : "Inativo"}</span>
          ${produto.featured ? "<span>Destaque</span>" : ""}
        </div>
        <strong>${escaparTexto(produto.title)}</strong>
        <small>${escaparTexto(produto.category || "Sem categoria")} • ${formatarPreco(produto.price) || "Sem preço"}</small>
      </div>
      <div class="admin-actions">
        <button type="button" class="icon-button edit" onclick="editarProduto(${produto.id})">Editar</button>
        <button type="button" class="icon-button delete" onclick="excluirProduto(${produto.id})">Excluir</button>
      </div>
    </article>`).join("");
}

window.editarProduto = function(id) {
  const produto = produtosAdmin.find(item => Number(item.id) === Number(id));
  if (!produto) return;

  document.getElementById("produtoId").value = produto.id;
  document.getElementById("title").value = produto.title || "";
  document.getElementById("description").value = produto.description || "";
  document.getElementById("price").value = numeroParaCampo(produto.price);
  document.getElementById("old_price").value = numeroParaCampo(produto.old_price);
  document.getElementById("category").value = produto.category || "";
  document.getElementById("affiliate_link").value = produto.affiliate_link || "";
  document.getElementById("marketplace").value = produto.marketplace || "Mercado Livre";
  document.getElementById("featured").checked = Boolean(produto.featured);
  document.getElementById("active").checked = Boolean(produto.active);

  imagemAtualUrl = produto.image_url || "";
  imageUrlInput.value = imagemAtualUrl;
  arquivoImagemSelecionado = null;
  imageFileInput.value = "";
  if (imagemAtualUrl) mostrarPreview(imagemAtualUrl);

  tituloFormulario.textContent = "Editar produto";
  botaoSalvar.textContent = "Atualizar produto";
  botaoCancelar.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.excluirProduto = async function(id) {
  const produto = produtosAdmin.find(item => Number(item.id) === Number(id));
  if (!window.confirm(`Excluir "${produto?.title || "este produto"}"?`)) return;

  const { error } = await supabaseClient.from("products").delete().eq("id", id);
  if (error) {
    window.alert("Erro ao excluir: " + error.message);
    return;
  }

  await carregarProdutosAdmin();
};

function limparFormulario(apagarMensagem = true) {
  form.reset();
  document.getElementById("produtoId").value = "";
  document.getElementById("active").checked = true;
  document.getElementById("marketplace").value = "Mercado Livre";
  tituloFormulario.textContent = "Adicionar produto";
  botaoSalvar.textContent = "Salvar produto";
  botaoCancelar.classList.add("hidden");

  arquivoImagemSelecionado = null;
  imagemAtualUrl = "";
  imageUrlInput.value = "";
  imageFileInput.value = "";
  imagePreview.src = "";
  imagePreviewWrap.classList.add("hidden");

  if (apagarMensagem) esconderMensagem();
}

function atualizarEstatisticas() {
  document.getElementById("totalProdutos").textContent = produtosAdmin.length;
  document.getElementById("totalDestaques").textContent = produtosAdmin.filter(p => p.featured).length;
  document.getElementById("totalCategorias").textContent =
    new Set(produtosAdmin.map(p => p.category).filter(Boolean)).size;
}

function converterNumero(valor) {
  const limpo = String(valor || "").trim().replace(/\./g, "").replace(",", ".");
  if (!limpo) return null;
  const numero = Number(limpo);
  return Number.isFinite(numero) ? numero : null;
}

function numeroParaCampo(valor) {
  if (valor === null || valor === undefined || valor === "") return "";
  return Number(valor).toFixed(2).replace(".", ",");
}

function formatarPreco(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "";
  return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function bloquearBotao(bloqueado) {
  botaoSalvar.disabled = bloqueado;
  if (!bloqueado) {
    botaoSalvar.textContent =
      document.getElementById("produtoId").value ? "Atualizar produto" : "Salvar produto";
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
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escaparAtributo(valor = "") {
  return escaparTexto(valor);
}
