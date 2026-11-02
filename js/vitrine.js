/* Vitrine do Arsenal (C+): uma estampa por vez dentro da mira, com as vizinhas apagadas
   nas bordas, um trilho com todas as miniaturas, cores, artes, costas/frente e o pedido
   pronto no WhatsApp. Troca por arrasto, setas, miniaturas ou teclado (← →). */
(function (raiz, fabrica) {
  var api = fabrica();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { raiz.PGLR = raiz.PGLR || {}; raiz.PGLR.vitrine = api; }
})(this, function () {
  "use strict";

  var CURVA = "cubic-bezier(0.23, 1, 0.32, 1)";  // a mesma de --ease-out
  var DESLOCA = 18;           // % que a camisa anda ao sair e ao entrar
  var GATILHO_PX = 50;        // arrasto mínimo para trocar
  var ARRASTO_CURTO_PX = 20;  // arrasto curto que ainda troca, se for rápido
  var VELOCIDADE = 0.5;       // px/ms

  // ---------- funções puras

  function rotuloContagem(n) { return n + " ESTAMPAS · FEITAS EM SP"; }
  function precisaSeletorCores(estampa) { return estampa.cores.length > 1; }
  function precisaSeletorArte(cor) { return cor.artes.length > 1; }
  function estadoInicial() { return { indice: 0, cor: 0, arte: 0, lado: "costas" }; }
  function circular(i, n) { return ((i % n) + n) % n; }
  function dois(n) { return (n < 10 ? "0" : "") + n; }

  function trocarEstampa(estado, i, n) {
    return { indice: circular(i, n), cor: 0, arte: 0, lado: estado.lado };
  }
  function trocarCor(estado, cor) { return Object.assign({}, estado, { cor: cor, arte: 0 }); }
  function trocarArte(estado, arte) { return Object.assign({}, estado, { arte: arte }); }
  function trocarLado(estado, lado) { return Object.assign({}, estado, { lado: lado }); }

  function arteAtual(estampa, estado) {
    var cor = estampa.cores[estado.cor];
    return cor.artes[Math.min(estado.arte, cor.artes.length - 1)];
  }
  function imagemAtual(estampa, estado) { return arteAtual(estampa, estado)[estado.lado]; }

  function textoAlt(estampa, estado) {
    return "Camisa " + estampa.nome + ", cor " + estampa.cores[estado.cor].nome.toLowerCase() + ", " + estado.lado;
  }

  function mensagemPedido(estampa, estado) {
    var cor = estampa.cores[estado.cor];
    var arte = precisaSeletorArte(cor) ? ", arte " + (estado.arte + 1) : "";
    return 'Fala, Guilherme! Vi no site a camisa "' + estampa.nome + '" na cor ' +
      cor.nome.toLowerCase() + arte + " e quero saber tamanhos e valor.";
  }

  function anuncio(estampa, i, n) { return "Estampa " + (i + 1) + " de " + n + ", " + estampa.nome; }

  // Arrasto para a esquerda leva à próxima (+1); para a direita, à anterior (-1).
  function direcaoArrasto(dx, velocidade) {
    var sinal = dx < 0 ? 1 : -1;
    if (Math.abs(dx) >= GATILHO_PX) return sinal;
    if (Math.abs(dx) >= ARRASTO_CURTO_PX && Math.abs(velocidade) >= VELOCIDADE &&
        (velocidade < 0) === (dx < 0)) return sinal;
    return 0;
  }

  // ---------- DOM

  function init(raiz, catalogo, opcoes) {
    if (!raiz) return;
    var doc = raiz.ownerDocument, win = doc.defaultView;
    var reduzido = !!(opcoes && opcoes.reduzido);
    var linkWhatsApp = win.PGLR.contato.linkWhatsApp;
    var estampas = catalogo.estampas, n = estampas.length;
    function $(id) { return doc.getElementById(id); }

    var mira = $("vitrine-mira"), camisa = $("vitrine-camisa"), foto = $("vitrine-foto");
    var anterior = $("vitrine-anterior"), proxima = $("vitrine-proxima");
    var laser = $("vitrine-laser"), anel = mira.querySelector(".mira-anel-fino"), alvo = $("vitrine-alvo");
    var trilho = $("vitrine-trilho"), cores = $("vitrine-cores"), artes = $("vitrine-artes");
    var num = $("vitrine-num"), nome = $("vitrine-nome"), desc = $("vitrine-desc");
    var pedir = $("vitrine-pedir"), falar = $("vitrine-anuncio");
    var botoesLado = [].slice.call(raiz.querySelectorAll("[data-lado]"));
    var contagem = $("arsenal-contagem");
    if (contagem) contagem.textContent = rotuloContagem(n);

    var estado = estadoInicial();
    var geracao = 0, angulo = 0, coresDe = -1, artesDe = "";
    var cache = {};

    // Carrega uma foto uma vez só; a promessa resolve mesmo se der erro (a troca não trava).
    function precarregar(src) {
      if (!cache[src]) {
        cache[src] = new Promise(function (ok) {
          var im = new win.Image();
          im.decoding = "async";
          im.onload = im.onerror = function () { ok(); };
          im.src = src;
        });
      }
      return cache[src];
    }

    function parar(el) {
      if (el.getAnimations) el.getAnimations().forEach(function (a) { a.cancel(); });
    }

    // Troca de foto: a atual sai para um lado e a nova entra do outro (dir = ±1);
    // dir = 0 é só um esmaecer (troca de cor ou de arte). deX: onde o arrasto soltou.
    function trocarFoto(src, alt, dir, deX) {
      var minha = ++geracao;
      var anda = reduzido ? 0 : dir * DESLOCA;
      var escala = anda ? 0.96 : 1;
      var inicio = deX ? "translateX(" + deX + "px)" : "none";
      parar(camisa);
      camisa.style.transform = "";
      var saida = camisa.animate(
        [{ transform: inicio, opacity: 1 },
         { transform: "translateX(" + (-anda) + "%) scale(" + escala + ")", opacity: 0 }],
        { duration: reduzido ? 75 : (dir ? 110 : 80), easing: CURVA, fill: "forwards" });
      Promise.all([saida.finished.catch(function () {}), precarregar(src)]).then(function () {
        if (minha !== geracao) return;
        foto.src = src;
        foto.alt = alt;
        parar(camisa);
        camisa.animate(
          [{ transform: "translateX(" + anda + "%) scale(" + escala + ")", opacity: 0 },
           { transform: "none", opacity: 1 }],
          { duration: reduzido ? 75 : (dir ? 130 : 80), easing: CURVA });
      });
    }

    // Costas/frente: a nova foto é revelada de cima para baixo.
    function revelarLado(src, alt) {
      var minha = ++geracao;
      precarregar(src).then(function () {
        if (minha !== geracao) return;
        foto.src = src;
        foto.alt = alt;
        parar(camisa);
        camisa.animate(reduzido
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [{ clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)" }],
          { duration: reduzido ? 150 : 260, easing: CURVA });
      });
    }

    function varrer() {
      if (reduzido) return;
      parar(laser);
      laser.animate([
        { transform: "translateY(0%)", opacity: 1 },
        { transform: "translateY(100%)", opacity: 1, offset: 0.85 },
        { transform: "translateY(100%)", opacity: 0 }
      ], { duration: 260, easing: CURVA });
    }

    function montarCores(e) {
      if (coresDe !== estado.indice) {
        coresDe = estado.indice;
        cores.textContent = "";
        e.cores.forEach(function (c, i) {
          var b = doc.createElement("button");
          b.type = "button";
          b.className = "bolinha";
          b.setAttribute("aria-label", c.nome);
          b.style.setProperty("--cor", c.hex);
          b.addEventListener("click", function () {
            if (estado.cor === i) return;
            estado = trocarCor(estado, i);
            render("cor");
          });
          cores.appendChild(b);
        });
        cores.hidden = !precisaSeletorCores(e);
      }
      [].forEach.call(cores.children, function (b, i) { b.setAttribute("aria-pressed", String(i === estado.cor)); });
    }

    function montarArtes(cor) {
      var chave = estado.indice + ":" + estado.cor;
      if (artesDe !== chave) {
        artesDe = chave;
        artes.textContent = "";
        cor.artes.forEach(function (a, i) {
          var b = doc.createElement("button");
          b.type = "button";
          b.className = "chip";
          b.textContent = "Arte " + (i + 1);
          b.addEventListener("click", function () {
            if (estado.arte === i) return;
            estado = trocarArte(estado, i);
            render("arte");
          });
          artes.appendChild(b);
        });
        artes.hidden = !precisaSeletorArte(cor);
      }
      [].forEach.call(artes.children, function (b, i) { b.setAttribute("aria-pressed", String(i === estado.arte)); });
    }

    var miniaturas = estampas.map(function (e, i) {
      var b = doc.createElement("button");
      b.type = "button";
      b.className = "miniatura";
      b.setAttribute("aria-label", e.nome);
      var img = doc.createElement("img");
      img.src = imagemAtual(e, estadoInicial());
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      b.appendChild(img);
      b.addEventListener("click", function () { irPara(i); });
      trilho.appendChild(b);
      return b;
    });

    // tipo: "estampa" | "cor" | "arte" | "lado" | null (primeira pintura, sem animação)
    function render(tipo, dir, deX) {
      var e = estampas[estado.indice];
      var cor = e.cores[estado.cor];
      var ant = estampas[circular(estado.indice - 1, n)], prox = estampas[circular(estado.indice + 1, n)];
      var srcAnt = imagemAtual(ant, estadoInicial()), srcProx = imagemAtual(prox, estadoInicial());
      var src = imagemAtual(e, estado), alt = textoAlt(e, estado);

      alvo.textContent = "ALVO " + dois(estado.indice + 1) + " / " + dois(n);
      num.textContent = "Nº " + dois(estado.indice + 1);
      nome.textContent = e.nome;
      desc.textContent = e.descricao;
      miniaturas.forEach(function (b, i) { b.setAttribute("aria-pressed", String(i === estado.indice)); });
      montarCores(e);
      montarArtes(cor);
      botoesLado.forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-lado") === estado.lado));
      });
      pedir.href = linkWhatsApp(catalogo.whatsapp, mensagemPedido(e, estado));
      anterior.src = srcAnt;
      proxima.src = srcProx;

      if (tipo === "estampa") {
        falar.textContent = anuncio(e, estado.indice, n);
        angulo += 30 * dir;
        anel.style.transform = "rotate(" + angulo + "deg)";
        varrer();
        trocarFoto(src, alt, dir, deX);
      } else if (tipo === "lado") {
        varrer();
        revelarLado(src, alt);
      } else if (tipo) {
        trocarFoto(src, alt, 0);
      } else {
        foto.src = src;
        foto.alt = alt;
      }
      // as vizinhas ficam prontas para a próxima troca não piscar
      precarregar(srcAnt);
      precarregar(srcProx);
    }

    function irPara(i, dir, deX) {
      i = circular(i, n);
      if (i === estado.indice) return;
      dir = dir || (i > estado.indice ? 1 : -1);   // antes de trocar o estado
      estado = trocarEstampa(estado, i, n);
      render("estampa", dir, deX);
    }
    function avancar(deX) { irPara(estado.indice + 1, 1, deX); }
    function voltar(deX) { irPara(estado.indice - 1, -1, deX); }

    $("vitrine-avancar").addEventListener("click", function () { avancar(); });
    $("vitrine-voltar").addEventListener("click", function () { voltar(); });

    botoesLado.forEach(function (b) {
      b.addEventListener("click", function () {
        var lado = b.getAttribute("data-lado");
        if (lado === estado.lado) return;
        estado = trocarLado(estado, lado);
        render("lado");
      });
    });

    raiz.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowRight") { ev.preventDefault(); avancar(); }
      else if (ev.key === "ArrowLeft") { ev.preventDefault(); voltar(); }
    });

    // Arrasto na mira (o navegador continua cuidando da rolagem vertical: touch-action: pan-y)
    var arrasto = null;
    mira.addEventListener("pointerdown", function (ev) {
      if (ev.button !== 0 || ev.target.closest("button")) return;
      arrasto = { x0: ev.clientX, x: ev.clientX, t: ev.timeStamp, v: 0, id: ev.pointerId };
      try { mira.setPointerCapture(ev.pointerId); } catch (e) {}
      parar(camisa);
    });
    mira.addEventListener("pointermove", function (ev) {
      if (!arrasto || ev.pointerId !== arrasto.id) return;
      var dt = ev.timeStamp - arrasto.t;
      if (dt > 0) arrasto.v = (ev.clientX - arrasto.x) / dt;
      arrasto.x = ev.clientX;
      arrasto.t = ev.timeStamp;
      if (!reduzido) camisa.style.transform = "translateX(" + (arrasto.x - arrasto.x0) + "px)";
    });
    function soltar(ev) {
      if (!arrasto || ev.pointerId !== arrasto.id) return;
      var dx = arrasto.x - arrasto.x0, dir = direcaoArrasto(dx, arrasto.v);
      arrasto = null;
      if (dir > 0) { avancar(reduzido ? 0 : dx); return; }
      if (dir < 0) { voltar(reduzido ? 0 : dx); return; }
      camisa.style.transform = "";
      if (dx && !reduzido) {
        camisa.animate([{ transform: "translateX(" + dx + "px)" }, { transform: "none" }],
          { duration: 240, easing: CURVA });
      }
    }
    mira.addEventListener("pointerup", soltar);
    mira.addEventListener("pointercancel", soltar);

    render(null);

    // Entrada da seção, uma vez: título risca, mira e ficha sobem
    if (reduzido || !("IntersectionObserver" in win)) return;
    var secao = raiz.closest("section") || raiz;
    secao.classList.add("com-entrada");
    var obs = new win.IntersectionObserver(function (entradas) {
      if (!entradas[0].isIntersecting) return;
      secao.classList.add("visivel");
      obs.disconnect();
    }, { rootMargin: "0px 0px -15% 0px" });
    obs.observe(raiz);
  }

  return {
    rotuloContagem: rotuloContagem,
    precisaSeletorCores: precisaSeletorCores,
    precisaSeletorArte: precisaSeletorArte,
    estadoInicial: estadoInicial,
    circular: circular,
    dois: dois,
    trocarEstampa: trocarEstampa,
    trocarCor: trocarCor,
    trocarArte: trocarArte,
    trocarLado: trocarLado,
    imagemAtual: imagemAtual,
    textoAlt: textoAlt,
    mensagemPedido: mensagemPedido,
    anuncio: anuncio,
    direcaoArrasto: direcaoArrasto,
    init: init
  };
});
