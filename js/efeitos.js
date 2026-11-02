/* Efeitos do interior (fora da cena de rolagem, onde IntersectionObserver é permitido):
   - .revelar / .revelar-grupo aparecem ao entrar na tela;
   - [data-letras] entra letra a letra e [data-palavras] palavra a palavra;
   - [data-decodificar] embaralha e "decodifica" o texto, como no HUD da intro;
   - a faixa do lema corre sozinha e acelera com a velocidade da rolagem. */
(function (raiz, fabrica) {
  var api = fabrica();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { raiz.PGLR = raiz.PGLR || {}; raiz.PGLR.efeitos = api; }
})(this, function () {
  "use strict";

  var SINAIS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/%<>";
  var VELOCIDADE_FAIXA = 0.6;   // px por quadro, parada
  var EMPURRAO_ROLAGEM = 0.35;  // quanto a velocidade da rolagem empurra a faixa

  function dividirLetras(doc, el) {
    var texto = el.textContent;
    el.setAttribute("aria-label", texto);
    el.textContent = "";
    texto.split("").forEach(function (c, i) {
      var s = doc.createElement("span");
      s.className = "letra";
      s.setAttribute("aria-hidden", "true");
      s.style.setProperty("--i", i);
      s.textContent = c;
      el.appendChild(s);
    });
  }

  function dividirPalavras(doc, el) {
    var texto = el.textContent.replace(/\s+/g, " ").trim();
    el.setAttribute("aria-label", texto);
    el.textContent = "";
    texto.split(" ").forEach(function (p, i) {
      if (i) el.appendChild(doc.createTextNode(" "));
      var fora = doc.createElement("span");
      fora.className = "palavra";
      fora.setAttribute("aria-hidden", "true");
      var dentro = doc.createElement("span");
      dentro.className = "palavra-in";
      dentro.style.setProperty("--i", i);
      dentro.textContent = p;
      fora.appendChild(dentro);
      el.appendChild(fora);
    });
  }

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
      if (metade > 0) x = ((x % metade) - metade) % metade;
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
    var win = doc.defaultView;
    var reduzido = !!(opcoes && opcoes.reduzido);

    [].forEach.call(doc.querySelectorAll("[data-letras]"), function (el) { dividirLetras(doc, el); });
    [].forEach.call(doc.querySelectorAll("[data-palavras]"), function (el) { dividirPalavras(doc, el); });
    faixa(doc, win, reduzido);

    if (reduzido || !("IntersectionObserver" in win)) return;
    doc.documentElement.classList.add("com-revelar");

    var alvos = doc.querySelectorAll(".revelar, .revelar-grupo, [data-letras], [data-palavras], [data-decodificar]");
    var obs = new win.IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("visivel");
        if (e.target.hasAttribute("data-decodificar")) decodificar(win, e.target);
        obs.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -12% 0px" });
    [].forEach.call(alvos, function (n) { obs.observe(n); });
  }

  return { init: init };
});
