(() => {
  const STOP_WORDS = new Set([
    "de", "da", "do", "das", "dos", "e", "com", "para", "por", "em"
  ]);

  function iniciar() {
    document
      .getElementById("melhorarCadastro")
      ?.addEventListener("click", melhorarCadastro);

    document
      .getElementById("melhorarFotos")
      ?.addEventListener("click", melhorarFotos);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }

  function campo(id) {
    return document.getElementById(id);
  }

  function normalizarEspacos(valor) {
    return String(valor || "")
      .replace(/\s+/g, " ")
      .replace(/\s+([,.;:!?])/g, "$1")
      .trim();
  }

  function formatarPalavra(palavra, indice) {
    const original = palavra.trim();
    const lower = original.toLocaleLowerCase("pt-BR");

    if (/^\d+(?:[.,]\d+)?(?:kg|g|mg|l|ml|cm|mm|m|v|w)$/i.test(original)) {
      return lower
        .replace(",", ".")
        .replace(/kg|mg|ml|cm|mm/g, unidade => unidade.toLowerCase());
    }

    if (/^[A-Z0-9-]{2,}$/.test(original)) {
      return original;
    }

    if (indice > 0 && STOP_WORDS.has(lower)) {
      return lower;
    }

    return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
  }

  function melhorarTitulo(valor) {
    const limpo = normalizarEspacos(valor)
      .replace(/\s*[-–—]\s*/g, " — ")
      .replace(/\b(\w+)(?:\s+\1\b)+/gi, "$1");

    return limpo
      .split(" ")
      .map(formatarPalavra)
      .join(" ")
      .slice(0, 160);
  }

  function categoriaSugerida(titulo) {
    const texto = titulo
      .toLocaleLowerCase("pt-BR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const regras = [
      ["Artesanato", /fio|barbante|croche|agulha|linha|artesan/],
      ["Ferramentas", /furadeira|parafusadeira|soquete|chave|broca|alicate|ferrament/],
      ["Casa e Cozinha", /panela|pote|taca|copo|cozinha|garrafa|marmita|talher/],
      ["Eletrônicos", /fone|celular|smartphone|caixa de som|camera|eletron/],
      ["Informática", /notebook|computador|ssd|teclado|mouse|monitor|impressora/],
      ["Beleza", /perfume|maquiagem|creme|serum|shampoo|beleza/],
      ["Automotivo", /carro|moto|automotivo|pneu|capacete/],
      ["Esporte e Fitness", /academia|fitness|halter|bicicleta|esporte/],
      ["Pet Shop", /cachorro|gato|pet|racao/]
    ];

    return regras.find(([, regra]) => regra.test(texto))?.[0] || "Outros";
  }

  function criarDescricao(titulo, categoria, existente) {
    const textoExistente = normalizarEspacos(existente);

    const introducoes = {
      "Artesanato":
        "Produto indicado para trabalhos artesanais, com boa apresentação e praticidade no uso.",
      "Ferramentas":
        "Solução prática para serviços domésticos ou profissionais, com foco em resistência e facilidade de uso.",
      "Casa e Cozinha":
        "Produto pensado para facilitar a rotina, a organização e o uso no dia a dia.",
      "Eletrônicos":
        "Produto selecionado para oferecer praticidade, desempenho e bom custo-benefício.",
      "Informática":
        "Produto indicado para melhorar a produtividade, a organização e a experiência de uso.",
      "Beleza":
        "Produto selecionado para complementar os cuidados pessoais e a rotina diária.",
      "Automotivo":
        "Produto indicado para cuidados, manutenção ou uso diário do veículo.",
      "Esporte e Fitness":
        "Produto indicado para apoiar treinos, atividades físicas e uma rotina mais ativa.",
      "Pet Shop":
        "Produto selecionado para o conforto, cuidado e bem-estar do animal.",
      "Outros":
        "Produto selecionado pela Oferta Certa, com foco em praticidade e bom custo-benefício."
    };

    const detalhes = textoExistente
      ? textoExistente.replace(/[.]+\s*$/, "")
      : introducoes[categoria] || introducoes.Outros;

    return `${titulo}. ${detalhes}. Confira fotos, medidas, cores, variações, estoque e condições antes de finalizar a compra.`
      .replace(/\.\s*\./g, ".")
      .slice(0, 1200);
  }

  async function melhorarCadastro() {
    const botao = campo("melhorarCadastro");
    const titulo = campo("title");
    const descricao = campo("description");
    const categoria = campo("category");

    if (!titulo || !descricao || !categoria) {
      alert("Não encontrei os campos do cadastro. Atualize a página.");
      return;
    }

    const bruto = titulo.value.trim();

    if (!bruto) {
      alert("Digite primeiro o nome do produto.");
      titulo.focus();
      return;
    }

    const textoOriginal = botao.textContent;
    botao.disabled = true;
    botao.textContent = "✨ Melhorando...";

    try {
      const novoTitulo = melhorarTitulo(bruto);
      const novaCategoria =
        categoria.value.trim() || categoriaSugerida(novoTitulo);

      titulo.value = novoTitulo;
      categoria.value = novaCategoria;
      descricao.value = criarDescricao(
        novoTitulo,
        novaCategoria,
        descricao.value
      );

      [titulo, categoria, descricao].forEach(elemento => {
        elemento.dispatchEvent(
          new Event("input", { bubbles: true })
        );
        elemento.dispatchEvent(
          new Event("change", { bubbles: true })
        );
      });

      window.ofertaCertaAdminSmart?.showMessage(
        "Título, categoria e descrição melhorados. Revise antes de salvar.",
        "success"
      );
    } catch (error) {
      console.error(error);
      window.ofertaCertaAdminSmart?.showMessage(
        "Não foi possível melhorar o cadastro.",
        "error"
      );
    } finally {
      botao.disabled = false;
      botao.textContent = textoOriginal;
    }
  }

  async function melhorarFotos() {
    const botao = campo("melhorarFotos");
    const api = window.ofertaCertaAdminSmart;

    if (!api) {
      alert("O assistente de fotos não carregou. Atualize a página.");
      return;
    }

    const novas = api.getNewImages();
    const existentes = api.getExistingImages();

    if (!novas.length && !existentes.length) {
      alert("Escolha pelo menos uma foto primeiro.");
      campo("image_files")?.click();
      return;
    }

    const textoOriginal = botao.textContent;
    botao.disabled = true;
    botao.textContent = "📷 Melhorando...";

    api.showMessage(
      "Melhorando fotos: ampliando o produto, centralizando e ajustando iluminação...",
      "info"
    );

    try {
      const resultadoNovas = [];

      for (const item of novas) {
        try {
          const file = await tratarFoto(item.file);
          resultadoNovas.push({ file });
        } catch (error) {
          console.warn("Não foi possível tratar uma foto nova:", error);
          resultadoNovas.push(item);
        }
      }

      const existentesMantidas = [];

      for (const url of existentes) {
        try {
          const response = await fetch(url, { mode: "cors" });

          if (!response.ok) {
            throw new Error("Imagem indisponível");
          }

          const blob = await response.blob();
          const original = new File(
            [blob],
            `foto-existente-${Date.now()}.${extensaoDoBlob(blob)}`,
            { type: blob.type || "image/jpeg" }
          );

          const file = await tratarFoto(original);
          resultadoNovas.push({ file });
        } catch (error) {
          console.warn("Foto existente mantida sem alteração:", error);
          existentesMantidas.push(url);
        }
      }

      api.replaceImages({
        newImages: resultadoNovas,
        existingImages: existentesMantidas
      });

      api.showMessage(
        "Fotos melhoradas e ampliadas. A primeira imagem continua sendo a capa.",
        "success"
      );
    } catch (error) {
      console.error(error);
      api.showMessage(
        "Não foi possível melhorar as fotos. Tente novamente.",
        "error"
      );
    } finally {
      botao.disabled = false;
      botao.textContent = textoOriginal;
    }
  }

  function extensaoDoBlob(blob) {
    const tipo = String(blob.type || "");
    if (tipo.includes("png")) return "png";
    if (tipo.includes("webp")) return "webp";
    return "jpg";
  }

  function tratarFoto(file) {
    return new Promise((resolve, reject) => {
      const imagem = new Image();
      const url = URL.createObjectURL(file);

      imagem.onload = () => {
        URL.revokeObjectURL(url);

        /*
         * V56:
         * usa preenchimento do quadro em vez de colocar a foto inteira
         * com margens. Assim o produto fica maior e mais destacado.
         */
        const tamanho = 1200;
        const canvas = document.createElement("canvas");
        canvas.width = tamanho;
        canvas.height = tamanho;

        const contexto = canvas.getContext("2d", {
          alpha: false
        });

        if (!contexto) {
          reject(new Error("Canvas não disponível"));
          return;
        }

        contexto.fillStyle = "#ffffff";
        contexto.fillRect(0, 0, tamanho, tamanho);
        contexto.imageSmoothingEnabled = true;
        contexto.imageSmoothingQuality = "high";

        const larguraOriginal = imagem.naturalWidth;
        const alturaOriginal = imagem.naturalHeight;

        if (!larguraOriginal || !alturaOriginal) {
          reject(new Error("Imagem sem dimensões válidas"));
          return;
        }

        /*
         * Math.max faz a imagem preencher todo o quadrado.
         * O excesso é cortado igualmente nas laterais ou em cima/baixo.
         */
        const escala = Math.max(
          tamanho / larguraOriginal,
          tamanho / alturaOriginal
        );

        const larguraFinal = larguraOriginal * escala;
        const alturaFinal = alturaOriginal * escala;
        const x = (tamanho - larguraFinal) / 2;
        const y = (tamanho - alturaFinal) / 2;

        contexto.filter =
          "brightness(1.04) contrast(1.08) saturate(1.05)";

        contexto.drawImage(
          imagem,
          x,
          y,
          larguraFinal,
          alturaFinal
        );

        contexto.filter = "none";

        /*
         * Leve realce sem alterar as cores do produto.
         */
        contexto.globalAlpha = 0.08;
        contexto.fillStyle = "#ffffff";
        contexto.fillRect(0, 0, tamanho, tamanho);
        contexto.globalAlpha = 1;

        canvas.toBlob(
          blob => {
            if (!blob) {
              reject(new Error("Não foi possível gerar a foto"));
              return;
            }

            resolve(
              new File(
                [blob],
                `foto-melhorada-${Date.now()}-${Math.random()
                  .toString(36)
                  .slice(2, 7)}.jpg`,
                { type: "image/jpeg" }
              )
            );
          },
          "image/jpeg",
          0.92
        );
      };

      imagem.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Imagem inválida"));
      };

      imagem.src = url;
    });
  }
})();
