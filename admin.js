const form = document.getElementById("produtoForm");
const lista = document.getElementById("listaProdutosAdmin");
const buscaAdmin = document.getElementById("buscaAdmin");
const botaoAtualizar = document.getElementById("atualizarLista");
const botaoCancelar = document.getElementById("cancelarEdicao");
const botaoSalvar = document.getElementById("salvarProduto");
const tituloFormulario = document.getElementById("tituloFormulario");
const formMensagem = document.getElementById("formMensagem");

let produtosAdmin = [];

document.addEventListener("DOMContentLoaded", carregarProdutosAdmin);
form.addEventListener("submit", salvarProduto);
buscaAdmin.addEventListener("input", renderizarListaAdmin);
botaoAtualizar.addEventListener("click", carregarProdutosAdmin);
botaoCancelar.addEventListener("click", limparFormulario);

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
  const produto = {
    title: document.getElementById("title").value.trim(),
    description: document.getElementById("description").value.trim() || null,
    price: converterNumero(document.getElementById("price").value),
    old_price: converterNumero(document.getElementById("old_price").value),
    category: document.getElementById("category").value.trim() || null,
    image_url: document.getElementById("image_url").value.trim(),
    affiliate_link: document.getElementById("affiliate_link").value.trim(),
    marketplace: document.getElementById("marketplace").value,
    featured: document.getElementById("featured").checked,
    active: document.getElementById("active").checked
  };

  let resposta;

  if (id) {
    resposta = await supabaseClient
      .from("products")
      .update(produto)
      .eq("id", id)
      .select()
      .single();
  } else {
    resposta = await supabaseClient
      .from("products")
      .insert(produto)
      .select()
      .single();
  }

  bloquearBotao(false);

  if (resposta.error) {
    console.error(resposta.error);
    mostrarMensagem("Erro ao salvar: " + resposta.error.message, "error");
    return;
  }

  mostrarMensagem(id ? "Produto atualizado com sucesso!" : "Produto adicionado com sucesso!", "success");
  limparFormulario(false);
  await carregarProdutosAdmin();
}

function renderizarListaAdmin() {
  const termo = buscaAdmin.value.trim().toLowerCase();

  const filtrados = produtosAdmin.filter(produto => {
    const texto = [
      produto.title,
      produto.category,
      produto.marketplace
    ].filter(Boolean).join(" ").toLowerCase();

    return texto.includes(termo);
  });

  if (!filtrados.length) {
    lista.innerHTML = `
      <div class="empty-admin">
        <strong>Nenhum produto cadastrado</strong>
        <span>Use o formulário para adicionar sua primeira oferta.</span>
      </div>
    `;
    return;
  }

  lista.innerHTML = filtrados.map(produto => `
    <article class="admin-product-card">
      <img
        src="${escaparAtributo(produto.image_url)}"
        alt="${escaparAtributo(produto.title)}"
        onerror="this.src='https://placehold.co/200x200?text=Sem+imagem'"
      >

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
    </article>
  `).join("");
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
  document.getElementById("image_url").value = produto.image_url || "";
  document.getElementById("affiliate_link").value = produto.affiliate_link || "";
  document.getElementById("marketplace").value = produto.marketplace || "Mercado Livre";
  document.getElementById("featured").checked = Boolean(produto.featured);
  document.getElementById("active").checked = Boolean(produto.active);

  tituloFormulario.textContent = "Editar produto";
  botaoSalvar.textContent = "Atualizar produto";
  botaoCancelar.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.excluirProduto = async function(id) {
  const produto = produtosAdmin.find(item => Number(item.id) === Number(id));
  const confirmar = window.confirm(`Excluir "${produto?.title || "este produto"}"?`);

  if (!confirmar) return;

  const { error } = await supabaseClient
    .from("products")
    .delete()
    .eq("id", id);

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

  if (apagarMensagem) esconderMensagem();
}

function atualizarEstatisticas() {
  document.getElementById("totalProdutos").textContent = produtosAdmin.length;
  document.getElementById("totalDestaques").textContent =
    produtosAdmin.filter(produto => produto.featured).length;

  const categorias = new Set(
    produtosAdmin.map(produto => produto.category).filter(Boolean)
  );

  document.getElementById("totalCategorias").textContent = categorias.size;
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
  return Number(valor).toFixed(2).replace(".", ",");
}

function formatarPreco(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "";
  return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function bloquearBotao(bloqueado) {
  botaoSalvar.disabled = bloqueado;
  botaoSalvar.textContent = bloqueado ? "Salvando..." :
    (document.getElementById("produtoId").value ? "Atualizar produto" : "Salvar produto");
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
