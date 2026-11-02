/* Liga os módulos da página. */
(function () {
  "use strict";
  var PGLR = window.PGLR;
  var html = document.documentElement;
  var reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  html.classList.toggle("reduzido", reduzido);
  PGLR.contato.ligarContatos(document, PGLR.catalogo);
  PGLR.arsenal.init(document.getElementById("arsenal-grade"), PGLR.catalogo);
  // efeitos do interior: depois do arsenal, que escreve a contagem decodificada
  PGLR.efeitos.init(document, { reduzido: reduzido });

  // A intro cobre o carregamento: só sai quando a animação acabou (ou foi pulada)
  // E o vídeo está pronto (ou o tempo-limite da cena venceu).
  var cena = PGLR.cena.init(document, { reduzido: reduzido });
  var intro = PGLR.intro.init(document, { reduzido: reduzido });
  Promise.all([intro.animacao, cena.carregar(intro.setProgresso)]).then(function () {
    cena.liberar();
    return intro.sair();
  });
})();
