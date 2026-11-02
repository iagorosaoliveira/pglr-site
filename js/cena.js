/* Cena da rolagem — animação própria em canvas, sem vídeo.
   Uma nuvem de partículas controlada pela rolagem, em quatro fases:
     1. RECONHECIMENTO  terreno topográfico em perspectiva, varrido por um radar;
     2. FORMAÇÃO        as partículas sobem do terreno e se montam no escudo PGLR;
     3. TRAVADO         o escudo fica inteiro e uma varredura laser passa por ele;
     4. DISPERSÃO       o escudo se desfaz em direção à câmera, com onda de choque.
   Por cima, três painéis de texto entram e saem (cada um com seu trecho da trilha).

   O escudo é amostrado dos próprios paths do logo (#logo-intro) com Path2D, então
   nada é baixado: a cena fica pronta na hora, em qualquer resolução. */
(function (raiz, fabrica) {
  var api = fabrica();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { raiz.PGLR = raiz.PGLR || {}; raiz.PGLR.cena = api; }
})(this, function () {
  "use strict";

  // Cada painel ocupa um trecho da trilha: [entraInício, entraFim, saiInício, saiFim]
  // em progresso 0..1. Os vãos entre o fim de um e o começo do próximo são zonas
  // mortas de propósito (só animação), para dois painéis nunca ficarem legíveis juntos.
  var CUES = [
    [0.00, 0.00, 0.15, 0.23],
    [0.35, 0.43, 0.57, 0.65],
    [0.77, 0.85, 1.10, 1.20]
  ];
  var DRIFT = 22;              // px de deslocamento contrário à rolagem por painel
  var SUAVIZACAO = 0.115;      // fração do caminho que a animação anda até a rolagem, por quadro
  var LIMIAR = 0.0004;
  // Onde cada capítulo do trilho leva a rolagem (meio do trecho em que o painel está inteiro)
  var PARADAS = [0, 0.5, 0.88];

  // Fases da animação (início de cada uma, em progresso)
  var FORMA_INI = 0.25, FORMA_FIM = 0.60, DISPERSA_INI = 0.80;
  var FASES = [
    [0, "RECONHECIMENTO"],
    [FORMA_INI, "FORMAÇÃO"],
    [FORMA_FIM, "TRAVADO"],
    [DISPERSA_INI, "DISPERSÃO"]
  ];

  var BRANCO = "rgb(236,235,231)";
  var VERMELHO = "rgb(255,59,47)";
  var CAM = 4.2;               // distância da câmera (z = 0 fica em escala 1)
  var INCLINA = 0.46;          // inclinação da câmera sobre o terreno (~26°), em radianos
  var DESCE_TERRENO = 0.42;    // o terreno fica um pouco abaixo do centro, como um horizonte
  var RAIO_TERRENO = 1.9;
  var TAU = Math.PI * 2;

  // ---------- funções puras

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function ramp(p, a, b) {
    if (b <= a) return p >= b ? 1 : 0;
    return smooth(clamp((p - a) / (b - a), 0, 1));
  }
  function linear(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }

  function estadoPainel(p, cue, drift) {
    var entra = ramp(p, cue[0], cue[1]);
    var sai = ramp(p, cue[2], cue[3]);
    return { opacidade: entra * (1 - sai), y: (1 - entra) * drift - sai * drift, entra: entra, sai: sai };
  }

  function progressoTrilha(scrollY, topoTrilha, alturaTrilha, alturaJanela) {
    var curso = alturaTrilha - alturaJanela;
    if (curso <= 0) return 0;
    return clamp((scrollY - topoTrilha) / curso, 0, 1);
  }

  function escurecimento(p) { return ramp(p, 0.92, 1); }

  // A animação persegue a rolagem em vez de pular para ela: é o que deixa a cena macia.
  function perseguir(atual, alvo) {
    var gap = alvo - atual;
    return Math.abs(gap) > LIMIAR ? atual + gap * SUAVIZACAO : alvo;
  }

  function faseEm(p) {
    var i = 0;
    while (i + 1 < FASES.length && p >= FASES[i + 1][0]) i++;
    return i;
  }

  // Relevo do terreno: soma de senos (barato e sem emenda)
  function relevo(x, z) {
    return -0.2 * Math.sin(1.7 * x + 0.5) * Math.cos(1.3 * z)
      - 0.11 * Math.sin(3.1 * z + 2 * x)
      - 0.05 * Math.sin(5 * x - 4 * z);
  }

  // ---------- partículas

  // Desenha os paths do logo num canvas fora da tela e guarda um ponto a cada `passo` px
  // onde há tinta. Devolve pontos normalizados: centro em 0, altura de -1 a 1.
  function amostrarEscudo(doc, passo) {
    var L = 300;
    var c = doc.createElement("canvas");
    c.width = c.height = L;
    var g = c.getContext("2d");
    var logo = doc.getElementById("logo-intro");
    var pts = [];
    try {
      g.scale(L / 150, L / 150);
      g.fillStyle = "#fff";
      g.strokeStyle = "#fff";
      g.lineJoin = "miter";
      [].forEach.call(logo.querySelectorAll("path"), function (p) {
        var d = new Path2D(p.getAttribute("d"));
        if (p.getAttribute("fill") === "none") {
          g.lineWidth = Number(p.getAttribute("stroke-width")) || 6;
          g.stroke(d);
        } else {
          g.fill(d);
        }
      });
      var dados = g.getImageData(0, 0, L, L).data;
      for (var y = 0; y < L; y += passo) {
        for (var x = 0; x < L; x += passo) {
          if (dados[(y * L + x) * 4 + 3] > 128) pts.push(x, y);
        }
      }
    } catch (e) {}
    if (!pts.length) {
      // sem Path2D: um anel simples para a cena não ficar vazia
      for (var a = 0; a < 900; a++) pts.push(150 + Math.cos(a / 900 * TAU) * 120, 150 + Math.sin(a / 900 * TAU) * 120);
    }
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, i;
    for (i = 0; i < pts.length; i += 2) {
      minX = Math.min(minX, pts[i]); maxX = Math.max(maxX, pts[i]);
      minY = Math.min(minY, pts[i + 1]); maxY = Math.max(maxY, pts[i + 1]);
    }
    var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, k = 2 / (maxY - minY || 1);
    var out = new Float32Array(pts.length);
    for (i = 0; i < pts.length; i += 2) {
      out[i] = (pts[i] - cx) * k;
      out[i + 1] = (pts[i + 1] - cy) * k;
    }
    return out;
  }

  // `extra` partículas só existem no terreno (dão densidade ao mapa e somem na formação)
  function criarParticulas(doc, passo, extra) {
    var escudo = amostrarEscudo(doc, passo);
    var nEscudo = escudo.length / 2;
    var n = nEscudo + extra;
    var P = {
      n: n,
      sx: new Float32Array(n), sy: new Float32Array(n), sz: new Float32Array(n),
      tx: new Float32Array(n), ty: new Float32Array(n), tz: new Float32Array(n),
      ex: new Float32Array(n), ey: new Float32Array(n), ez: new Float32Array(n),
      ang: new Float32Array(n),      // ângulo no terreno (para a varredura do radar)
      curva: new Float32Array(n),    // 1 sobre uma curva de nível
      atraso: new Float32Array(n),   // ordem de chegada ao escudo
      rnd: new Float32Array(n),
      fase: new Float32Array(n),
      alvo: new Uint8Array(n),       // pontos vermelhos fixos
      soTerreno: new Uint8Array(n),
      // saída do quadro
      px: new Float32Array(n), py: new Float32Array(n), ps: new Float32Array(n), pa: new Float32Array(n), pv: new Uint8Array(n)
    };
    var jit = passo / 300 * 0.5;
    for (var i = 0; i < n; i++) {
      var q = i < nEscudo ? i : (Math.random() * nEscudo) | 0;
      P.soTerreno[i] = i < nEscudo ? 0 : 1;
      var sx = escudo[q * 2] + (Math.random() - 0.5) * jit;
      var sy = escudo[q * 2 + 1] + (Math.random() - 0.5) * jit;
      P.sx[i] = sx;
      P.sy[i] = sy;
      P.sz[i] = (Math.random() - 0.5) * 0.06;

      var r = RAIO_TERRENO * Math.sqrt(Math.random());
      var a = Math.random() * TAU;
      var x = Math.cos(a) * r, z = Math.sin(a) * r;
      var h = relevo(x, z);
      P.tx[i] = x; P.ty[i] = h; P.tz[i] = z;
      P.ang[i] = a;
      var f = h / 0.07;
      P.curva[i] = Math.abs(f - Math.round(f)) < 0.13 ? 1 : 0;

      var dx = sx + (Math.random() - 0.5) * 0.7, dy = sy + (Math.random() - 0.5) * 0.7;
      var dl = Math.sqrt(dx * dx + dy * dy) || 1;
      var dist = 1.2 + Math.random() * 2.4;
      P.ex[i] = sx + dx / dl * dist;
      P.ey[i] = sy + dy / dl * dist;
      P.ez[i] = -(1 + Math.random() * 2.6);

      P.rnd[i] = Math.random();
      P.atraso[i] = clamp((sy + 1) / 2 * 0.65 + Math.random() * 0.35, 0, 1);
      P.fase[i] = Math.random() * TAU;
      P.alvo[i] = Math.random() < 0.025 ? 1 : 0;
    }
    return P;
  }

  // ---------- desenho de um quadro

  function desenhar(g, P, larg, alt, dpr, pe, t, economia) {
    var cx = larg / 2, cy = alt / 2;
    var escala = Math.min(larg, alt) * 0.34;
    var mLin = linear(pe, FORMA_INI, FORMA_FIM);
    var mm = smooth(mLin);
    var eLin = linear(pe, DISPERSA_INI, 1);
    var e = smooth(eLin);
    var radar = 1 - mm;

    // câmera: inclinada sobre o terreno, gira; endireita para o escudo e balança de leve
    var ryTerreno = t * 0.05 + pe * 1.6;
    var balanço = Math.sin(t * 0.6) * 0.16 * (1 - e);
    var rx = INCLINA * (1 - mm);
    var ry = ryTerreno * (1 - mm) + balanço * mm;
    var cX = Math.cos(rx), sX = Math.sin(rx), cY = Math.cos(ry), sY = Math.sin(ry);

    function projetar(x, y, z, saida) {
      var x1 = x * cY - z * sY;
      var z1 = x * sY + z * cY;
      var y2 = y * cX - z1 * sX;
      var z2 = y * sX + z1 * cX;
      var d = CAM + z2;
      if (d < 0.35) { saida[2] = 0; return; }
      var s = CAM / d;
      saida[0] = cx + x1 * s * escala;
      saida[1] = cy + y2 * s * escala;
      saida[2] = s;
    }

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, larg, alt);
    g.globalCompositeOperation = "lighter";

    var tmp = [0, 0, 0];
    var varre = t * 1.3 % TAU;                      // ângulo do radar
    var scanY = -1.3 + 2.6 * linear(pe, FORMA_FIM, DISPERSA_INI);
    var temScan = pe > FORMA_FIM - 0.02 && pe < DISPERSA_INI + 0.02;

    // ---- anéis e varredura do radar no plano do terreno
    if (radar > 0.01) {
      g.lineWidth = 1;
      g.strokeStyle = BRANCO;
      [0.5, 1.0, 1.5, RAIO_TERRENO].forEach(function (r, k) {
        g.globalAlpha = (k === 3 ? 0.2 : 0.11) * radar;
        g.beginPath();
        for (var a = 0; a <= 72; a++) {
          var an = a / 72 * TAU;
          projetar(Math.cos(an) * r, DESCE_TERRENO, Math.sin(an) * r, tmp);
          if (a) g.lineTo(tmp[0], tmp[1]); else g.moveTo(tmp[0], tmp[1]);
        }
        g.stroke();
      });
      g.strokeStyle = VERMELHO;
      for (var k = 0; k < 14; k++) {
        var an2 = varre - k * 0.035;
        g.globalAlpha = (k ? 0.22 * (1 - k / 14) : 0.85) * radar;
        g.beginPath();
        projetar(0, DESCE_TERRENO, 0, tmp); g.moveTo(tmp[0], tmp[1]);
        projetar(Math.cos(an2) * RAIO_TERRENO, DESCE_TERRENO, Math.sin(an2) * RAIO_TERRENO, tmp); g.lineTo(tmp[0], tmp[1]);
        g.stroke();
      }
    }

    // ---- brilho atrás do escudo formado
    var presenca = mm * (1 - e);
    if (presenca > 0.01) {
      var brilho = g.createRadialGradient(cx, cy, 0, cx, cy, escala * 1.25);
      brilho.addColorStop(0, "rgba(236,235,231," + (0.09 * presenca).toFixed(3) + ")");
      brilho.addColorStop(1, "rgba(236,235,231,0)");
      g.globalAlpha = 1;
      g.fillStyle = brilho;
      g.fillRect(0, 0, larg, alt);
    }

    // ---- partículas
    for (var i = 0; i < P.n; i++) {
      var atraso = P.atraso[i];
      if (P.soTerreno[i] && (radar < 0.01 || (economia && i & 1))) { P.pa[i] = 0; continue; }
      var mi = smooth(clamp(mLin * 1.7 - atraso * 0.7, 0, 1));
      var ei = smooth(clamp(eLin * 1.5 - P.rnd[i] * 0.5, 0, 1));

      // terreno → escudo, com um arco no meio do caminho
      var arco = Math.sin(mi * Math.PI) * 0.55;
      var x = P.tx[i] + (P.sx[i] - P.tx[i]) * mi + Math.cos(P.fase[i]) * arco;
      var y = P.ty[i] + (P.sy[i] - P.ty[i]) * mi + Math.sin(P.fase[i]) * arco + DESCE_TERRENO * (1 - mi);
      var z = P.tz[i] + (P.sz[i] - P.tz[i]) * mi;
      // escudo → dispersão
      if (ei > 0) {
        x += (P.ex[i] - P.sx[i]) * ei;
        y += (P.ey[i] - P.sy[i]) * ei;
        z += (P.ez[i] - P.sz[i]) * ei;
      }
      projetar(x, y, z, tmp);
      if (!tmp[2]) { P.pa[i] = 0; continue; }

      var cintila = 0.72 + 0.28 * Math.sin(t * (1.2 + P.rnd[i] * 2.4) + P.fase[i]);
      var a = (0.32 + 0.68 * P.curva[i]) * (1 - mi) + mi;
      if (P.soTerreno[i]) a *= radar;
      a *= cintila;
      var tam = (1.7 + 0.6 * P.curva[i]) * (1 - mi) + 2.3 * mi;
      var verm = P.alvo[i];

      // o radar acende o que acabou de varrer
      if (radar > 0.01 && mi < 0.5) {
        var dif = (varre - P.ang[i]) % TAU;
        if (dif < 0) dif += TAU;
        if (dif < 0.9) { a += (1 - dif / 0.9) * 0.8 * radar; tam += (1 - dif / 0.9) * 0.8; }
      }
      // varredura laser sobre o escudo travado
      if (temScan && mi > 0.95) {
        var dy = Math.abs(P.sy[i] - scanY);
        if (dy < 0.06) { verm = 1; a = 1; tam = 2.6; }
        else if (dy < 0.22 && P.sy[i] < scanY) a += 0.25 * (1 - dy / 0.22);
      }
      a *= 1 - ei * 0.92;

      P.px[i] = tmp[0];
      P.py[i] = tmp[1];
      P.ps[i] = tam * Math.min(tmp[2], 3.2);
      P.pa[i] = clamp(a, 0, 1);
      P.pv[i] = verm;
    }

    // duas passadas (branco, depois vermelho) para trocar a cor só duas vezes
    for (var cor = 0; cor < 2; cor++) {
      g.fillStyle = cor ? VERMELHO : BRANCO;
      for (var j = 0; j < P.n; j++) {
        if (P.pv[j] !== cor || P.pa[j] < 0.02) continue;
        var s = P.ps[j];
        g.globalAlpha = P.pa[j];
        // coordenadas inteiras: sem antisserrilhado, raster bem mais barato
        g.fillRect((P.px[j] - s / 2) | 0, (P.py[j] - s / 2) | 0, s, s);
      }
    }

    // ---- linha do laser que varre o escudo travado
    if (temScan && mm > 0.95 && scanY > -1.05 && scanY < 1.05) {
      projetar(-1.1, scanY, 0, tmp);
      var lx0 = tmp[0], ly0 = tmp[1];
      projetar(1.1, scanY, 0, tmp);
      var halo = g.createLinearGradient(lx0, 0, tmp[0], 0);
      halo.addColorStop(0, "rgba(255,59,47,0)");
      halo.addColorStop(0.5, "rgba(255,59,47,1)");
      halo.addColorStop(1, "rgba(255,59,47,0)");
      g.strokeStyle = halo;
      g.globalAlpha = 0.9 * (1 - e);
      g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(lx0, ly0); g.lineTo(tmp[0], tmp[1]); g.stroke();
      g.globalAlpha = 0.18 * (1 - e);
      g.lineWidth = 10;
      g.stroke();
    }

    // ---- onda de choque da dispersão
    if (e > 0.001 && e < 0.999) {
      g.lineWidth = 1.5;
      g.strokeStyle = VERMELHO;
      for (var o = 0; o < 2; o++) {
        var eo = clamp(e * 1.3 - o * 0.3, 0, 1);
        if (eo <= 0) continue;
        g.globalAlpha = (1 - eo) * 0.7;
        g.beginPath();
        g.arc(cx, cy, escala * (0.4 + eo * 2.6), 0, TAU);
        g.stroke();
      }
    }

    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  // ---------- DOM

  function init(doc, opcoes) {
    var win = doc.defaultView;
    var html = doc.documentElement;
    var canvas = doc.getElementById("campo");
    var g = canvas.getContext("2d");
    var medidor = doc.getElementById("medidor");
    var trilha = doc.querySelector(".trilha");
    var cena = doc.querySelector(".cena");
    var escuro = doc.querySelector(".escurecer");
    var paineis = [].slice.call(doc.querySelectorAll("[data-painel]"));
    var capitulos = [].slice.call(doc.querySelectorAll("[data-capitulo]"));
    var alvo = doc.querySelector(".hud-alvo");
    var faseNum = doc.getElementById("fase-num");
    var faseNome = doc.getElementById("fase-nome");
    var reduzido = !!(opcoes && opcoes.reduzido);

    var estreita = win.innerWidth < 700;
    var P = criarParticulas(doc, estreita ? 3 : 2, estreita ? 1400 : 2600);
    var larg = 0, alt = 0, dpr = 1;
    var progress = 0, pe = 0, ready = false;
    var topo = 0, altura = 0;
    var ultimoAtivo = -1, ultimaFase = -1;
    // qualidade adaptativa: se os primeiros quadros desenhados forem lentos (aparelho
    // sem aceleração), metade das partículas do terreno deixa de ser desenhada
    var economia = false, amostras = 0, somaDt = 0, ultimoQuadro = 0;
    var t0 = win.performance.now();

    function dimensionar() {
      larg = canvas.clientWidth || win.innerWidth;
      alt = canvas.clientHeight || win.innerHeight;
      dpr = Math.min(win.devicePixelRatio || 1, larg < 700 ? 1.5 : 2);
      canvas.width = Math.round(larg * dpr);
      canvas.height = Math.round(alt * dpr);
    }

    // Trilho de capítulos: leva a rolagem até o painel escolhido
    capitulos.forEach(function (b) {
      b.addEventListener("click", function () {
        var i = Number(b.getAttribute("data-capitulo"));
        medir();
        win.scrollTo({ top: topo + PARADAS[i] * (altura - win.innerHeight), behavior: "smooth" });
      });
    });

    if (reduzido) {
      // Movimento reduzido: um quadro parado do escudo formado; o CSS (.reduzido)
      // empilha os painéis para rolarem normalmente.
      var estatico = function () { dimensionar(); desenhar(g, P, larg, alt, dpr, 0.7, 0); };
      estatico();
      win.addEventListener("resize", estatico);
      return { carregar: function () { return Promise.resolve(); }, liberar: function () {} };
    }

    function medir() {
      topo = trilha.getBoundingClientRect().top + win.pageYOffset;
      altura = trilha.offsetHeight;
    }

    function readScroll() {
      progress = progressoTrilha(win.pageYOffset, topo, altura, win.innerHeight);
    }

    function paint() {
      medidor.style.transform = "scaleX(" + progress + ")";
      html.classList.toggle("alem-da-trilha", win.pageYOffset > topo + altura - win.innerHeight + 1);
      var esc = escurecimento(progress);
      escuro.style.opacity = esc;
      cena.style.setProperty("--p", progress.toFixed(4));
      var maior = 0, ativo = 0;
      paineis.forEach(function (el, i) {
        var e = estadoPainel(progress, CUES[i], DRIFT);
        el.style.opacity = e.opacidade;
        el.style.transform = "translate3d(0," + e.y + "px,0)";
        el.style.setProperty("--e", e.entra.toFixed(4));
        el.style.setProperty("--s", e.sai.toFixed(4));
        el.style.pointerEvents = e.opacidade > 0.6 ? "auto" : "none";
        // painel invisível também sai da ordem do Tab
        el.style.visibility = e.opacidade < 0.01 ? "hidden" : "";
        if (e.opacidade > maior) { maior = e.opacidade; ativo = i; }
        else if (maior < 0.01 && progress >= CUES[i][0]) ativo = i;
      });
      // retículo central só nas zonas mortas (quando nenhum painel está legível)
      if (alvo) alvo.style.opacity = Math.max(0, 1 - maior * 1.6) * (1 - esc);
      if (ativo !== ultimoAtivo) {
        ultimoAtivo = ativo;
        capitulos.forEach(function (b, i) {
          b.classList.toggle("ativo", i === ativo);
          if (i === ativo) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
        });
      }
      var f = faseEm(pe);
      if (f !== ultimaFase && faseNum) {
        ultimaFase = f;
        faseNum.textContent = "0" + (f + 1);
        faseNome.textContent = FASES[f][1];
      }
    }

    // Loop rAF: a animação persegue a rolagem e continua viva parada (radar, cintilação,
    // balanço do escudo). Fora da trilha não desenha nada.
    function frame(agora) {
      if (ready) pe = perseguir(pe, progress);
      paint();
      if (win.pageYOffset < topo + altura) {
        desenhar(g, P, larg, alt, dpr, pe, (agora - t0) / 1000, economia);
        if (ready && !economia && amostras < 90 && ultimoQuadro) {
          somaDt += agora - ultimoQuadro;
          amostras += 1;
          if (amostras === 90 && somaDt / amostras > 22) economia = true;
        }
        ultimoQuadro = agora;
      } else {
        ultimoQuadro = 0;
      }
      win.requestAnimationFrame(frame);
    }

    // Nada pesado para baixar: o carregamento espera as fontes e as primeiras camisas
    // do arsenal, que é o que aparece logo depois da abertura.
    function carregar(aoProgresso) {
      return new Promise(function (resolver) {
        var tarefas = [];
        if (doc.fonts && doc.fonts.ready) tarefas.push(doc.fonts.ready);
        [].slice.call(doc.querySelectorAll("#vitrine-foto, #vitrine-anterior, #vitrine-proxima")).forEach(function (img) {
          var src = img.getAttribute("src");
          if (!src) return;
          tarefas.push(new Promise(function (ok) {
            var im = new win.Image();
            im.onload = im.onerror = ok;
            im.src = src;
          }));
        });
        var feitas = 0;
        if (!tarefas.length) { aoProgresso(1); resolver(); return; }
        tarefas.forEach(function (tarefa) {
          Promise.resolve(tarefa).catch(function () {}).then(function () {
            feitas += 1;
            aoProgresso(feitas / tarefas.length);
            if (feitas === tarefas.length) resolver();
          });
        });
        win.setTimeout(function () { aoProgresso(1); resolver(); }, 6000);
      });
    }

    function liberar() {
      ready = true;
      readScroll();
      pe = progress;
    }

    win.addEventListener("scroll", readScroll, { passive: true });
    // Ao redimensionar ou girar, mede de novo. O evento resize às vezes chega com o
    // layout antigo, por isso a trilha também é observada: o ResizeObserver
    // dispara depois do layout, quando a altura nova já vale.
    function remedir() { medir(); dimensionar(); readScroll(); }
    ["resize", "orientationchange"].forEach(function (ev) { win.addEventListener(ev, remedir); });
    if (win.ResizeObserver) new win.ResizeObserver(remedir).observe(trilha);
    medir();
    dimensionar();
    readScroll();
    paint();
    win.requestAnimationFrame(frame);

    return { carregar: carregar, liberar: liberar };
  }

  return {
    CUES: CUES,
    PARADAS: PARADAS,
    FASES: FASES,
    DRIFT: DRIFT,
    clamp: clamp,
    smooth: smooth,
    ramp: ramp,
    estadoPainel: estadoPainel,
    progressoTrilha: progressoTrilha,
    escurecimento: escurecimento,
    perseguir: perseguir,
    faseEm: faseEm,
    init: init
  };
});
