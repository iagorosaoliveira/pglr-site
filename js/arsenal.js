/* Arsenal: a vitrine. Um card por estampa, com troca de cor, arte (quando há duas),
   frente/costas e o botão que abre o WhatsApp com o pedido escrito. */
(function (raiz, fabrica) {
  var api = fabrica();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { raiz.PGLR = raiz.PGLR || {}; raiz.PGLR.arsenal = api; }
})(this, function () {
  "use strict";

  var FADE_MS = 150;
  var ATRASO_ENTRADA_MS = 80;

  // ---------- funções puras

  function rotuloContagem(n) {
    return n + " ESTAMPAS · FEITAS EM SP";
  }

  function precisaSeletorCores(estampa) {
    return estampa.cores.length > 1;
  }

  function precisaSeletorArte(cor) {
    return cor.artes.length > 1;
  }

  function estadoInicial() {
    return { cor: 0, arte: 0, lado: "costas" };
  }

  function arteAtual(estampa, estado) {
    var cor = estampa.cores[estado.cor];
    return cor.artes[Math.min(estado.arte, cor.artes.length - 1)];
  }

  function imagemAtual(estampa, estado) {
    return arteAtual(estampa, estado)[estado.lado];
  }

  function textoAlt(estampa, estado) {
    return "Camisa " + estampa.nome + ", cor " + estampa.cores[estado.cor].nome.toLowerCase() + ", " + estado.lado;
  }

  function mensagemPedido(estampa, estado) {
    var cor = estampa.cores[estado.cor];
    var arte = precisaSeletorArte(cor) ? ", arte " + (estado.arte + 1) : "";
    return 'Fala, Guilherme! Vi no site a camisa "' + estampa.nome + '" na cor ' +
      cor.nome.toLowerCase() + arte + " e quero saber tamanhos e valor.";
  }

  // ---------- DOM

  function el(doc, tag, classe, texto) {
    var n = doc.createElement(tag);
    if (classe) n.className = classe;
    if (texto) n.textContent = texto;
    return n;
  }

  function botao(doc, classe, texto, rotulo) {
    var b = el(doc, "button", classe, texto);
    b.type = "button";
    if (rotulo) b.setAttribute("aria-label", rotulo);
    return b;
  }

  function montarCard(doc, estampa, catalogo, linkWhatsApp, indice) {
    var estado = estadoInicial();
    var card = el(doc, "article", "card");

    var palco = el(doc, "div", "card-palco");
    ["1", "2", "3", "4"].forEach(function (n) { palco.appendChild(el(doc, "span", "canto canto-" + n)); });
    var carta = el(doc, "div", "carta");
    var faces = { costas: el(doc, "img", "face face-costas"), frente: el(doc, "img", "face face-frente") };
    ["costas", "frente"].forEach(function (lado) {
      faces[lado].loading = "lazy";
      faces[lado].decoding = "async";
      carta.appendChild(faces[lado]);
    });
    palco.appendChild(carta);
    // etiqueta de alvo (nº e cor) e a linha de varredura que passa na entrada e no hover
    var etiqueta = el(doc, "span", "card-id");
    etiqueta.setAttribute("aria-hidden", "true");
    palco.appendChild(etiqueta);
    var scan = el(doc, "i", "card-scan");
    scan.setAttribute("aria-hidden", "true");
    palco.appendChild(scan);
    card.appendChild(palco);

    var info = el(doc, "div", "card-info");
    info.appendChild(el(doc, "h3", "card-nome", estampa.nome));
    info.appendChild(el(doc, "p", "card-desc", estampa.descricao));

    var cores = el(doc, "div", "seletor seletor-cores");
    cores.setAttribute("role", "group");
    cores.setAttribute("aria-label", "Cor");
    var botoesCor = estampa.cores.map(function (cor, i) {
      var b = botao(doc, "bolinha", "", cor.nome);
      b.style.setProperty("--cor", cor.hex);
      b.addEventListener("click", function () { mudar({ cor: i, arte: 0 }); });
      cores.appendChild(b);
      return b;
    });
    if (precisaSeletorCores(estampa)) info.appendChild(cores);

    var artes = el(doc, "div", "seletor seletor-arte");
    artes.setAttribute("role", "group");
    artes.setAttribute("aria-label", "Arte");
    var botoesArte = [0, 1].map(function (i) {
      var b = botao(doc, "chip", "Arte " + (i + 1));
      b.addEventListener("click", function () { mudar({ arte: i }); });
      artes.appendChild(b);
      return b;
    });
    info.appendChild(artes);

    var acoes = el(doc, "div", "card-acoes");
    var virar = botao(doc, "chip virar", "");
    virar.addEventListener("click", function () {
      mudar({ lado: estado.lado === "costas" ? "frente" : "costas" });
    });
    var pedir = el(doc, "a", "pilula", "Pedir no WhatsApp");
    pedir.target = "_blank";
    pedir.rel = "noopener";
    acoes.appendChild(virar);
    acoes.appendChild(pedir);
    info.appendChild(acoes);
    card.appendChild(info);

    function aplicarImagens(animar) {
      ["costas", "frente"].forEach(function (lado) {
        var img = faces[lado];
        var src = imagemAtual(estampa, { cor: estado.cor, arte: estado.arte, lado: lado });
        var alt = textoAlt(estampa, { cor: estado.cor, arte: estado.arte, lado: lado });
        if (img.getAttribute("src") === src) return;
        if (!animar) { img.src = src; img.alt = alt; return; }
        img.classList.add("trocando");
        setTimeout(function () {
          img.onload = function () { img.classList.remove("trocando"); };
          img.src = src;
          img.alt = alt;
        }, FADE_MS);
      });
    }

    function render(animar) {
      var cor = estampa.cores[estado.cor];
      etiqueta.textContent = "Nº " + (indice + 1 < 10 ? "0" : "") + (indice + 1) + " · " + cor.nome.toUpperCase();
      botoesCor.forEach(function (b, i) { b.setAttribute("aria-pressed", String(i === estado.cor)); });
      artes.hidden = !precisaSeletorArte(cor);
      botoesArte.forEach(function (b, i) { b.setAttribute("aria-pressed", String(i === estado.arte)); });
      carta.classList.toggle("virada", estado.lado === "frente");
      virar.textContent = estado.lado === "costas" ? "Ver frente" : "Ver costas";
      pedir.href = linkWhatsApp(catalogo.whatsapp, mensagemPedido(estampa, estado));
      aplicarImagens(animar);
    }

    function mudar(parcial) {
      Object.keys(parcial).forEach(function (k) { estado[k] = parcial[k]; });
      render(true);
    }

    render(false);
    return card;
  }

  function init(grade, catalogo) {
    var doc = grade.ownerDocument;
    var linkWhatsApp = doc.defaultView.PGLR.contato.linkWhatsApp;
    var contagem = doc.getElementById("arsenal-contagem");
    if (contagem) contagem.textContent = rotuloContagem(catalogo.estampas.length);

    var cards = catalogo.estampas.map(function (estampa, i) {
      var card = montarCard(doc, estampa, catalogo, linkWhatsApp, i);
      card.style.setProperty("--atraso", i * ATRASO_ENTRADA_MS + "ms");
      grade.appendChild(card);
      // terminada a entrada, as animações dela saem de cena (o hover usa as suas)
      card.addEventListener("animationend", function (e) {
        if (e.animationName === "face-revela") card.classList.add("entrou");
      });
      return card;
    });

    var win = doc.defaultView;
    var reduzido = win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduzido || !("IntersectionObserver" in win)) return;
    // entrada em sequência: os cards sobem ao aparecer na tela
    grade.classList.add("com-entrada");
    var obs = new win.IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("visivel");
        obs.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -10% 0px" });
    cards.forEach(function (c) { obs.observe(c); });
  }

  return {
    rotuloContagem: rotuloContagem,
    precisaSeletorCores: precisaSeletorCores,
    precisaSeletorArte: precisaSeletorArte,
    estadoInicial: estadoInicial,
    imagemAtual: imagemAtual,
    textoAlt: textoAlt,
    mensagemPedido: mensagemPedido,
    init: init
  };
});
