const form=document.getElementById("produtoForm");
const lista=document.getElementById("listaProdutosAdmin");
const buscaAdmin=document.getElementById("buscaAdmin");
const botaoAtualizar=document.getElementById("atualizarLista");
const botaoCancelar=document.getElementById("cancelarEdicao");
const botaoSalvar=document.getElementById("salvarProduto");
const tituloFormulario=document.getElementById("tituloFormulario");
const formMensagem=document.getElementById("formMensagem");
const imageFilesInput=document.getElementById("image_files");
const imagesPreview=document.getElementById("imagesPreview");
const STORAGE_BUCKET="products",MAX_IMAGES=5;
let produtosAdmin=[],arquivosSelecionados=[],imagensExistentes=[];

document.addEventListener("DOMContentLoaded",carregarProdutosAdmin);
form.addEventListener("submit",salvarProduto);
buscaAdmin.addEventListener("input",renderizarListaAdmin);
botaoAtualizar.addEventListener("click",carregarProdutosAdmin);
botaoCancelar.addEventListener("click",()=>limparFormulario());
imageFilesInput.addEventListener("change",selecionarImagens);

async function selecionarImagens(e){
  const novos=[...e.target.files];
  if(!novos.length)return;
  if(arquivosSelecionados.length+imagensExistentes.length+novos.length>MAX_IMAGES){
    mostrarMensagem("Máximo de 5 fotos por produto.","error"); imageFilesInput.value=""; return;
  }
  for(const a of novos){
    if(!a.type.startsWith("image/")){mostrarMensagem("Escolha apenas imagens.","error");return}
    if(a.size>8*1024*1024){mostrarMensagem("Cada foto deve ter no máximo 8 MB.","error");return}
  }
  for(const a of novos){
    const file=await comprimirImagem(a);
    arquivosSelecionados.push({file,preview:URL.createObjectURL(file)});
  }
  imageFilesInput.value="";renderizarPreviews();esconderMensagem();
}

async function comprimirImagem(a){
  const img=await carregarImagem(a),lim=1400,prop=Math.min(1,lim/Math.max(img.width,img.height));
  const c=document.createElement("canvas"); c.width=Math.round(img.width*prop); c.height=Math.round(img.height*prop);
  c.getContext("2d").drawImage(img,0,0,c.width,c.height);
  const tipo=a.type==="image/png"?"image/png":"image/jpeg";
  const blob=await new Promise((ok,err)=>c.toBlob(b=>b?ok(b):err(new Error("Falha na imagem")),tipo,tipo==="image/png"?undefined:.82));
  return new File([blob],`produto-${Date.now()}-${Math.random().toString(36).slice(2)}.${tipo==="image/png"?"png":"jpg"}`,{type:tipo});
}

function carregarImagem(a){return new Promise((ok,err)=>{const i=new Image(),u=URL.createObjectURL(a);i.onload=()=>{URL.revokeObjectURL(u);ok(i)};i.onerror=err;i.src=u})}

function renderizarPreviews(){
  const itens=[
    ...imagensExistentes.map((url,i)=>({url,tipo:"existente",i})),
    ...arquivosSelecionados.map((x,i)=>({url:x.preview,tipo:"nova",i}))
  ];
  imagesPreview.innerHTML=itens.map((x,pos)=>`<article class="preview-card">
    ${pos===0?'<span class="cover-label">CAPA</span>':""}
    <img src="${escaparAtributo(x.url)}" alt="Foto">
    <button type="button" onclick="${x.tipo==="existente"?"removerImagemExistente":"removerNovaImagem"}(${x.i})">Remover</button>
  </article>`).join("");
}
window.removerImagemExistente=i=>{imagensExistentes.splice(i,1);renderizarPreviews()};
window.removerNovaImagem=i=>{URL.revokeObjectURL(arquivosSelecionados[i].preview);arquivosSelecionados.splice(i,1);renderizarPreviews()};

async function uploadImagens(){
  const urls=[...imagensExistentes];
  for(const item of arquivosSelecionados){
    const ext=item.file.name.split(".").pop()||"jpg",path=`catalogo/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const {error}=await supabaseClient.storage.from(STORAGE_BUCKET).upload(path,item.file,{cacheControl:"3600",upsert:false,contentType:item.file.type});
    if(error)throw error;
    const {data}=supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls.slice(0,MAX_IMAGES);
}

async function carregarProdutosAdmin(){
  lista.innerHTML='<div class="loading-admin">Carregando produtos...</div>';
  const {data,error}=await supabaseClient.from("products").select("*").order("created_at",{ascending:false});
  if(error){lista.innerHTML='<div class="message error">Erro ao carregar os produtos.</div>';return}
  produtosAdmin=data||[];atualizarEstatisticas();renderizarListaAdmin();
}

async function salvarProduto(e){
  e.preventDefault();bloquearBotao(true);esconderMensagem();
  const id=document.getElementById("produtoId").value;
  if(imagensExistentes.length+arquivosSelecionados.length<1){bloquearBotao(false);mostrarMensagem("Escolha pelo menos uma foto.","error");return}
  try{
    botaoSalvar.textContent="Enviando fotos...";
    const urls=await uploadImagens();
    const produto={
      title:document.getElementById("title").value.trim(),
      description:document.getElementById("description").value.trim()||null,
      price:converterNumero(document.getElementById("price").value),
      old_price:converterNumero(document.getElementById("old_price").value),
      category:document.getElementById("category").value,
      image_url:urls[0],image_urls:urls,
      affiliate_link:document.getElementById("affiliate_link").value.trim(),
      marketplace:document.getElementById("marketplace").value,
      featured:document.getElementById("featured").checked,
      active:document.getElementById("active").checked
    };
    const r=id?await supabaseClient.from("products").update(produto).eq("id",id).select().single()
              :await supabaseClient.from("products").insert(produto).select().single();
    if(r.error)throw r.error;
    mostrarMensagem(id?"Produto atualizado!":"Produto adicionado!","success");
    limparFormulario(false);await carregarProdutosAdmin();
  }catch(err){mostrarMensagem("Erro ao salvar: "+err.message,"error")}
  finally{bloquearBotao(false)}
}

function renderizarListaAdmin(){
  const t=buscaAdmin.value.trim().toLowerCase(),f=produtosAdmin.filter(p=>[p.title,p.category,p.marketplace].filter(Boolean).join(" ").toLowerCase().includes(t));
  if(!f.length){lista.innerHTML='<div class="empty-admin"><strong>Nenhum produto cadastrado</strong></div>';return}
  lista.innerHTML=f.map(p=>`<article class="admin-product-card">
    <img src="${escaparAtributo(p.image_url)}" alt="${escaparAtributo(p.title)}">
    <div class="admin-product-info"><div class="admin-tags"><span>${p.active?"Ativo":"Inativo"}</span><span>${(p.image_urls||[p.image_url]).filter(Boolean).length} foto(s)</span></div>
    <strong>${escaparTexto(p.title)}</strong><small>${escaparTexto(p.category||"Sem categoria")} • ${formatarPreco(p.price)||"Sem preço"}</small></div>
    <div class="admin-actions"><button class="icon-button edit" onclick="editarProduto(${p.id})">Editar</button><button class="icon-button delete" onclick="excluirProduto(${p.id})">Excluir</button></div>
  </article>`).join("");
}

window.editarProduto=id=>{
  const p=produtosAdmin.find(x=>Number(x.id)===Number(id));if(!p)return;
  document.getElementById("produtoId").value=p.id;
  document.getElementById("title").value=p.title||"";
  document.getElementById("description").value=p.description||"";
  document.getElementById("price").value=numeroParaCampo(p.price);
  document.getElementById("old_price").value=numeroParaCampo(p.old_price);
  document.getElementById("category").value=p.category||"";
  document.getElementById("affiliate_link").value=p.affiliate_link||"";
  document.getElementById("marketplace").value=p.marketplace||"Mercado Livre";
  document.getElementById("featured").checked=!!p.featured;
  document.getElementById("active").checked=!!p.active;
  imagensExistentes=Array.isArray(p.image_urls)&&p.image_urls.length?[...p.image_urls]:(p.image_url?[p.image_url]:[]);
  arquivosSelecionados=[];renderizarPreviews();
  tituloFormulario.textContent="Editar produto";botaoCancelar.classList.remove("hidden");window.scrollTo({top:0,behavior:"smooth"});
};

window.excluirProduto=async id=>{
  if(!confirm("Excluir este produto?"))return;
  const {error}=await supabaseClient.from("products").delete().eq("id",id);
  if(error)alert(error.message);else carregarProdutosAdmin();
};

function limparFormulario(apagar=true){
  form.reset();document.getElementById("produtoId").value="";document.getElementById("active").checked=true;document.getElementById("marketplace").value="Mercado Livre";
  arquivosSelecionados.forEach(x=>URL.revokeObjectURL(x.preview));arquivosSelecionados=[];imagensExistentes=[];imagesPreview.innerHTML="";
  tituloFormulario.textContent="Adicionar produto";botaoCancelar.classList.add("hidden");if(apagar)esconderMensagem();
}
function atualizarEstatisticas(){document.getElementById("totalProdutos").textContent=produtosAdmin.length;document.getElementById("totalDestaques").textContent=produtosAdmin.filter(p=>p.featured).length;document.getElementById("totalCategorias").textContent=new Set(produtosAdmin.map(p=>p.category).filter(Boolean)).size}
function converterNumero(v){const x=String(v||"").trim().replace(/\./g,"").replace(",",".");return x&&Number.isFinite(Number(x))?Number(x):null}
function numeroParaCampo(v){return v==null?"":Number(v).toFixed(2).replace(".",",")}
function formatarPreco(v){return Number.isFinite(Number(v))?Number(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}):""}
function bloquearBotao(x){botaoSalvar.disabled=x;if(!x)botaoSalvar.textContent=document.getElementById("produtoId").value?"Atualizar produto":"Salvar produto"}
function mostrarMensagem(t,tipo){formMensagem.className=`message ${tipo}`;formMensagem.textContent=t}
function esconderMensagem(){formMensagem.className="message hidden";formMensagem.textContent=""}
function escaparTexto(v=""){return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function escaparAtributo(v=""){return escaparTexto(v)}
