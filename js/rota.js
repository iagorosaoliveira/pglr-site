/* Quem Somos em rota de missão: uma linha vermelha desce pela lateral acompanhando a
   rolagem; cada ponto de passagem (WP) acende quando a ponta da linha chega nele, e o
   DESTINO (o fecho com o WhatsApp) se desenha quando a linha termina. Rolar para cima
   faz a linha voltar; os pontos, uma vez acesos, ficam acesos. */
(function (raiz, fabrica) {
  var api = fabrica();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { raiz.PGLR = raiz.PGLR || {}; raiz.PGLR.rota = api; }
})(this, function () {
  "use strict";

  // A ponta da linha fica a 70% da altura da tela (no meio, sobrava meia tela vazia).
  var REFERENCIA = 0.7;

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  // 0 quando a ponta chega ao topo da rota; 1 quando chega ao fim dela.
  function progressoRota(topo, altura, scrollY, alturaJanela) {
    if (altura <= 0) return 0;
    return clamp((scrollY + alturaJanela * REFERENCIA - topo) / altura, 0, 1);
  }

  // Quantos pontos já foram alcançados (posições em fração da rota, em ordem crescente).
  function pontosAcesos(progresso, posicoes) {
    var n = 0;
    while (n < posicoes.length && progresso >= posicoes[n]) n++;
    return n;
  }

  function init(doc, opcoes) {
    var win = doc.defaultView;
    var reduzido = !!(opcoes && opcoes.reduzido);
    var rota = doc.querySelector(".rota-pontos");
    if (!rota) return;
    var linha = rota.querySelector(".rota-progresso");
    var pontos = [].slice.call(rota.querySelectorAll("[data-ponto]"));
    var destino = doc.getElementById("rota-destino");
    var decodificar = win.PGLR.efeitos && win.PGLR.efeitos.decodificar;

    function acender(p) {
      if (p.classList.contains("aceso")) return;
      p.classList.add("aceso");
      var rotulo = p.querySelector("[data-rotulo]");
      if (rotulo && decodificar && !reduzido) decodificar(win, rotulo);
    }

    // Movimento reduzido: tudo já aceso e a linha cheia, nada se mexe.
    if (reduzido || !win.requestAnimationFrame) {
      pontos.forEach(acender);
      linha.style.transform = "none";
      destino.classList.add("alcancado");
      return;
    }

    rota.parentNode.classList.add("com-movimento");
    var topo = 0, altura = 0, posicoes = [], agendado = false, atual = -1;

    function medir() {
      topo = rota.getBoundingClientRect().top + win.pageYOffset;
      altura = rota.offsetHeight;
      posicoes = pontos.map(function (p) {
        var marca = p.querySelector(".ponto-marca") || p;
        return (marca.getBoundingClientRect().top + win.pageYOffset - topo) / (altura || 1);
      });
    }

    function atualizar() {
      agendado = false;
      var prog = progressoRota(topo, altura, win.pageYOffset, win.innerHeight);
      linha.style.transform = "scaleY(" + prog.toFixed(4) + ")";
      var n = pontosAcesos(prog, posicoes);
      for (var i = 0; i < n; i++) acender(pontos[i]);
      if (n - 1 !== atual) {
        if (atual >= 0) pontos[atual].classList.remove("atual");
        atual = n - 1;
        if (atual >= 0) pontos[atual].classList.add("atual");
      }
      if (prog >= 0.995) destino.classList.add("alcancado");
    }

    function agendar() {
      if (agendado) return;
      agendado = true;
      win.requestAnimationFrame(atualizar);
    }

    function remedir() { medir(); agendar(); }
    win.addEventListener("scroll", agendar, { passive: true });
    win.addEventListener("resize", remedir);
    // fotos e fontes carregando acima mudam a posição da rota sem mudar o tamanho dela
    if (win.ResizeObserver) {
      var ro = new win.ResizeObserver(remedir);
      ro.observe(rota);
      ro.observe(doc.body);
    }
    medir();
    atualizar();
  }

  return { REFERENCIA: REFERENCIA, progressoRota: progressoRota, pontosAcesos: pontosAcesos, init: init };
});
