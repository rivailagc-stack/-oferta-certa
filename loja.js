const produtosContainer = document.getElementById("produtos");
const buscaInput = document.getElementById("busca");
const categoriaSelect = document.getElementById("categoria");
const contador = document.getElementById("contadorProdutos");
const mensagem = document.getElementById("mensagem");

let produtos = [];

document.addEventListener("DOMContentLoaded", carregarProdutos);
buscaInput.addEventListener("input", renderizarProdutos);
categoriaSelect.addEventListener("change", renderizarProdutos);

async function carregarProdutos() {
  mostrarMensagem("Carregando ofertas...", "info");

  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("active", true)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    produtos = [];
    produtosContainer.innerHTML = "";
    contador.textContent = "0 produtos";
    mostrarMensagem("Não foi possível carregar os produtos. Verifique a conexão e as permissões do Supabase.", "error");
    return;
  }

  produtos = data || [];
  preencherCategorias();
  esconderMensagem();
  renderizarProdutos();
}

function preencherCategorias() {
  const categorias = [...new Set(
    produtos
      .map(produto => (produto.category || "").trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "pt-BR"));

  categoriaSelect.innerHTML = '<option value="">Todas as categorias</option>';

  categorias.forEach(categoria => {
    const option = document.createElement("option");
    option.value = categoria;
    option.textContent = categoria;
    categoriaSelect.appendChild(option);
  });
}

function renderizarProdutos() {
  const termo = buscaInput.value.trim().toLowerCase();
  const categoria = categoriaSelect.value;

  const filtrados = produtos.filter(produto => {
    const texto = [
      produto.title,
      produto.description,
      produto.category,
      produto.marketplace
    ].filter(Boolean).join(" ").toLowerCase();

    return texto.includes(termo) && (!categoria || produto.category === categoria);
  });

  contador.textContent = `${filtrados.length} ${filtrados.length === 1 ? "produto" : "produtos"}`;

  if (!filtrados.length) {
    produtosContainer.innerHTML = `
      <div class="empty-state">
        <span>🔎</span>
        <h3>Nenhum produto encontrado</h3>
        <p>Tente outra palavra ou categoria.</p>
      </div>
    `;
    return;
  }

  produtosContainer.innerHTML = filtrados.map(criarCardProduto).join("");
}

function criarCardProduto(produto) {
  const preco = formatarPreco(produto.price);
  const precoAntigo = produto.old_price ? formatarPreco(produto.old_price) : "";
  const desconto = calcularDesconto(produto.old_price, produto.price);

  return `
    <article class="product-card">
      <div class="product-image-wrap">
        ${produto.featured ? '<span class="featured-badge">DESTAQUE</span>' : ""}
        ${desconto ? `<span class="discount-badge">-${desconto}%</span>` : ""}
        <img
          class="product-image"
          src="${escaparAtributo(produto.image_url)}"
          alt="${escaparAtributo(produto.title)}"
          loading="lazy"
          onerror="this.src='https://placehold.co/600x600?text=Oferta+Certa'"
        >
      </div>

      <div class="product-content">
        <div class="product-meta">
          <span>${escaparTexto(produto.category || "Oferta")}</span>
          <span>${escaparTexto(produto.marketplace || "Loja online")}</span>
        </div>

        <h3>${escaparTexto(produto.title)}</h3>
        ${produto.description ? `<p class="product-description">${escaparTexto(produto.description)}</p>` : ""}

        <div class="price-box">
          ${precoAntigo ? `<span class="old-price">${precoAntigo}</span>` : ""}
          <strong>${preco || "Confira o preço"}</strong>
        </div>

        <a
          class="buy-button"
          href="${escaparAtributo(produto.affiliate_link)}"
          target="_blank"
          rel="noopener noreferrer sponsored"
        >
          Comprar agora
        </a>
      </div>
    </article>
  `;
}

function formatarPreco(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "";
  return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function calcularDesconto(precoAntigo, precoAtual) {
  const antigo = Number(precoAntigo);
  const atual = Number(precoAtual);
  if (!antigo || !atual || antigo <= atual) return 0;
  return Math.round(((antigo - atual) / antigo) * 100);
}

function mostrarMensagem(texto, tipo) {
  mensagem.className = `message ${tipo}`;
  mensagem.textContent = texto;
}

function esconderMensagem() {
  mensagem.className = "message hidden";
  mensagem.textContent = "";
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
