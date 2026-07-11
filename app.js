const STORAGE_KEY="ofertaCertaV15Products";
const OLD_STORAGE_KEY="ofertaCertaV14Products";
const $=id=>document.getElementById(id);
const grid=$("productsGrid"),searchInput=$("searchInput"),categoryFilter=$("categoryFilter"),productCount=$("productCount"),modal=$("galleryModal"),galleryImage=$("galleryImage"),galleryCounter=$("galleryCounter"),closeGallery=$("closeGallery"),prevGallery=$("prevGallery"),nextGallery=$("nextGallery");
let galleryImages=[],galleryIndex=0;

function normalize(p){const images=Array.isArray(p.images)&&p.images.length?p.images:(p.image?[p.image]:[]);return {...p,images,image:p.image||images[0]||""};}
function getProducts(){
  try{
    let raw=localStorage.getItem(STORAGE_KEY);
    if(!raw){const old=localStorage.getItem(OLD_STORAGE_KEY);if(old){localStorage.setItem(STORAGE_KEY,old);raw=old;}}
    const d=JSON.parse(raw||"[]");return Array.isArray(d)?d.map(normalize):[];
  }catch{return[];}
}
function saveProducts(p){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(p));}catch{}}
function esc(t=""){return String(t).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
function money(v){return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}
function populateCategories(products){
  const cats=[...new Set(products.map(p=>p.category).filter(Boolean))].sort();
  const current=categoryFilter.value;
  categoryFilter.innerHTML='<option value="">Todas as categorias</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");
  categoryFilter.value=current;
}
function render(){
  const all=getProducts();populateCategories(all);
  const q=searchInput.value.trim().toLowerCase(),cat=categoryFilter.value;
  const products=all.filter(p=>(!q||`${p.title} ${p.description||""} ${p.category}`.toLowerCase().includes(q))&&(!cat||p.category===cat));
  productCount.textContent=`${products.length} produto${products.length===1?"":"s"}`;
  if(!products.length){grid.innerHTML='<div class="empty-state"><div>🔎</div><h3>Nenhum produto encontrado</h3><p>Cadastre produtos no painel ou altere a busca.</p></div>';return;}
  grid.innerHTML=products.map(p=>`<article class="product-card">
    <div class="product-image-wrap">
      ${p.badge?`<span class="badge">${esc(p.badge)}</span>`:""}
      <img src="${esc(p.image||"https://placehold.co/800x800?text=Sem+foto")}" alt="${esc(p.title)}" data-gallery-id="${esc(p.id)}">
      ${p.images.length>1?`<span class="photo-count">📷 ${p.images.length}</span>`:""}
    </div>
    <div class="product-body">
      <span class="category-tag">${esc(p.category||"Outros")}</span>
      <h3>${esc(p.title)}</h3>
      ${p.description?`<p class="product-description">${esc(p.description)}</p>`:""}
      <div class="price-row"><strong>${money(p.price)}</strong>${p.oldPrice?`<del>${money(p.oldPrice)}</del>`:""}</div>
      <button class="buy-button" data-buy-id="${esc(p.id)}">Comprar no Mercado Livre</button>
    </div></article>`).join("");
}
function openGallery(images,index=0){galleryImages=images;galleryIndex=index;showGallery();modal.classList.remove("hidden");document.body.style.overflow="hidden";}
function showGallery(){if(!galleryImages.length)return;galleryImage.src=galleryImages[galleryIndex];galleryCounter.textContent=`${galleryIndex+1} / ${galleryImages.length}`;prevGallery.classList.toggle("hidden",galleryImages.length<2);nextGallery.classList.toggle("hidden",galleryImages.length<2);}
function close(){modal.classList.add("hidden");document.body.style.overflow="";}
grid.addEventListener("click",e=>{
  const img=e.target.closest("[data-gallery-id]");
  if(img){const p=getProducts().find(x=>x.id===img.dataset.galleryId);if(p)openGallery(p.images);return;}
  const buy=e.target.closest("[data-buy-id]");
  if(buy){const products=getProducts(),i=products.findIndex(x=>x.id===buy.dataset.buyId);if(i<0)return;products[i].clicks=Number(products[i].clicks||0)+1;saveProducts(products);window.open(products[i].affiliateLink,"_blank","noopener,noreferrer");}
});
searchInput.addEventListener("input",render);categoryFilter.addEventListener("change",render);
closeGallery.addEventListener("click",close);modal.addEventListener("click",e=>{if(e.target===modal)close();});
prevGallery.addEventListener("click",()=>{galleryIndex=(galleryIndex-1+galleryImages.length)%galleryImages.length;showGallery();});
nextGallery.addEventListener("click",()=>{galleryIndex=(galleryIndex+1)%galleryImages.length;showGallery();});
document.addEventListener("keydown",e=>{if(modal.classList.contains("hidden"))return;if(e.key==="Escape")close();if(e.key==="ArrowLeft")prevGallery.click();if(e.key==="ArrowRight")nextGallery.click();});
render();
