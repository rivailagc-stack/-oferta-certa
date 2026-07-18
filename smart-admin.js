document.addEventListener("DOMContentLoaded",()=>{
  document.getElementById("melhorarCadastro")?.addEventListener("click",melhorarCadastro);
  document.getElementById("melhorarFotos")?.addEventListener("click",melhorarFotosSelecionadas);
});
function melhorarCadastro(){
  const titulo=document.getElementById("title");
  const descricao=document.getElementById("description");
  const categoria=document.getElementById("category");
  const bruto=titulo.value.trim();
  if(!bruto){alert("Digite primeiro o nome do produto.");titulo.focus();return;}
  const limpo=bruto.replace(/\s+/g," ").replace(/\b(kit|jogo|fio|barbante|conjunto|máquina|furadeira|perfume|taça|pote)\b/gi,m=>m[0].toUpperCase()+m.slice(1).toLowerCase());
  const categoriaSugerida=sugerirCategoria(limpo);
  if(categoriaSugerida&&!categoria.value)categoria.value=categoriaSugerida;
  titulo.value=limpo.charAt(0).toUpperCase()+limpo.slice(1);
  if(!descricao.value.trim())descricao.value=`${titulo.value}. Produto selecionado para oferecer praticidade, qualidade e ótimo custo-benefício. Confira as fotos, as opções disponíveis e escolha a variação ideal antes de finalizar a compra.`;
  alert("Título e descrição melhorados. Confira os dados antes de salvar.");
}
function sugerirCategoria(t){
  const x=t.toLowerCase();
  if(/fio|barbante|crochê|agulha|artesan/.test(x))return"Artesanato";
  if(/furadeira|soquete|chave|broca|ferrament/.test(x))return"Ferramentas";
  if(/panela|pote|taça|copo|cozinha/.test(x))return"Casa e Cozinha";
  if(/fone|celular|caixa de som|eletrôn/.test(x))return"Eletrônicos";
  if(/perfume|maquiagem|creme|beleza/.test(x))return"Beleza";
  return"Outros";
}
async function melhorarFotosSelecionadas(){
  if(!arquivosSelecionados?.length){alert("Escolha as fotos primeiro. As imagens novas serão clareadas e enquadradas.");return;}
  const novos=[];
  for(const item of arquivosSelecionados){
    try{const file=await tratarFoto(item.file);URL.revokeObjectURL(item.preview);novos.push({file,preview:URL.createObjectURL(file)});}catch{novos.push(item)}
  }
  arquivosSelecionados=novos;renderizarPreviews();alert("Fotos preparadas com fundo claro, enquadramento quadrado e melhor iluminação.");
}
function tratarFoto(file){return new Promise((resolve,reject)=>{
  const img=new Image(),url=URL.createObjectURL(file);
  img.onload=()=>{URL.revokeObjectURL(url);const size=1200,c=document.createElement("canvas");c.width=c.height=size;const ctx=c.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,size,size);ctx.filter="brightness(1.06) contrast(1.04) saturate(1.03)";const scale=Math.min((size*0.9)/img.width,(size*0.9)/img.height);const w=img.width*scale,h=img.height*scale;ctx.drawImage(img,(size-w)/2,(size-h)/2,w,h);c.toBlob(blob=>blob?resolve(new File([blob],`foto-melhorada-${Date.now()}.jpg`,{type:"image/jpeg"})):reject(),"image/jpeg",.88)};img.onerror=reject;img.src=url;
})}
