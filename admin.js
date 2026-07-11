const STORAGE_KEY="ofertaCertaV15Products";
const OLD_STORAGE_KEY="ofertaCertaV14Products";
const MAX_IMAGES=5;
const MAX_FILE_SIZE=10*1024*1024;
const IMAGE_MAX_SIDE=900;
const IMAGE_QUALITY=.68;

const $=id=>document.getElementById(id);
const form=$("productForm"),productId=$("productId"),affiliateLink=$("affiliateLink"),title=$("title"),price=$("price"),oldPrice=$("oldPrice"),category=$("category"),badge=$("badge"),description=$("description"),imageFiles=$("imageFiles"),imagesPreview=$("imagesPreview"),featured=$("featured"),previewImage=$("previewImage"),previewTitle=$("previewTitle"),previewPrice=$("previewPrice"),previewOldPrice=$("previewOldPrice"),previewCategory=$("previewCategory"),previewBadge=$("previewBadge"),list=$("adminProductsList"),totalProducts=$("totalProducts"),totalFeatured=$("totalFeatured"),totalClicks=$("totalClicks"),cancelEditBtn=$("cancelEditBtn"),resetBtn=$("resetBtn"),formTitle=$("formTitle"),saveBtn=$("saveBtn"),exportBtn=$("exportBtn"),importFile=$("importFile");

let selectedImages=[],coverIndex=0,processing=false,publishing=false;

function normalizeProduct(p){
  const images=Array.isArray(p.images)&&p.images.length?p.images:(p.image?[p.image]:[]);
  return {...p,images,image:p.image||images[0]||"",clicks:Number(p.clicks||0)};
}
function getProducts(){
  try{
    let raw=localStorage.getItem(STORAGE_KEY);
    if(!raw){
      const old=localStorage.getItem(OLD_STORAGE_KEY);
      if(old){localStorage.setItem(STORAGE_KEY,old);raw=old;}
    }
    const data=JSON.parse(raw||"[]");
    return Array.isArray(data)?data.map(normalizeProduct):[];
  }catch(e){console.error(e);return[];}
}
function saveProducts(products){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(products));return true;}
  catch(e){
    console.error(e);
    alert("O armazenamento do navegador ficou cheio. Exclua produtos antigos, use menos fotos ou exporte o backup.");
    return false;
  }
}
function money(v){return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}
function escapeHtml(t=""){return String(t).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
function isValidAffiliateUrl(url){
  try{
    const p=new URL(url),h=p.hostname.toLowerCase();
    return p.protocol==="https:"&&(h==="meli.la"||h==="mercadolivre.com.br"||h.endsWith(".mercadolivre.com.br")||h==="mercadolivre.com"||h.endsWith(".mercadolivre.com"));
  }catch{return false;}
}
function currentCover(){return selectedImages[coverIndex]||selectedImages[0]||"";}
function updatePreview(){
  previewTitle.textContent=title.value.trim()||"Título do produto";
  previewPrice.textContent=money(price.value);
  previewCategory.textContent=category.value||"Categoria";
  if(oldPrice.value){previewOldPrice.textContent=money(oldPrice.value);previewOldPrice.classList.remove("hidden");}else previewOldPrice.classList.add("hidden");
  if(badge.value){previewBadge.textContent=badge.value;previewBadge.classList.remove("hidden");}else previewBadge.classList.add("hidden");
  previewImage.src=currentCover()||"https://placehold.co/800x800?text=Foto+do+produto";
}
function renderImagesPreview(){
  if(!selectedImages.length){imagesPreview.innerHTML='<div class="images-empty">Nenhuma foto selecionada.</div>';updatePreview();return;}
  imagesPreview.innerHTML=selectedImages.map((src,i)=>`<div class="image-preview-item ${i===coverIndex?"cover":""}">
    ${i===coverIndex?'<span class="cover-label">CAPA</span>':""}
    <img src="${src}" alt="Foto ${i+1}">
    <div class="image-preview-actions">
      <button type="button" class="set-cover-button" data-img-action="cover" data-index="${i}">${i===coverIndex?"Capa atual":"Usar capa"}</button>
      <button type="button" class="remove-image-button" data-img-action="remove" data-index="${i}">Excluir</button>
    </div></div>`).join("");
  updatePreview();
}
function resetForm(){
  form.reset();productId.value="";selectedImages=[];coverIndex=0;processing=false;publishing=false;imageFiles.value="";imageFiles.disabled=false;saveBtn.disabled=false;saveBtn.textContent="Publicar produto";formTitle.textContent="Cadastrar produto";cancelEditBtn.classList.add("hidden");renderImagesPreview();updatePreview();
}
function renderList(){
  const products=getProducts();
  totalProducts.textContent=products.length;
  totalFeatured.textContent=products.filter(p=>p.featured).length;
  totalClicks.textContent=products.reduce((s,p)=>s+Number(p.clicks||0),0);
  if(!products.length){list.innerHTML='<div class="empty-state"><div>📦</div><h3>Nenhum produto cadastrado</h3><p>Use o formulário acima para publicar o primeiro produto.</p></div>';return;}
  list.innerHTML=products.map(p=>`<article class="admin-product-item">
    <img src="${escapeHtml(p.image||p.images[0]||"https://placehold.co/300x300?text=Sem+foto")}" alt="${escapeHtml(p.title)}">
    <div><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.category)} • ${money(p.price)} • ${p.images.length} foto(s) • ${p.clicks} clique(s)</p></div>
    <div class="item-actions">
      <button class="mini-btn" data-action="edit" data-id="${escapeHtml(p.id)}">Editar</button>
      <a class="mini-btn" href="${escapeHtml(p.affiliateLink)}" target="_blank" rel="noopener noreferrer">Testar link</a>
      <button class="mini-btn danger" data-action="delete" data-id="${escapeHtml(p.id)}">Excluir</button>
    </div></article>`).join("");
}
function editProduct(id){
  const p=getProducts().find(x=>x.id===id);if(!p)return;
  productId.value=p.id;affiliateLink.value=p.affiliateLink||"";title.value=p.title||"";price.value=p.price||"";oldPrice.value=p.oldPrice||"";category.value=p.category||"";badge.value=p.badge||"";description.value=p.description||"";featured.checked=!!p.featured;
  selectedImages=[...p.images];coverIndex=Math.max(0,selectedImages.indexOf(p.image));imageFiles.value="";formTitle.textContent="Editar produto";saveBtn.textContent="Salvar alterações";cancelEditBtn.classList.remove("hidden");renderImagesPreview();window.scrollTo({top:0,behavior:"smooth"});
}
function deleteProduct(id){
  const products=getProducts(),p=products.find(x=>x.id===id);if(!p||!confirm(`Excluir "${p.title}"?`))return;
  if(saveProducts(products.filter(x=>x.id!==id))){renderList();if(productId.value===id)resetForm();}
}
function readFile(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);});}
function loadImage(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});}
async function compressImage(file){
  const src=await readFile(file),img=await loadImage(src);
  let w=img.naturalWidth,h=img.naturalHeight;
  const scale=Math.min(1,IMAGE_MAX_SIDE/Math.max(w,h));w=Math.round(w*scale);h=Math.round(h*scale);
  const c=document.createElement("canvas");c.width=w;c.height=h;const ctx=c.getContext("2d",{alpha:false});
  ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
  return c.toDataURL("image/jpeg",IMAGE_QUALITY);
}
async function processImages(files){
  if(processing)return;
  const slots=MAX_IMAGES-selectedImages.length;if(slots<=0){alert(`Máximo de ${MAX_IMAGES} fotos.`);return;}
  const chosen=Array.from(files).slice(0,slots);
  if(Array.from(files).length>slots)alert(`Somente ${slots} foto(s) foram adicionadas.`);
  const invalid=chosen.find(f=>!f.type.startsWith("image/")||f.size>MAX_FILE_SIZE);
  if(invalid){alert(`A foto "${invalid.name}" é inválida ou maior que 10 MB.`);imageFiles.value="";return;}
  processing=true;imageFiles.disabled=true;saveBtn.disabled=true;
  try{
    for(let i=0;i<chosen.length;i++){saveBtn.textContent=`Processando foto ${i+1} de ${chosen.length}...`;selectedImages.push(await compressImage(chosen[i]));}
    renderImagesPreview();
  }catch(e){console.error(e);alert("Não foi possível processar uma das fotos.");}
  finally{processing=false;imageFiles.disabled=false;imageFiles.value="";saveBtn.disabled=false;saveBtn.textContent=productId.value?"Salvar alterações":"Publicar produto";}
}
imageFiles.addEventListener("change",e=>{if(e.target.files?.length)processImages(e.target.files);});
imagesPreview.addEventListener("click",e=>{
  const b=e.target.closest("[data-img-action]");if(!b)return;const i=Number(b.dataset.index);
  if(b.dataset.imgAction==="cover"){coverIndex=i;}
  if(b.dataset.imgAction==="remove"){selectedImages.splice(i,1);if(!selectedImages.length)coverIndex=0;else if(i<coverIndex)coverIndex--;else if(coverIndex>=selectedImages.length)coverIndex=selectedImages.length-1;}
  renderImagesPreview();
});
[title,price,oldPrice,category,badge].forEach(el=>{el.addEventListener("input",updatePreview);el.addEventListener("change",updatePreview);});
form.addEventListener("submit",e=>{
  e.preventDefault();if(publishing||processing)return;
  const link=affiliateLink.value.trim();
  if(!isValidAffiliateUrl(link)){alert("Cole um link válido do Mercado Livre, como https://meli.la/...");affiliateLink.focus();return;}
  if(!selectedImages.length){alert("Selecione pelo menos uma foto.");imageFiles.focus();return;}
  publishing=true;saveBtn.disabled=true;const editingId=productId.value;saveBtn.textContent=editingId?"Salvando...":"Publicando...";
  try{
    const products=getProducts(),old=products.find(p=>p.id===editingId);
    const ordered=[...selectedImages];if(coverIndex>0)ordered.unshift(ordered.splice(coverIndex,1)[0]);
    const p={id:editingId||(crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`),affiliateLink:link,title:title.value.trim(),price:Number(price.value),oldPrice:oldPrice.value?Number(oldPrice.value):null,category:category.value,badge:badge.value,description:description.value.trim(),images:ordered,image:ordered[0],featured:featured.checked,clicks:old?.clicks||0,createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
    if(editingId){const i=products.findIndex(x=>x.id===editingId);if(i>=0)products[i]=p;else products.unshift(p);}else products.unshift(p);
    if(saveProducts(products)){renderList();resetForm();alert(editingId?"Produto atualizado com sucesso.":"Produto publicado com sucesso.");}
  }catch(err){console.error(err);alert("Erro ao salvar o produto.");}
  finally{publishing=false;saveBtn.disabled=false;saveBtn.textContent=productId.value?"Salvar alterações":"Publicar produto";}
});
list.addEventListener("click",e=>{const b=e.target.closest("[data-action]");if(!b)return;b.dataset.action==="edit"?editProduct(b.dataset.id):deleteProduct(b.dataset.id);});
resetBtn.addEventListener("click",resetForm);cancelEditBtn.addEventListener("click",resetForm);
exportBtn.addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify(getProducts(),null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`oferta-certa-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);
});
importFile.addEventListener("change",async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{const data=JSON.parse(await file.text());if(!Array.isArray(data))throw new Error();if(confirm(`Importar ${data.length} produto(s) e substituir o catálogo atual?`)&&saveProducts(data.map(normalizeProduct))){renderList();resetForm();alert("Backup importado.");}}
  catch{alert("Arquivo de backup inválido.");}finally{importFile.value="";}
});
renderList();renderImagesPreview();updatePreview();
