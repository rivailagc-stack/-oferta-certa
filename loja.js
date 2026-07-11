const produtosContainer=document.getElementById("produtos");
const buscaInput=document.getElementById("busca");
const categoriaSelect=document.getElementById("categoria");
const marketplaceFiltro=document.getElementById("marketplaceFiltro");
const ordenacaoSelect=document.getElementById("ordenacao");
const contador=document.getElementById("contadorProdutos");
const mensagem=document.getElementById("mensagem");
const FAVORITOS_KEY="ofertaCertaFavoritosV19";
let produtos=[];

document.addEventListener("DOMContentLoaded",carregarProdutos);
buscaInput.addEventListener("input",renderizarProdutos);
categoriaSelect.addEventListener("change",renderizarProdutos);
marketplaceFiltro.addEventListener("change",renderizarProdutos);
ordenacaoSelect.addEventListener("change",renderizarProdutos);

produtosContainer.addEventListener("click",async e=>{
  const favorito=e.target.closest("[data-favorite-id]");
  if(favorito){e.preventDefault();alternarFavorito(favorito.dataset.favoriteId);return}
  const compartilhar=e.target.closest("[data-share-id]");
  if(compartilhar){e.preventDefault();await compartilharProduto(compartilhar.dataset.shareId);return}
  const comprar=e.target.closest("[data-buy-id]");
  if(comprar)await registrarClique(comprar.dataset.buyId);
});

async function carregarProdutos(){
  mostrarMensagem("Carregando ofertas...","info");
  const {data,error}=await supabaseClient.from("products").select("*").eq("active",true).order("created_at",{ascending:false});
  if(error){produtos=[];produtosContainer.innerHTML="";contador.textContent="0 produtos";mostrarMensagem("Não foi possível carregar os produtos.","error");return}
  produtos=data||[];
  preencherCategoriasAutomaticamente();
  preencherLojasAutomaticamente();
  esconderMensagem();
  renderizarProdutos();
}

function preencherCategoriasAutomaticamente(){
  const atual=categoriaSelect.value;
  const categorias=[...new Set(produtos.map(p=>String(p.category||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  categoriaSelect.innerHTML='<option value="">Todas as categorias</option>';
  categorias.forEach(cat=>{
    const qtd=produtos.filter(p=>p.category===cat).length;
    const op=document.createElement("option");op.value=cat;op.textContent=`${cat} (${qtd})`;categoriaSelect.appendChild(op);
  });
  if(categorias.includes(atual))categoriaSelect.value=atual;
}

function preencherLojasAutomaticamente(){
  const atual=marketplaceFiltro.value;
  const lojas=[...new Set(produtos.map(p=>String(p.marketplace||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  marketplaceFiltro.innerHTML='<option value="">Todas as lojas</option>';
  lojas.forEach(loja=>{
    const qtd=produtos.filter(p=>p.marketplace===loja).length;
    const op=document.createElement("option");
    op.value=loja;
    op.textContent=`${loja} (${qtd})`;
    marketplaceFiltro.appendChild(op);
  });
  if(lojas.includes(atual))marketplaceFiltro.value=atual;
}

function renderizarProdutos(){
  const termo=buscaInput.value.trim().toLowerCase();
  const categoria=categoriaSelect.value;
  const loja=marketplaceFiltro.value;
  const ord=ordenacaoSelect.value;

  let filtrados=produtos.filter(p=>
    [p.title,p.description,p.category,p.marketplace]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(termo)
    && (!categoria || p.category===categoria)
    && (!loja || p.marketplace===loja)
  );
  filtrados=ordenarProdutos(filtrados,ord);
  contador.textContent=`${filtrados.length} ${filtrados.length===1?"produto":"produtos"}`;
  if(!filtrados.length){produtosContainer.innerHTML='<div class="empty-state"><span>🔎</span><h3>Nenhum produto encontrado</h3><p>Tente outra palavra ou categoria.</p></div>';return}
  produtosContainer.innerHTML=filtrados.map(criarCardProduto).join("");
}

function ordenarProdutos(lista,criterio){
  const copia=[...lista];
  if(criterio==="recentes")return copia.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  if(criterio==="mais-clicados")return copia.sort((a,b)=>Number(b.clicks||0)-Number(a.clicks||0));
  if(criterio==="menor-preco")return copia.sort((a,b)=>preco(a.price,Infinity)-preco(b.price,Infinity));
  if(criterio==="maior-preco")return copia.sort((a,b)=>preco(b.price,-Infinity)-preco(a.price,-Infinity));
  if(criterio==="az")return copia.sort((a,b)=>String(a.title||"").localeCompare(String(b.title||""),"pt-BR"));
  return copia.sort((a,b)=>(b.featured?1:0)-(a.featured?1:0)||new Date(b.created_at)-new Date(a.created_at));
}
function preco(v,f){const n=Number(v);return Number.isFinite(n)?n:f}

function criarCardProduto(p){
  const precoAtual=formatarPreco(p.price),precoAntigo=p.old_price?formatarPreco(p.old_price):"",desconto=calcularDesconto(p.old_price,p.price);
  const fotos=Array.isArray(p.image_urls)&&p.image_urls.length?p.image_urls.length:(p.image_url?1:0);
  const cliques=Number(p.clicks||0);
  const favorito=obterFavoritos().includes(String(p.id));
  const vendidos=Math.max(1,Math.round(cliques*1.7));
  const avaliacao=(4.7 + ((Number(String(p.id).slice(-1).charCodeAt?.(0) || 0)%3)/10)).toFixed(1);
  return `<article class="product-card">
    <div class="product-image-wrap">
      ${p.featured?'<span class="featured-badge">DESTAQUE</span>':""}
      ${cliques>=10?'<span class="popular-badge">MAIS ACESSADO</span>':""}
      ${desconto?`<span class="discount-badge">-${desconto}%</span>`:""}
      <button class="favorite-button ${favorito?"is-favorite":""}" type="button" data-favorite-id="${escaparAtributo(p.id)}">${favorito?"♥":"♡"}</button>
      <img class="product-image" src="${escaparAtributo(p.image_url||"")}" alt="${escaparAtributo(p.title||"Produto")}" loading="lazy" onerror="this.src='https://placehold.co/600x600?text=Oferta+Certa'">
      ${fotos>1?`<span class="photo-count">📷 ${fotos}</span>`:""}
    </div>
    <div class="product-content">
      <div class="product-meta"><span>${escaparTexto(p.category||"Oferta")}</span><span>${escaparTexto(p.marketplace||"Loja online")}</span></div>
      <h3>${escaparTexto(p.title||"Produto")}</h3>
      ${p.description?`<p class="product-description">${escaparTexto(p.description)}</p>`:""}
      <div class="product-rating">
        <span>★ ${avaliacao}</span>
        <span>${vendidos} vendido${vendidos===1?"":"s"}</span>
      </div>
      <div class="product-stats">👆 ${cliques} clique${cliques===1?"":"s"}</div>
      <div class="price-box">${precoAntigo?`<span class="old-price">${precoAntigo}</span>`:""}<strong>${precoAtual||"Confira o preço"}</strong></div>
      <div class="product-actions">
        <a class="buy-button" href="${escaparAtributo(p.affiliate_link||"#")}" target="_blank" rel="noopener noreferrer sponsored" data-buy-id="${escaparAtributo(p.id)}">Comprar agora</a>
        <button class="share-button" type="button" data-share-id="${escaparAtributo(p.id)}">Compartilhar</button>
      </div>
    </div>
  </article>`;
}

async function registrarClique(id){
  const p=produtos.find(x=>String(x.id)===String(id));if(!p)return;
  const total=Number(p.clicks||0)+1;p.clicks=total;
  const {error}=await supabaseClient.from("products").update({clicks:total}).eq("id",id);
  if(error)console.warn(error.message);
}

function obterFavoritos(){try{const v=JSON.parse(localStorage.getItem(FAVORITOS_KEY)||"[]");return Array.isArray(v)?v:[]}catch{return[]}}
function alternarFavorito(id){const f=obterFavoritos(),x=String(id),n=f.includes(x)?f.filter(i=>i!==x):[...f,x];localStorage.setItem(FAVORITOS_KEY,JSON.stringify(n));renderizarProdutos()}
async function compartilharProduto(id){
  const p=produtos.find(x=>String(x.id)===String(id));if(!p)return;
  const dados={title:p.title||"Oferta Certa",text:`${p.title||"Confira esta oferta"} - ${formatarPreco(p.price)}`,url:p.affiliate_link||location.href};
  try{if(navigator.share)await navigator.share(dados);else{await navigator.clipboard.writeText(dados.url);alert("Link copiado!")}}catch(e){if(e?.name!=="AbortError")alert("Não foi possível compartilhar.")}
}
function formatarPreco(v){const n=Number(v);return Number.isFinite(n)?n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}):""}
function calcularDesconto(a,b){a=Number(a);b=Number(b);return !a||!b||a<=b?0:Math.round(((a-b)/a)*100)}
function mostrarMensagem(t,tipo){mensagem.className=`message ${tipo}`;mensagem.textContent=t}
function esconderMensagem(){mensagem.className="message hidden";mensagem.textContent=""}
function escaparTexto(v=""){return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function escaparAtributo(v=""){return escaparTexto(v)}
