/* Vitrine do Arsenal (C+): uma estampa por vez dentro da mira, com as vizinhas apagadas
   nas bordas, um trilho com todas as miniaturas, cores, artes, costas/frente e o pedido
   pronto no WhatsApp. Troca por arrasto, setas, miniaturas ou teclado (← →). */
(function (raiz, fabrica) {
  var api = fabrica();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { raiz.PGLR = raiz.PGLR || {}; raiz.PGLR.vitrine = api; }
})(this, function () {
  "use strict";

  var CURVA = "cubic-bezier(0.23, 1, 0.32, 1)";       // a mesma de --ease-out
  // O giro é um ease-in-out partido no meio: a ida acelera até a camisa ficar de lado,
  // a volta freia até ela ficar de frente (easeInCubic / easeOutQuart, easings.net).
  // A ida é mais curta, para o giro responder logo ao toque.
  var CURVA_IDA = "cubic-bezier(0.32, 0, 0.67, 0)";
  var CURVA_VOLTA = "cubic-bezier(0.25, 1, 0.5, 1)";
  var GIRO_MS = 440;          // giro inteiro (de frente → de lado → de frente com a nova estampa)
  var GIRO_ARRASTO = 0.35;    // graus de giro por px arrastado
  var GIRO_MAX = 75;          // limite do giro durante o arrasto
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

    // Cor ou arte: a foto esmaece e volta com a nova (160 ms no total).
    function trocarFoto(src, alt) {
      var minha = ++geracao;
      parar(camisa);
      camisa.style.transform = "";
      var saida = camisa.animate([{ opacity: 1 }, { opacity: 0 }],
        { duration: reduzido ? 75 : 80, easing: CURVA, fill: "forwards" });
      Promise.all([saida.finished.catch(function () {}), precarregar(src)]).then(function () {
        if (minha !== geracao) return;
        foto.src = src;
        foto.alt = alt;
        parar(camisa);
        camisa.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduzido ? 75 : 80, easing: CURVA });
      });
    }

    // Uma segunda imagem, já decodificada, fica por baixo do giro: no meio dele ela aparece
    // na hora (trocar o src da foto principal leva um ou dois quadros para pintar, e a
    // estampa antiga apareceria espelhada do outro lado).
    var reserva = doc.createElement("img");
    reserva.className = "foto-reserva";
    reserva.alt = "";
    reserva.setAttribute("aria-hidden", "true");
    camisa.appendChild(reserva);

    function prepararReserva(src) {
      reserva.style.visibility = "hidden";
      reserva.src = src;
      return (reserva.decode ? reserva.decode() : precarregar(src)).catch(function () {});
    }

    function mostrarNova(src, alt) {
      reserva.style.visibility = "visible";
      foto.src = src;
      foto.alt = alt;
      var esconder = function () { if (foto.getAttribute("src") === src) reserva.style.visibility = "hidden"; };
      (foto.decode ? foto.decode() : Promise.resolve()).then(esconder, esconder);
    }

    // Estampa ou lado: a camisa gira em Y como numa vitrine giratória. Vai de frente até
    // ficar de lado (90°), troca a foto exatamente aí e volta de frente já com a nova.
    // dir = +1 gira para a esquerda (próxima), -1 para a direita (anterior).
    // deAng: de onde começar (o arrasto já deixou a camisa um pouco girada).
    function girar(src, alt, dir, deAng) {
      var minha = ++geracao;
      var a0 = deAng || 0;
      parar(camisa);
      camisa.style.transform = a0 ? "rotateY(" + a0 + "deg)" : "";
      prepararReserva(src).then(function () {
        if (minha !== geracao) return;
        camisa.style.transform = "";
        if (reduzido) {
          mostrarNova(src, alt);
          camisa.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: CURVA });
          return;
        }
        var sai = -90 * dir, entra = 90 * dir;
        function pose(ang, escala, luz) {
          return { transform: "rotateY(" + ang + "deg) scale(" + escala + ")", filter: "brightness(" + luz + ")" };
        }
        // ida: de onde estiver até ficar de lado (mais curta se o arrasto já girou um pouco)
        var ida = camisa.animate([pose(a0, 1, 1), pose(sai, 0.92, 0.5)], {
          duration: GIRO_MS * 0.42 * (1 - Math.min(Math.abs(a0), 80) / 90),
          easing: CURVA_IDA,
          fill: "forwards"
        });
        // de lado ela é só um risco: é aí que a foto troca, e a volta começa do outro lado
        ida.finished.then(function () {
          if (minha !== geracao) return;
          mostrarNova(src, alt);
          parar(camisa);
          camisa.animate([pose(entra, 0.92, 0.5), pose(0, 1, 1)], { duration: GIRO_MS * 0.58, easing: CURVA_VOLTA });
        }, function () {});
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
    function render(tipo, dir, deAng) {
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
        girar(src, alt, dir, deAng);
      } else if (tipo === "lado") {
        varrer();
        girar(src, alt, estado.lado === "frente" ? 1 : -1, 0);
      } else if (tipo) {
        trocarFoto(src, alt);
      } else {
        foto.src = src;
        foto.alt = alt;
      }
      // as vizinhas ficam prontas para a próxima troca não piscar
      precarregar(srcAnt);
      precarregar(srcProx);
    }

    function irPara(i, dir, deAng) {
      i = circular(i, n);
      if (i === estado.indice) return;
      dir = dir || (i > estado.indice ? 1 : -1);   // antes de trocar o estado
      estado = trocarEstampa(estado, i, n);
      render("estampa", dir, deAng);
    }
    function avancar(deAng) { irPara(estado.indice + 1, 1, deAng); }
    function voltar(deAng) { irPara(estado.indice - 1, -1, deAng); }

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

    // Arrasto na mira gira a camisa junto com o dedo (o navegador continua cuidando da
    // rolagem vertical: touch-action: pan-y). Soltando além do gatilho, o giro continua.
    var arrasto = null;
    mira.addEventListener("pointerdown", function (ev) {
      if (ev.button !== 0 || ev.target.closest("button")) return;
      arrasto = { x0: ev.clientX, x: ev.clientX, t: ev.timeStamp, v: 0, ang: 0, id: ev.pointerId };
      try { mira.setPointerCapture(ev.pointerId); } catch (e) {}
      parar(camisa);
    });
    mira.addEventListener("pointermove", function (ev) {
      if (!arrasto || ev.pointerId !== arrasto.id) return;
      var dt = ev.timeStamp - arrasto.t;
      if (dt > 0) arrasto.v = (ev.clientX - arrasto.x) / dt;
      arrasto.x = ev.clientX;
      arrasto.t = ev.timeStamp;
      arrasto.ang = Math.max(-GIRO_MAX, Math.min(GIRO_MAX, (arrasto.x - arrasto.x0) * GIRO_ARRASTO));
      if (!reduzido) camisa.style.transform = "rotateY(" + arrasto.ang.toFixed(1) + "deg)";
    });
    function soltar(ev) {
      if (!arrasto || ev.pointerId !== arrasto.id) return;
      var dx = arrasto.x - arrasto.x0, dir = direcaoArrasto(dx, arrasto.v), ang = reduzido ? 0 : arrasto.ang;
      arrasto = null;
      if (dir > 0) { avancar(ang); return; }
      if (dir < 0) { voltar(ang); return; }
      camisa.style.transform = "";
      if (ang) {
        camisa.animate([{ transform: "rotateY(" + ang + "deg)" }, { transform: "none" }],
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
