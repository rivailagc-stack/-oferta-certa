const produtosContainer=document.getElementById("produtos");
const buscaInput=document.getElementById("busca");
const categoriaSelect=document.getElementById("categoria");
const ordenacaoSelect=document.getElementById("ordenacao");
const contador=document.getElementById("contadorProdutos");
const mensagem=document.getElementById("mensagem");

const produtoModal=document.getElementById("produtoModal");
const modalImagemPrincipal=document.getElementById("modalImagemPrincipal");
const modalMiniaturas=document.getElementById("modalMiniaturas");
const modalCategoria=document.getElementById("modalCategoria");
const modalTitulo=document.getElementById("modalTitulo");
const modalDescricao=document.getElementById("modalDescricao");
const modalPrecoAnterior=document.getElementById("modalPrecoAnterior");
const modalPreco=document.getElementById("modalPreco");
const modalLoja=document.getElementById("modalLoja");
const modalCliques=document.getElementById("modalCliques");
const modalComprar=document.getElementById("modalComprar");
const modalVariacoes=document.getElementById("modalVariacoes");
const modalCorBox=document.getElementById("modalCorBox");
const modalCor=document.getElementById("modalCor");
const modalTamanhoBox=document.getElementById("modalTamanhoBox");
const modalTamanho=document.getElementById("modalTamanho");
const modalDivulgar=document.getElementById("modalDivulgar");
let produtoModalAtual=null;

const abrirCarrinho=document.getElementById("abrirCarrinho");
const cartDrawer=document.getElementById("cartDrawer");
const cartItems=document.getElementById("cartItems");
const cartCount=document.getElementById("cartCount");
const cartSubtotal=document.getElementById("cartSubtotal");
const cartShipping=document.getElementById("cartShipping");
const cartTotal=document.getElementById("cartTotal");
const finalizarCompra=document.getElementById("finalizarCompra");
const shippingCep=document.getElementById("shippingCep");
const calcularFrete=document.getElementById("calcularFrete");
const shippingMessage=document.getElementById("shippingMessage");
const shippingOptions=document.getElementById("shippingOptions");

const FAVORITOS_KEY="ofertaCertaFavoritosV24";
const CARRINHO_KEY="ofertaCertaCarrinhoV24";
const FRETE_KEY="ofertaCertaFreteV26";
const RETIRADA_SERVICE_ID=999999;
const RETIRADA_OPTION={
  service_id:RETIRADA_SERVICE_ID,
  name:"Retirada no local",
  company:"Oferta Certa",
  price:0,
  delivery_time:0,
  postal_code:"",
  pickup:true
};
let produtos=[];
let freteSelecionado=null;

document.addEventListener("DOMContentLoaded",async()=>{
  await carregarProdutos();
  const freteSalvo=obterFreteSalvo();
  if(freteSalvo?.postal_code)shippingCep.value=freteSalvo.postal_code;
  freteSelecionado=Number(freteSalvo?.service_id)===RETIRADA_SERVICE_ID
    ? RETIRADA_OPTION
    : null;
  window.__shippingQuotes=[];
  atualizarCarrinho();
  renderizarOpcoesFrete([]);
});

buscaInput.addEventListener("input",renderizarProdutos);
categoriaSelect.addEventListener("change",renderizarProdutos);
ordenacaoSelect.addEventListener("change",renderizarProdutos);
abrirCarrinho.addEventListener("click",abrirCarrinhoLateral);
finalizarCompra.addEventListener("click",iniciarCheckout);
calcularFrete.addEventListener("click",calcularFreteCarrinho);
modalDivulgar?.addEventListener("click",()=>produtoModalAtual&&divulgarProduto(produtoModalAtual));
shippingCep.addEventListener("input",formatarCep);
shippingCep.addEventListener("keydown",e=>{if(e.key==="Enter")calcularFreteCarrinho()});

document.addEventListener("click",e=>{
  if(e.target.closest("[data-close-modal]"))fecharProduto();
  if(e.target.closest("[data-close-cart]"))fecharCarrinho();

  const favorito=e.target.closest("[data-favorite-id]");
  if(favorito){e.preventDefault();alternarFavorito(favorito.dataset.favoriteId)}

  const detalhes=e.target.closest("[data-details-id]");
  if(detalhes){e.preventDefault();abrirProduto(detalhes.dataset.detailsId)}

  const comprar=e.target.closest("[data-buy-id]");
  if(comprar)registrarClique(comprar.dataset.buyId);

  const compartilhar=e.target.closest("[data-share-id]");
  if(compartilhar){e.preventDefault();const p=produtos.find(x=>String(x.id)===String(compartilhar.dataset.shareId));if(p)divulgarProduto(p)}

  const adicionar=e.target.closest("[data-add-cart-id]");
  if(adicionar){e.preventDefault();adicionarAoCarrinho(adicionar.dataset.addCartId)}

  const diminuir=e.target.closest("[data-cart-minus]");
  if(diminuir)alterarQuantidade(diminuir.dataset.cartMinus,-1);

  const aumentar=e.target.closest("[data-cart-plus]");
  if(aumentar)alterarQuantidade(aumentar.dataset.cartPlus,1);

  const remover=e.target.closest("[data-cart-remove]");
  if(remover)removerDoCarrinho(remover.dataset.cartRemove);
});

document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){fecharProduto();fecharCarrinho()}
});

async function carregarProdutos(){
  mostrarMensagem("Carregando ofertas...","info");
  const {data,error}=await supabaseClient.from("products").select("*").eq("active",true).order("created_at",{ascending:false});
  if(error){
    produtos=[];
    produtosContainer.innerHTML="";
    contador.textContent="0 produtos";
    mostrarMensagem("Não foi possível carregar os produtos.","error");
    return;
  }
  produtos=data||[];
  preencherCategorias();
  esconderMensagem();
  renderizarProdutos();
}

function preencherCategorias(){
  const atual=categoriaSelect.value;
  const categorias=[...new Set(produtos.map(p=>String(p.category||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  categoriaSelect.innerHTML='<option value="">Todas as categorias</option>';
  categorias.forEach(cat=>{
    const qtd=produtos.filter(p=>p.category===cat).length;
    const op=document.createElement("option");
    op.value=cat;op.textContent=`${cat} (${qtd})`;
    categoriaSelect.appendChild(op);
  });
  if(categorias.includes(atual))categoriaSelect.value=atual;
}

function renderizarProdutos(){
  const termo=buscaInput.value.trim().toLowerCase();
  const categoria=categoriaSelect.value;
  const criterio=ordenacaoSelect.value;

  let lista=produtos.filter(p=>
    [p.title,p.description,p.category,p.marketplace]
      .filter(Boolean).join(" ").toLowerCase().includes(termo)
    && (!categoria||p.category===categoria)
  );

  lista=ordenarProdutos(lista,criterio);
  contador.textContent=`${lista.length} ${lista.length===1?"produto":"produtos"}`;

  produtosContainer.innerHTML=lista.length
    ? lista.map(criarCardProduto).join("")
    : '<div class="empty-state"><span>🔎</span><h3>Nenhum produto encontrado</h3></div>';
}

function ordenarProdutos(lista,criterio){
  const copia=[...lista];
  if(criterio==="recentes")return copia.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  if(criterio==="mais-clicados")return copia.sort((a,b)=>Number(b.clicks||0)-Number(a.clicks||0));
  if(criterio==="menor-preco")return copia.sort((a,b)=>numero(a.price,Infinity)-numero(b.price,Infinity));
  if(criterio==="maior-preco")return copia.sort((a,b)=>numero(b.price,-Infinity)-numero(a.price,-Infinity));
  if(criterio==="az")return copia.sort((a,b)=>String(a.title||"").localeCompare(String(b.title||""),"pt-BR"));
  return copia.sort((a,b)=>
    (ofertaAtiva(b)?1:0)-(ofertaAtiva(a)?1:0) ||
    (b.featured?1:0)-(a.featured?1:0) ||
    Number(b.clicks||0)-Number(a.clicks||0) ||
    new Date(b.created_at)-new Date(a.created_at)
  );
}

function criarCardProduto(p){
  const proprio=p.product_type==="own";
  const precoAtual=formatarPreco(p.price);
  const antigo=p.old_price?formatarPreco(p.old_price):"";
  const desconto=calcularDesconto(p.old_price,p.price);
  const fotos=Array.isArray(p.image_urls)&&p.image_urls.length?p.image_urls.length:(p.image_url?1:0);
  const favorito=obterFavoritos().includes(String(p.id));

  return `<article class="product-card">
    <div class="product-image-wrap">
      ${ofertaAtiva(p)?'<span class="flash-badge">OFERTA RELÂMPAGO</span>':(p.featured?'<span class="featured-badge">DESTAQUE</span>':"")}
      ${desconto?`<span class="discount-badge">-${desconto}%</span>`:""}
      ${proprio?'<span class="own-badge">VENDA DIRETA</span>':""}
      <button class="favorite-button ${favorito?"is-favorite":""}" type="button" data-favorite-id="${esc(p.id)}">${favorito?"♥":"♡"}</button>
      <button class="product-image-button" type="button" data-details-id="${esc(p.id)}">
        <img class="product-image" src="${esc(p.image_url||"")}" alt="${esc(p.title||"Produto")}" loading="lazy">
      </button>
      ${fotos>1?`<span class="photo-count">📷 ${fotos}</span>`:""}
    </div>
    <div class="product-content">
      <div class="product-meta"><span>${texto(p.category||"Oferta")}</span><span>${proprio?"Oferta Certa":texto(p.marketplace||"Loja")}</span></div>
      <button class="product-title-button" type="button" data-details-id="${esc(p.id)}"><h3>${texto(p.title||"Produto")}</h3></button>
      <div class="price-box">${antigo?`<span class="old-price">${antigo}</span>`:""}<strong>${precoAtual||"Confira o preço"}</strong></div>
      <button class="share-product-button" type="button" data-share-id="${esc(p.id)}">📣 Divulgar</button>
      ${proprio
        ? `<button class="buy-button" type="button" data-details-id="${esc(p.id)}" ${Number(p.stock||0)<=0?"disabled":""}>${Number(p.stock||0)>0?"Escolher e comprar":"Sem estoque"}</button>`
        : `<a class="buy-button affiliate-buy-button" href="${esc(p.affiliate_link||"#")}" target="_blank" rel="noopener noreferrer sponsored" data-buy-id="${esc(p.id)}">Ver oferta no ${texto(p.marketplace||"marketplace")}</a>`
      }
    </div>
  </article>`;
}

function abrirProduto(id){
  const p=produtos.find(x=>String(x.id)===String(id));if(!p)return;
  produtoModalAtual=p;
  const proprio=p.product_type==="own";
  const imagens=Array.isArray(p.image_urls)&&p.image_urls.length?p.image_urls.filter(Boolean):(p.image_url?[p.image_url]:[]);

  modalImagemPrincipal.src=imagens[0]||"https://placehold.co/700x700?text=Oferta+Certa";
  modalCategoria.textContent=p.category||"Oferta";
  modalTitulo.textContent=p.title||"Produto";
  modalDescricao.textContent=p.description||"Confira os detalhes deste produto.";
  modalPreco.textContent=formatarPreco(p.price)||"Confira o preço";
  modalPrecoAnterior.textContent=p.old_price?formatarPreco(p.old_price):"";

  const obsAntiga=document.getElementById("priceDisclaimer");
  if(obsAntiga)obsAntiga.remove();

  if(!proprio){
    const obs=document.createElement("small");
    obs.id="priceDisclaimer";
    obs.className="price-disclaimer";
    obs.textContent="Preço informado no cadastro. Confirme o valor atual no marketplace.";
    modalPreco.parentElement.appendChild(obs);
  }
  modalLoja.textContent=proprio
    ?"Vendido diretamente pela Oferta Certa"
    :`Oferta disponível no ${p.marketplace||"marketplace"}`;

  modalCliques.textContent=proprio
    ?`${Number(p.stock||0)} em estoque`
    :`${Number(p.clicks||0)} clique${Number(p.clicks||0)===1?"":"s"}`;

  const cores=normalizarOpcoes(p.colors);
  const tamanhos=normalizarOpcoes(p.sizes);
  preencherVariacao(modalCorBox,modalCor,cores,"Selecione a cor");
  preencherVariacao(modalTamanhoBox,modalTamanho,tamanhos,"Selecione a variação");
  modalVariacoes.classList.toggle("hidden",!proprio||(!cores.length&&!tamanhos.length));

  const avisoAntigo=document.getElementById("affiliateNotice");
  if(avisoAntigo)avisoAntigo.remove();

  document.getElementById("modalComprar").outerHTML=proprio
    ? `<button id="modalComprar" class="buy-button modal-buy-button" type="button" data-add-cart-id="${esc(p.id)}">Adicionar ao carrinho</button>`
    : `<div id="affiliateNotice" class="affiliate-notice">
         <strong>Compra realizada no ${texto(p.marketplace||"marketplace")}</strong>
         <span>Preço, estoque, frete e parcelamento podem mudar.</span>
         <span>Confira as condições na página oficial antes de finalizar.</span>
       </div>
       <a id="modalComprar" class="buy-button modal-buy-button affiliate-buy-button" href="${esc(p.affiliate_link||"#")}" target="_blank" rel="noopener noreferrer sponsored" data-buy-id="${esc(p.id)}">Ver oferta no ${texto(p.marketplace||"marketplace")}</a>`;

  modalMiniaturas.innerHTML=imagens.map((url,i)=>`<button type="button" class="modal-thumbnail ${i===0?"active":""}" data-thumb-url="${esc(url)}"><img src="${esc(url)}" alt="Foto ${i+1}"></button>`).join("");
  modalMiniaturas.querySelectorAll("[data-thumb-url]").forEach(botao=>botao.addEventListener("click",()=>{
    modalImagemPrincipal.src=botao.dataset.thumbUrl;
    modalMiniaturas.querySelectorAll(".modal-thumbnail").forEach(x=>x.classList.remove("active"));
    botao.classList.add("active");
  }));

  produtoModal.classList.remove("hidden");
  produtoModal.setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");
}

function fecharProduto(){
  produtoModal.classList.add("hidden");
  produtoModal.setAttribute("aria-hidden","true");
  document.body.classList.remove("modal-open");
}

function obterCarrinho(){
  try{const c=JSON.parse(localStorage.getItem(CARRINHO_KEY)||"[]");return Array.isArray(c)?c:[]}catch{return[]}
}

function salvarCarrinho(carrinho){
  localStorage.setItem(CARRINHO_KEY,JSON.stringify(carrinho));
  limparFreteSelecionado();
  atualizarCarrinho();
}

function adicionarAoCarrinho(id){
  const produto=produtos.find(p=>String(p.id)===String(id)&&p.product_type==="own");
  if(!produto||Number(produto.stock||0)<=0)return;
  const cores=normalizarOpcoes(produto.colors);
  const tamanhos=normalizarOpcoes(produto.sizes);
  const color=produtoModalAtual&&String(produtoModalAtual.id)===String(id)?modalCor.value:"";
  const size=produtoModalAtual&&String(produtoModalAtual.id)===String(id)?modalTamanho.value:"";
  if(cores.length&&!color){alert("Escolha a cor antes de comprar.");return;}
  if(tamanhos.length&&!size){alert("Escolha a variação antes de comprar.");return;}
  const key=[id,color,size].join("::");

  const carrinho=obterCarrinho();
  const item=carrinho.find(x=>String(x.key||x.id)===String(key));
  if(item)item.quantity=Math.min(item.quantity+1,Number(produto.stock||0));
  else carrinho.push({id:String(id),key,color,size,quantity:1});

  salvarCarrinho(carrinho);
  fecharProduto();
  abrirCarrinhoLateral();
}

function alterarQuantidade(id,delta){
  const carrinho=obterCarrinho();
  const item=carrinho.find(x=>String(x.key||x.id)===String(id));
  const produto=produtos.find(p=>String(p.id)===String(item?.id));
  if(!item||!produto)return;
  item.quantity=Math.max(1,Math.min(item.quantity+delta,Number(produto.stock||1)));
  salvarCarrinho(carrinho);
}

function removerDoCarrinho(id){
  salvarCarrinho(obterCarrinho().filter(x=>String(x.key||x.id)!==String(id)));
}

function atualizarCarrinho(){
  const carrinho=obterCarrinho();
  const completos=carrinho.map(item=>{
    const produto=produtos.find(p=>String(p.id)===String(item.id));
    return produto?{...item,produto}:null;
  }).filter(Boolean);

  const quantidade=completos.reduce((s,x)=>s+x.quantity,0);
  const subtotal=completos.reduce((s,x)=>s+Number(x.produto.price||0)*x.quantity,0);
  const frete=freteSelecionado ? Number(freteSelecionado.price || 0) : 0;

  cartCount.textContent=quantidade;
  cartSubtotal.textContent=formatarPreco(subtotal);
  cartShipping.textContent=freteSelecionado
    ? (Number(freteSelecionado.service_id)===RETIRADA_SERVICE_ID
        ? "Retirada grátis"
        : formatarPreco(frete))
    : "Escolha a entrega";
  cartTotal.textContent=formatarPreco(subtotal+frete);
  finalizarCompra.disabled=!completos.length || !freteSelecionado;

  cartItems.innerHTML=completos.length?completos.map(x=>`
    <article class="cart-item">
      <img src="${esc(x.produto.image_url||"")}" alt="${esc(x.produto.title||"Produto")}">
      <div>
        <strong>${texto(x.produto.title||"Produto")}</strong>
        <span>${formatarPreco(x.produto.price)}</span>
        <div class="cart-qty">
          ${(x.color||x.size)?`<small>${x.color?`Cor: ${texto(x.color)}`:""}${x.color&&x.size?" • ":""}${x.size?texto(x.size):""}</small>`:""}
          <button type="button" data-cart-minus="${esc(x.key||x.id)}">−</button>
          <b>${x.quantity}</b>
          <button type="button" data-cart-plus="${esc(x.key||x.id)}">+</button>
          <button class="cart-remove" type="button" data-cart-remove="${esc(x.key||x.id)}">Remover</button>
        </div>
      </div>
    </article>
  `).join(""):'<div class="empty-cart">Seu carrinho está vazio.</div>';
}

function abrirCarrinhoLateral(){
  atualizarCarrinho();
  renderizarOpcoesFrete(window.__shippingQuotes||[]);
  if(!shippingMessage.textContent){
    shippingMessage.textContent="Selecione retirada grátis ou calcule a entrega pelo CEP.";
    shippingMessage.className="shipping-message";
  }
  cartDrawer.classList.remove("hidden");
  cartDrawer.setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");
}

function fecharCarrinho(){
  cartDrawer.classList.add("hidden");
  cartDrawer.setAttribute("aria-hidden","true");
  document.body.classList.remove("modal-open");
}

async function iniciarCheckout(){
  const items=obterCarrinho();
  if(!items.length)return;
  if(!freteSelecionado){
    alert("Calcule o frete e escolha uma opção antes de pagar.");
    return;
  }

  finalizarCompra.disabled=true;
  finalizarCompra.textContent="Abrindo Mercado Pago...";

  try{
    const resposta=await fetch("/api/create-preference",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        items,
        shipping:{
          postal_code:Number(freteSelecionado?.service_id)===RETIRADA_SERVICE_ID
            ? ""
            : shippingCep.value.replace(/\D/g,""),
          service_id:freteSelecionado?.service_id
        }
      })
    });

    const dados=await resposta.json();
    if(!resposta.ok)throw new Error(dados.error||"Falha ao criar pagamento.");
    window.location.href=dados.init_point;
  }catch(error){
    alert("Não foi possível abrir o Mercado Pago. " + error.message);
    finalizarCompra.disabled=false;
    finalizarCompra.textContent="Pagar com Mercado Pago";
  }
}

async function registrarClique(id){
  const p=produtos.find(x=>String(x.id)===String(id));if(!p)return;
  const total=Number(p.clicks||0)+1;p.clicks=total;
  await supabaseClient.from("products").update({clicks:total}).eq("id",id);
}


function formatarCep(){
  const numeros=shippingCep.value.replace(/\D/g,"").slice(0,8);
  shippingCep.value=numeros.length>5
    ? `${numeros.slice(0,5)}-${numeros.slice(5)}`
    : numeros;
}

function obterFreteSalvo(){
  try{
    const valor=JSON.parse(localStorage.getItem(FRETE_KEY)||"null");
    return valor&&typeof valor==="object"?valor:null;
  }catch{return null}
}

function salvarFreteSelecionado(opcao){
  freteSelecionado=opcao;
  localStorage.setItem(FRETE_KEY,JSON.stringify(opcao));
  atualizarCarrinho();
  renderizarOpcoesFrete(window.__shippingQuotes||[]);
}

function limparFreteSelecionado(){
  freteSelecionado=null;
  localStorage.removeItem(FRETE_KEY);
  window.__shippingQuotes=[];
  renderizarOpcoesFrete([]);
  shippingMessage.textContent="Selecione retirada grátis ou calcule a entrega pelo CEP.";
  shippingMessage.className="shipping-message";
}

async function calcularFreteCarrinho(){
  const postalCode=shippingCep.value.replace(/\D/g,"");
  const items=obterCarrinho();

  if(postalCode.length!==8){
    renderizarOpcoesFrete(window.__shippingQuotes||[]);
    shippingMessage.textContent="Digite um CEP válido para entrega ou selecione Retirada no local.";
    shippingMessage.className="shipping-message error";
    return;
  }

  if(!items.length){
    shippingMessage.textContent="Adicione um produto ao carrinho.";
    shippingMessage.className="shipping-message error";
    return;
  }

  calcularFrete.disabled=true;
  calcularFrete.textContent="Calculando...";
  shippingMessage.textContent="Consultando transportadoras...";
  shippingMessage.className="shipping-message";
  shippingOptions.innerHTML="";

  try{
    const resposta=await fetch("/api/calculate-shipping",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({postal_code:postalCode,items})
    });

    const dados=await resposta.json();
    if(!resposta.ok)throw new Error(dados.error||"Não foi possível calcular o frete.");

    window.__shippingQuotes=dados.options||[];
    freteSelecionado=null;
    localStorage.removeItem(FRETE_KEY);

    if(!window.__shippingQuotes.length){
      shippingMessage.textContent="Nenhuma transportadora disponível. A retirada no local continua disponível.";
      shippingMessage.className="shipping-message error";
      renderizarOpcoesFrete([]);
      atualizarCarrinho();
      return;
    }

    shippingMessage.textContent="Escolha entrega ou retirada:";
    shippingMessage.className="shipping-message success";
    renderizarOpcoesFrete(window.__shippingQuotes);
    atualizarCarrinho();
  }catch(error){
    shippingMessage.textContent=error.message;
    shippingMessage.className="shipping-message error";
  }finally{
    calcularFrete.disabled=false;
    calcularFrete.textContent="Calcular";
  }
}

function renderizarOpcoesFrete(opcoes){
  const transportadoras=Array.isArray(opcoes)?opcoes:[];
  const todas=[
    RETIRADA_OPTION,
    ...transportadoras.filter(
      opcao=>Number(opcao.service_id)!==RETIRADA_SERVICE_ID
    )
  ];

  shippingOptions.innerHTML=todas.map(opcao=>{
    const retirada=Number(opcao.service_id)===RETIRADA_SERVICE_ID;

    return `
      <label class="shipping-option ${String(freteSelecionado?.service_id)===String(opcao.service_id)?"selected":""}">
        <input
          type="radio"
          name="shipping_option"
          value="${esc(opcao.service_id)}"
          ${String(freteSelecionado?.service_id)===String(opcao.service_id)?"checked":""}
        >
        <span>
          <strong>${retirada?"📍 ": ""}${texto(opcao.company)} — ${texto(opcao.name)}</strong>
          <small>${retirada
            ?"Endereço e horário combinados após a compra"
            :`${opcao.delivery_time} dia${Number(opcao.delivery_time)===1?"":"s"} úteis`
          }</small>
        </span>
        <b>${retirada?"Grátis":formatarPreco(opcao.price)}</b>
      </label>
    `;
  }).join("");

  shippingOptions.querySelectorAll('input[name="shipping_option"]').forEach(input=>{
    input.addEventListener("change",()=>{
      const opcao=todas.find(
        item=>String(item.service_id)===String(input.value)
      );

      if(opcao){
        salvarFreteSelecionado(opcao);

        if(Number(opcao.service_id)===RETIRADA_SERVICE_ID){
          shippingMessage.textContent="Retirada no local selecionada. O endereço e o horário serão combinados após o pagamento.";
          shippingMessage.className="shipping-message success";
        }
      }
    });
  });
}

function obterFavoritos(){try{const v=JSON.parse(localStorage.getItem(FAVORITOS_KEY)||"[]");return Array.isArray(v)?v:[]}catch{return[]}}
function alternarFavorito(id){const f=obterFavoritos(),x=String(id),n=f.includes(x)?f.filter(i=>i!==x):[...f,x];localStorage.setItem(FAVORITOS_KEY,JSON.stringify(n));renderizarProdutos()}
function numero(v,f){const n=Number(v);return Number.isFinite(n)?n:f}
function formatarPreco(v){const n=Number(v);return Number.isFinite(n)?n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}):""}
function calcularDesconto(a,b){a=Number(a);b=Number(b);return !a||!b||a<=b?0:Math.round(((a-b)/a)*100)}
function mostrarMensagem(t,tipo){mensagem.className=`message ${tipo}`;mensagem.textContent=t}
function esconderMensagem(){mensagem.className="message hidden";mensagem.textContent=""}
function texto(v=""){return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function esc(v=""){return texto(v)}

function normalizarOpcoes(valor){
  if(Array.isArray(valor))return valor.map(String).map(x=>x.trim()).filter(Boolean);
  return String(valor||"").split(/[,;\n]/).map(x=>x.trim()).filter(Boolean);
}
function preencherVariacao(box,select,opcoes,placeholder){
  box.classList.toggle("hidden",!opcoes.length);
  select.innerHTML=`<option value="">${placeholder}</option>`+opcoes.map(x=>`<option value="${esc(x)}">${texto(x)}</option>`).join("");
}
function ofertaAtiva(p){
  if(!p.flash_sale)return false;
  return !p.flash_sale_end_at||new Date(p.flash_sale_end_at)>new Date();
}
async function divulgarProduto(p){
  const url=new URL(window.location.href);url.searchParams.set("produto",p.id);url.hash="produtos";
  const preco=formatarPreco(p.price);
  const mensagem=`🔥 ${p.title}\n${preco?`Por ${preco}\n`:""}Confira a oferta: ${url.href}`;
  if(navigator.share){try{await navigator.share({title:p.title,text:mensagem,url:url.href});return}catch(e){if(e.name==="AbortError")return}}
  try{await navigator.clipboard.writeText(mensagem);alert("Texto e link copiados. Agora é só colar no WhatsApp, Instagram, Facebook ou TikTok.")}catch{window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`,"_blank")}
}
setTimeout(()=>{const id=new URLSearchParams(location.search).get("produto");if(id&&produtos.some(p=>String(p.id)===String(id)))abrirProduto(id)},800);
