/* Efeitos do interior:
   - a faixa do lema (borda da comporta) corre sozinha e acelera com a rolagem;
   - decodificar(win, el) embaralha o texto de um elemento e o "decodifica", como no HUD
     da intro (usado pelos rótulos da rota). */
(function (raiz, fabrica) {
  var api = fabrica();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { raiz.PGLR = raiz.PGLR || {}; raiz.PGLR.efeitos = api; }
})(this, function () {
  "use strict";

  var SINAIS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/%<>";
  var VELOCIDADE_FAIXA = 0.6;   // px por quadro, parada
  var EMPURRAO_ROLAGEM = 0.35;  // quanto a velocidade da rolagem empurra a faixa

  function decodificar(win, el) {
    var texto = el.textContent;
    var ms = Math.min(900, 300 + texto.length * 18);
    var t0 = win.performance.now();
    (function passo(agora) {
      var f = Math.min(1, ((agora || t0) - t0) / ms);
      var fixos = Math.floor(f * texto.length);
      var s = texto.slice(0, fixos);
      for (var i = fixos; i < texto.length; i++) {
        var c = texto[i];
        s += c === " " || c === "·" ? c : SINAIS[(Math.random() * SINAIS.length) | 0];
      }
      el.textContent = s;
      if (f < 1) win.requestAnimationFrame(passo);
      else el.textContent = texto;
    })();
  }

  function faixa(doc, win, reduzido) {
    var trilho = doc.getElementById("faixa");
    if (!trilho) return;
    // duplica o conteúdo para o laço não ter emenda
    trilho.innerHTML += trilho.innerHTML;
    if (reduzido) return;
    var x = 0, ultimoY = win.pageYOffset, visivel = false, rodando = false, empurrao = 0;
    function quadro() {
      if (!visivel) { rodando = false; return; }
      var y = win.pageYOffset;
      empurrao += ((y - ultimoY) * EMPURRAO_ROLAGEM - empurrao) * 0.12;
      ultimoY = y;
      var metade = trilho.scrollWidth / 2;
      x -= VELOCIDADE_FAIXA + Math.abs(empurrao);
      if (metade > 0) x = x % metade;
      trilho.style.transform = "translate3d(" + x.toFixed(1) + "px,0,0)";
      win.requestAnimationFrame(quadro);
    }
    if (!("IntersectionObserver" in win)) { visivel = true; rodando = true; win.requestAnimationFrame(quadro); return; }
    new win.IntersectionObserver(function (entradas) {
      visivel = entradas[0].isIntersecting;
      if (visivel && !rodando) { rodando = true; ultimoY = win.pageYOffset; win.requestAnimationFrame(quadro); }
    }).observe(trilho.parentNode);
  }

  function init(doc, opcoes) {
    faixa(doc, doc.defaultView, !!(opcoes && opcoes.reduzido));
  }

  return { decodificar: decodificar, init: init };
});
