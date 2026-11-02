/* Intro "aquisição de alvo": o HUD liga, a mira caça o alvo pela tela (segue o mouse
   no computador) e trava no centro; o escudo é desenhado, o capacete entra com falha
   de sinal e as quatro cruzes batem como impactos. Na saída, um corte de laser abre a
   tela como porta blindada e o escudo voa até o cabeçalho.
   A intro também é a tela de carregamento do vídeo: o pente enche com o download. */
(function (raiz, fabrica) {
  var api = fabrica();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { raiz.PGLR = raiz.PGLR || {}; raiz.PGLR.intro = api; }
})(this, function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var EASE = "cubic-bezier(.22,.61,.36,1)";
  var EASE_SAIDA = "cubic-bezier(.16,1,.3,1)";
  var EASE_PORTA = "cubic-bezier(.8,0,.15,1)";
  var FADE_REDUZIDO_MS = 500;
  var BALAS = 24;
  var SINAIS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/%<>";

  // Linha do tempo (ms desde o início)
  var T = {
    varredura: 300,
    contorno: 520,
    capacete: 1380,
    trava: 1720,
    cruz: 1880,
    cruzPasso: 150,
    autorizado: 2520,
    fim: 2800
  };

  var LOG = [
    [0, "INICIANDO SISTEMA PGLR", "ok"],
    [200, "BASE: SÃO PAULO // SP", "ok"],
    [420, "CARREGANDO ARSENAL", "ok"],
    [680, "CALIBRANDO MIRA", "ok"],
    [T.trava, "ALVO ADQUIRIDO", "alerta"],
    [T.autorizado, "OPERADOR AUTORIZADO", "ok"]
  ];

  // Translação e escala que levam o centro de `origem` ao centro de `destino`.
  function calcularFlip(origem, destino) {
    return {
      dx: (destino.left + destino.width / 2) - (origem.left + origem.width / 2),
      dy: (destino.top + destino.height / 2) - (origem.top + origem.height / 2),
      escala: destino.width / origem.width
    };
  }

  function terminou(animacao) {
    return animacao.finished.catch(function () {});
  }

  function zeros(n, casas) {
    var s = String(Math.max(0, Math.round(n)));
    while (s.length < casas) s = "0" + s;
    return s;
  }

  // Timecode mm:ss:quadros a 24 fps
  function timecode(ms) {
    var q = Math.floor(ms / (1000 / 24));
    return zeros(Math.floor(q / 1440), 2) + ":" + zeros(Math.floor(q / 24) % 60, 2) + ":" + zeros(q % 24, 2);
  }

  function svg(tag, attrs, pai) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (pai) pai.appendChild(n);
    return n;
  }

  // Monta o retículo: anel externo com marcas (gira), anel pontilhado (gira ao contrário),
  // fios da mira com vão no centro, travas de canto e leituras.
  function montarMira(raiz) {
    var anel = svg("circle", { r: 182, "class": "anel", pathLength: 1 }, raiz);
    var marcasG = svg("g", {}, raiz);
    var marcas = svg("g", { "class": "girar marcas" }, marcasG);
    for (var i = 0; i < 72; i++) {
      var a = i * 5 * Math.PI / 180;
      var maior = i % 6 === 0;
      var r2 = maior ? 199 : 192;
      svg("line", {
        x1: (Math.cos(a) * 186).toFixed(2), y1: (Math.sin(a) * 186).toFixed(2),
        x2: (Math.cos(a) * r2).toFixed(2), y2: (Math.sin(a) * r2).toFixed(2),
        "class": maior ? "maior" : ""
      }, marcas);
    }
    var finoG = svg("g", {}, raiz);
    svg("circle", { r: 150, "class": "anel-fino" }, svg("g", { "class": "girar-contra" }, finoG));
    var fios = svg("g", { "class": "fios" }, raiz);
    [[0, -178, 0, -122], [0, 122, 0, 178], [-178, 0, -122, 0], [122, 0, 178, 0]].forEach(function (l) {
      svg("line", { x1: l[0], y1: l[1], x2: l[2], y2: l[3] }, fios);
    });
    var travas = svg("g", { "class": "travas", opacity: 0 }, raiz);
    ["M-104 -70 V-104 H-70", "M70 -104 H104 V-70", "M104 70 V104 H70", "M-70 104 H-104 V70"].forEach(function (d) {
      svg("path", { d: d }, travas);
    });
    var leitura = svg("text", { x: 118, y: -150, "class": "leitura" }, raiz);
    leitura.textContent = "ALC ----";
    var azimute = svg("text", { x: -118, y: 158, "text-anchor": "end" }, raiz);
    azimute.textContent = "AZ 000°";
    return { anel: anel, marcas: marcasG, fino: finoG, fios: fios, travas: travas, leitura: leitura, azimute: azimute };
  }

  function init(doc, opcoes) {
    var reduzido = !!(opcoes && opcoes.reduzido);
    var win = doc.defaultView || window;
    var html = doc.documentElement;
    var caixa = doc.getElementById("intro");
    var logo = doc.getElementById("logo-intro");
    var logoCaixa = caixa.querySelector(".intro-logo");
    var destino = doc.getElementById("logo-cabecalho");
    var palco = caixa.querySelector(".intro-palco");
    var hud = caixa.querySelector(".intro-hud");
    var carga = caixa.querySelector(".intro-carga");
    var corte = caixa.querySelector(".intro-corte");
    var portaCima = caixa.querySelector(".intro-porta-cima");
    var portaBaixo = caixa.querySelector(".intro-porta-baixo");
    var varredura = caixa.querySelector(".intro-varredura");
    var marcaDagua = caixa.querySelector(".intro-marca-dagua");
    var grade = caixa.querySelector(".intro-grade");
    var linhas = [].slice.call(caixa.querySelectorAll(".intro-linha"));
    var coord = doc.getElementById("intro-coord");
    var log = doc.getElementById("intro-log");
    var tempo = doc.getElementById("intro-tempo");
    var status = doc.getElementById("intro-status");
    var lema = doc.getElementById("intro-lema");
    var pente = doc.getElementById("intro-pente");
    var pct = doc.getElementById("intro-pct");
    var legenda = doc.getElementById("intro-legenda");
    var botaoPular = caixa.querySelector(".intro-pular");
    var mira = montarMira(doc.getElementById("intro-mira"));

    var animacoes = [];
    var agenda = [];
    var textos = [];      // digitação/embaralhamento em andamento (para o pular completar)
    var ativo = true;
    var inicio = win.performance.now();
    var progressoAlvo = 0, progressoVisto = 0, completo = false;

    caixa.hidden = false;

    var balas = [];
    for (var b = 0; b < BALAS; b++) balas.push(pente.appendChild(doc.createElement("i")));

    var resolverAnimacao;
    var animacao = new Promise(function (r) { resolverAnimacao = r; });

    function anima(el, quadros, op) {
      var a = el.animate(quadros, op);
      animacoes.push(a);
      return a;
    }

    // Agenda um passo; o pular roda todos os pendentes na hora, com rapido = true.
    function em(t, fn) {
      var item = { fn: fn, feito: false };
      item.id = win.setTimeout(function () { rodar(item, false); }, t);
      agenda.push(item);
    }
    function rodar(item, rapido) {
      if (item.feito) return;
      item.feito = true;
      item.fn(rapido);
    }

    // ---------- texto: digitar e embaralhar

    function digitar(texto, classe, rapido) {
      var li = log.appendChild(doc.createElement("li"));
      var job = { feito: false, fim: function () { job.feito = true; li.textContent = texto; if (classe) li.classList.add(classe); } };
      textos.push(job);
      if (rapido) { job.fim(); return; }
      var i = 0;
      (function passo() {
        if (job.feito) return;
        i += 1;
        li.textContent = texto.slice(0, i) + (i < texto.length ? "_" : "");
        if (i >= texto.length) job.fim();
        else win.setTimeout(passo, 16);
      })();
    }

    function embaralhar(el, texto, ms, rapido) {
      var job = { feito: false, fim: function () { job.feito = true; el.textContent = texto; } };
      textos.push(job);
      if (rapido) { job.fim(); return; }
      var t0 = win.performance.now();
      (function passo(agora) {
        if (job.feito) return;
        var f = Math.min(1, ((agora || t0) - t0) / ms);
        var fixos = Math.floor(f * texto.length);
        var s = texto.slice(0, fixos);
        for (var i = fixos; i < texto.length; i++) {
          s += texto[i] === " " ? " " : SINAIS[(Math.random() * SINAIS.length) | 0];
        }
        el.textContent = s;
        if (f >= 1) job.fim();
        else win.requestAnimationFrame(passo);
      })();
    }

    // ---------- mira caçando o alvo

    // O alvo fica em frações da tela e o tamanho é lido a cada quadro: no celular a
    // janela pode ainda medir 0 quando o script roda.
    var largura = 0, altura = 0;
    var pos = null;
    var alvo = { x: 0.18, y: 0.28 };
    var travado = false, usouPonteiro = false;

    function medir() {
      largura = win.innerWidth || html.clientWidth || 1;
      altura = win.innerHeight || html.clientHeight || 1;
    }

    function aoMover(e) {
      if (travado || e.pointerType === "touch") return;
      medir();
      usouPonteiro = true;
      alvo.x = e.clientX / largura;
      alvo.y = e.clientY / altura;
    }

    function quadro(agora) {
      if (!ativo) return;
      medir();
      if (!pos) pos = { x: alvo.x * largura, y: alvo.y * altura };
      var k = travado ? 0.2 : 0.085;
      var ax = alvo.x * largura, ay = alvo.y * altura;
      pos.x += (ax - pos.x) * k;
      pos.y += (ay - pos.y) * k;
      palco.style.setProperty("--mx", pos.x.toFixed(1) + "px");
      palco.style.setProperty("--my", pos.y.toFixed(1) + "px");
      coord.textContent = travado && Math.abs(ax - pos.x) < 1
        ? "TRAVADO"
        : "X " + zeros(pos.x, 4) + " · Y " + zeros(pos.y, 4);
      if (!travado) mira.leitura.textContent = "ALC " + zeros(300 + Math.random() * 600, 4);
      mira.azimute.textContent = "AZ " + zeros((Math.atan2(pos.y - altura / 2, pos.x - largura / 2) * 180 / Math.PI + 450) % 360, 3) + "°";
      tempo.textContent = timecode(agora - inicio);

      // contador do pente persegue o progresso real do download
      progressoVisto += (progressoAlvo - progressoVisto) * 0.14;
      if (progressoAlvo - progressoVisto < 0.004) progressoVisto = progressoAlvo;
      pintarCarga();

      win.requestAnimationFrame(quadro);
    }

    function pintarCarga() {
      pct.textContent = zeros(progressoVisto * 100, 3);
      var n = Math.round(progressoVisto * BALAS);
      for (var i = 0; i < BALAS; i++) balas[i].classList.toggle("cheio", i < n);
      if (!completo && progressoVisto >= 1) {
        completo = true;
        pente.classList.add("completo");
        legenda.textContent = "PRONTO PRA MISSÃO";
      }
    }

    // ---------- impactos

    function onda(forte, escala) {
      var o = palco.appendChild(doc.createElement("i"));
      o.className = "intro-onda" + (forte ? " forte" : "");
      var a = o.animate(
        [{ transform: "scale(.35)", opacity: forte ? 0.9 : 0.6 }, { transform: "scale(" + escala + ")", opacity: 0 }],
        { duration: forte ? 900 : 600, easing: EASE_SAIDA });
      a.finished.then(function () { o.remove(); }, function () { o.remove(); });
    }

    function tremer(forca) {
      var q = [];
      for (var i = 0; i < 6; i++) {
        var f = forca * (1 - i / 6);
        q.push((Math.random() * 2 - 1) * f, (Math.random() * 2 - 1) * f);
      }
      palco.animate([0, 2, 4, 6, 8, 10, 12].map(function (j) {
        return { transform: j < 12 ? "translate(" + q[j].toFixed(1) + "px," + q[j + 1].toFixed(1) + "px)" : "none" };
      }), { duration: 220, easing: "linear" });
      logoCaixa.animate([0, 2, 4, 6, 8, 10, 12].map(function (j) {
        return { transform: "translate(-50%,-50%)" + (j < 12 ? " translate(" + (q[j] * 0.6).toFixed(1) + "px," + (q[j + 1] * 0.6).toFixed(1) + "px)" : "") };
      }), { duration: 220, easing: "linear" });
    }

    // ---------- sequência

    function sequencia() {
      if (reduzido) {
        caixa.classList.add("intro-pronta", "travado");
        mira.travas.setAttribute("opacity", 1);
        mira.leitura.textContent = "ALC 0412";
        status.textContent = "ALVO TRAVADO";
        LOG.forEach(function (l) { digitar(l[1], l[2], true); });
        [palco, hud, logoCaixa, carga].forEach(function (el) {
          anima(el, [{ opacity: 0 }, { opacity: 1 }], { duration: FADE_REDUZIDO_MS, fill: "both" });
        });
        em(FADE_REDUZIDO_MS, function () { resolverAnimacao(); });
        return;
      }

      // o contorno começa escondido (é desenhado depois)
      var contorno = logo.querySelector("#escudo-contorno");
      var comprimento = contorno.getTotalLength();
      contorno.style.strokeDasharray = comprimento;
      contorno.style.strokeDashoffset = comprimento;

      // 0 ms: o HUD liga
      em(0, function (rapido) {
        anima(grade, [{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: "linear", fill: "both" });
        anima(marcaDagua, [
          { opacity: 0, transform: "translate(-50%,-50%) scale(1.3)" },
          { opacity: 1, transform: "translate(-50%,-50%) scale(1)" }
        ], { duration: 2600, easing: EASE_SAIDA, fill: "both" });
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (d, i) {
          anima(hud.querySelector(".hud-c" + (i + 1)), [
            { opacity: 0, transform: "translate(" + d[0] * 26 + "px," + d[1] * 26 + "px)" },
            { opacity: 1, transform: "none" }
          ], { duration: 420, delay: i * 60, easing: EASE_SAIDA, fill: "both" });
        });
        var titulo = hud.querySelector(".hud-titulo");
        anima(titulo, [{ opacity: 0 }, { opacity: 1 }], { duration: 120, fill: "both" });
        embaralhar(titulo.firstChild, "PGLR//TAC-OS ", 500, rapido);
        [hud.querySelector(".hud-bl"), hud.querySelector(".hud-br"), carga].forEach(function (el, i) {
          anima(el, [{ opacity: 0, transform: el === carga ? "translate(-50%,10px)" : "translateY(10px)" },
                     { opacity: 1, transform: el === carga ? "translate(-50%,0)" : "none" }],
            { duration: 500, delay: 250 + i * 80, easing: EASE_SAIDA, fill: "both" });
        });
        embaralhar(status, "PROCURANDO ALVO", 600, rapido);

        // retículo
        anima(mira.anel, [{ strokeDasharray: "1 1", strokeDashoffset: 1 }, { strokeDasharray: "1 1", strokeDashoffset: 0 }],
          { duration: 900, easing: EASE, fill: "both" });
        anima(mira.marcas, [{ opacity: 0, transform: "rotate(-140deg) scale(.8)" }, { opacity: 1, transform: "none" }],
          { duration: 1200, easing: EASE_SAIDA, fill: "both" });
        anima(mira.fino, [{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "none" }],
          { duration: 900, delay: 200, easing: EASE_SAIDA, fill: "both" });
        anima(mira.fios, [{ opacity: 0, transform: "scale(1.7)" }, { opacity: 1, transform: "none" }],
          { duration: 700, delay: 280, easing: EASE_SAIDA, fill: "both" });
        linhas.concat(coord, mira.leitura, mira.azimute).forEach(function (el) {
          anima(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 120, fill: "both" });
        });
      });

      // log digitado
      LOG.forEach(function (l) { em(l[0], function (rapido) { digitar(l[1], l[2], rapido); }); });

      // a mira caça: sem mouse, passa por alguns pontos antes de travar
      [[550, 0.74, 0.66], [1150, 0.36, 0.6]].forEach(function (p) {
        em(p[0], function () {
          if (usouPonteiro || travado) return;
          alvo.x = p[1];
          alvo.y = p[2];
        });
      });

      // varredura de cima a baixo
      em(T.varredura, function () {
        anima(varredura, [
          { opacity: 1, transform: "translateY(-130px)" },
          { opacity: 1, transform: "translateY(" + ((win.innerHeight || html.clientHeight) + 10) + "px)" }
        ], { duration: 1150, easing: "cubic-bezier(.4,0,.6,1)", fill: "both" });
      });

      // contorno do escudo
      em(T.contorno, function () {
        anima(contorno, [{ strokeDashoffset: comprimento }, { strokeDashoffset: 0 }],
          { duration: 1000, easing: EASE, fill: "both" });
        anima(logo, [
          { filter: "drop-shadow(0 0 0 rgba(255,255,255,0))" },
          { filter: "drop-shadow(0 0 14px rgba(255,255,255,.35))", offset: 0.7 },
          { filter: "drop-shadow(0 0 0 rgba(255,255,255,0))" }
        ], { duration: 1400, easing: "linear" });
      });

      // capacete entra com falha de sinal (RGB separado)
      em(T.capacete, function () {
        var rgb = function (d, a) {
          return "drop-shadow(" + d + "px 0 0 rgba(255,59,47," + a + ")) drop-shadow(" + (-d) + "px 0 0 rgba(0,220,255," + a + "))";
        };
        anima(logo.querySelector("#capacete"), [
          { opacity: 0, transform: "translate(0,0)", filter: rgb(0, 0) },
          { opacity: 1, transform: "translate(-3px,0)", filter: rgb(3, 0.9), offset: 0.14 },
          { opacity: 0, transform: "translate(2px,0)", filter: rgb(2, 0.9), offset: 0.24 },
          { opacity: 1, transform: "translate(2px,0)", filter: rgb(-3, 0.9), offset: 0.38 },
          { opacity: 0.35, transform: "translate(-1px,0)", filter: rgb(1, 0.6), offset: 0.48 },
          { opacity: 1, transform: "translate(0,0)", filter: rgb(0, 0), offset: 0.62 },
          { opacity: 1, transform: "translate(0,0)", filter: rgb(0, 0) }
        ], { duration: 460, easing: "linear", fill: "both" });
      });

      // trava no alvo
      em(T.trava, function (rapido) {
        travado = true;
        alvo.x = 0.5;
        alvo.y = 0.5;
        if (rapido) pos = null;
        caixa.classList.add("travado");
        mira.leitura.textContent = "ALC 0412";
        anima(mira.travas, [
          { opacity: 0, transform: "scale(2.2) rotate(45deg)" },
          { opacity: 1, transform: "scale(.92) rotate(0deg)", offset: 0.7 },
          { opacity: 1, transform: "scale(1) rotate(0deg)" }
        ], { duration: 340, easing: EASE_SAIDA, fill: "both" });
        embaralhar(status, "ALVO TRAVADO", 300, rapido);
      });

      // quatro cruzes batem como impactos
      for (var i = 1; i <= 4; i++) {
        (function (i) {
          em(T.cruz + (i - 1) * T.cruzPasso, function (rapido) {
            anima(logo.querySelector("#cruz-" + i), [
              { opacity: 0, transform: "scale(3)" },
              { opacity: 1, transform: "scale(.86)", offset: 0.6 },
              { opacity: 1, transform: "scale(1)" }
            ], { duration: 230, easing: "cubic-bezier(.5,0,.3,1)", fill: "both" });
            if (rapido) return;
            win.setTimeout(function () {
              var ultima = i === 4;
              onda(ultima, ultima ? 3.4 : 1.4 + i * 0.25);
              tremer(ultima ? 9 : 3 + i);
              if (ultima) {
                try {
                  caixa.animate([{ opacity: 0 }, { opacity: 0.14 }, { opacity: 0 }],
                    { duration: 200, pseudoElement: "::after" });
                } catch (e) {}
              }
            }, 140);
          });
        })(i);
      }

      em(T.autorizado, function (rapido) { embaralhar(lema, "SE VIS PACEM · PARA BELLUM", 500, rapido); });
      em(T.fim, function () { resolverAnimacao(); });
    }

    function pular() {
      agenda.forEach(function (item) { win.clearTimeout(item.id); rodar(item, true); });
      animacoes.forEach(function (a) { try { a.finish(); } catch (e) {} });
      textos.forEach(function (j) { if (!j.feito) j.fim(); });
      botaoPular.hidden = true;
    }

    function aoTeclar(e) { if (e.key === "Escape") pular(); }

    function setProgresso(f) {
      progressoAlvo = Math.max(progressoAlvo, Math.min(1, f || 0));
      if (reduzido) { progressoVisto = progressoAlvo; pintarCarga(); }
    }

    function encerrar() {
      ativo = false;
      win.removeEventListener("pointermove", aoMover);
      html.classList.remove("intro-ativa");
      caixa.classList.add("oculta");
      caixa.setAttribute("aria-hidden", "true");
    }

    function sair() {
      doc.removeEventListener("keydown", aoTeclar);
      botaoPular.hidden = true;
      progressoAlvo = progressoVisto = 1;
      pintarCarga();
      var etapas = [];

      if (reduzido) {
        etapas.push(terminou(caixa.animate([{ opacity: 1 }, { opacity: 0 }],
          { duration: FADE_REDUZIDO_MS, fill: "both" })));
        return Promise.all(etapas).then(encerrar);
      }

      var CORTE_MS = 200;
      var PORTA_MS = 820;
      html.classList.add("intro-entrada");
      caixa.classList.add("saindo");

      // disparo: flash curto e o laser corta a tela no meio
      try {
        caixa.animate([{ opacity: 0 }, { opacity: 0.4 }, { opacity: 0 }],
          { duration: 220, pseudoElement: "::after" });
      } catch (e) {}
      corte.animate([
        { opacity: 1, transform: "scaleX(0)" },
        { opacity: 1, transform: "scaleX(1)", offset: 0.3 },
        { opacity: 1, transform: "scaleX(1)", offset: 0.55 },
        { opacity: 0, transform: "scaleX(1) scaleY(6)" }
      ], { duration: CORTE_MS + 420, easing: EASE_SAIDA, fill: "both" });

      // HUD, retículo e pente somem
      palco.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(1.35)" }],
        { duration: 520, delay: 80, easing: EASE_SAIDA, fill: "both" });
      hud.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: "linear", fill: "both" });
      carga.animate([{ opacity: 1, transform: "translate(-50%,0)" }, { opacity: 0, transform: "translate(-50%,24px)" }],
        { duration: 300, easing: EASE, fill: "both" });

      // portas blindadas abrem
      etapas.push(terminou(portaCima.animate([{ transform: "none" }, { transform: "translateY(-101%)" }],
        { duration: PORTA_MS, delay: CORTE_MS, easing: EASE_PORTA, fill: "both" })));
      etapas.push(terminou(portaBaixo.animate([{ transform: "none" }, { transform: "translateY(101%)" }],
        { duration: PORTA_MS, delay: CORTE_MS, easing: EASE_PORTA, fill: "both" })));

      // escudo voa até o cabeçalho
      var voo = calcularFlip(logo.getBoundingClientRect(), destino.getBoundingClientRect());
      etapas.push(terminou(logo.animate([
        { transform: "none", filter: "drop-shadow(0 0 0 rgba(255,59,47,0))" },
        { transform: "translate(" + voo.dx * 0.12 + "px," + voo.dy * 0.12 + "px) scale(1.08)", filter: "drop-shadow(0 0 16px rgba(255,59,47,.6))", offset: 0.25 },
        { transform: "translate(" + voo.dx + "px," + voo.dy + "px) scale(" + voo.escala + ")", filter: "drop-shadow(0 0 0 rgba(255,59,47,0))" }
      ], { duration: 900, delay: CORTE_MS - 60, easing: EASE, fill: "both" })));

      return Promise.all(etapas).then(encerrar);
    }

    botaoPular.addEventListener("click", pular);
    doc.addEventListener("keydown", aoTeclar);
    win.addEventListener("pointermove", aoMover, { passive: true });
    sequencia();
    if (!reduzido) win.requestAnimationFrame(quadro);
    else pintarCarga();

    return { animacao: animacao, setProgresso: setProgresso, pular: pular, sair: sair };
  }

  return { calcularFlip: calcularFlip, timecode: timecode, init: init };
});
