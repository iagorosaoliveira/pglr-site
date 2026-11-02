/* Catálogo da PGLR Tático: contatos, estampas, cores e caminhos das fotos.
   Única fonte dos contatos (WhatsApp e Instagram). Sem preços, de propósito. */
(function (raiz, fabrica) {
  var api = fabrica();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { raiz.PGLR = raiz.PGLR || {}; raiz.PGLR.catalogo = api; }
})(this, function () {
  "use strict";

  var PASTA = "assets/img/camisas/";

  // assets/img/camisas/{id}-{slug}[-arte{n}]-{frente|costas}.png
  // O sufixo -arte{n} só existe quando a cor tem 2 artes (nas duas).
  function arte(id, slug, n) {
    var meio = id + "-" + slug + (n ? "-arte" + n : "");
    return { frente: PASTA + meio + "-frente.png", costas: PASTA + meio + "-costas.png" };
  }

  var HEX = {
    preto: "#151515",
    branco: "#f2f2f2",
    verde: "#3b4232",
    coyote: "#b39a73",
    "azul-marinho": "#24304a"
  };

  function cor(id, nome, slug, duasArtes) {
    return {
      nome: nome,
      slug: slug,
      hex: HEX[slug],
      artes: duasArtes ? [arte(id, slug, 1), arte(id, slug, 2)] : [arte(id, slug)]
    };
  }

  var estampas = [
    {
      id: 1,
      nome: "Se Vis Pacem",
      descricao: "Se queres paz, prepara-te para a guerra.",
      cores: [cor(1, "Preto", "preto"), cor(1, "Verde", "verde"), cor(1, "Branco", "branco")]
    },
    {
      id: 2,
      nome: "Missão Brasil",
      descricao: "Dever e identidade: soldados sobre a digital.",
      cores: [cor(2, "Azul-marinho", "azul-marinho"), cor(2, "Branco", "branco"), cor(2, "Preto", "preto")]
    },
    {
      id: 4,
      nome: "A Cobra Fumou",
      descricao: "Homenagem aos heróis da FEB na Itália.",
      cores: [cor(4, "Branco", "branco"), cor(4, "Preto", "preto")]
    },
    {
      id: 5,
      nome: "Anti Comunism Club",
      descricao: "Estampa urbana com cena de combate.",
      cores: [cor(5, "Branco", "branco", true), cor(5, "Preto", "preto")]
    },
    {
      id: 6,
      nome: "Pol em Eventos",
      descricao: "Caveira de capacete PM, PGLR Tático SP.",
      cores: [cor(6, "Branco", "branco"), cor(6, "Preto", "preto")]
    },
    {
      id: 7,
      nome: "Veni, Vidi, Vici",
      descricao: "Vim, vi, venci.",
      cores: [cor(7, "Branco", "branco"), cor(7, "Coyote", "coyote"), cor(7, "Preto", "preto")]
    }
  ];

  return {
    whatsapp: "5511963026316",
    instagram: "pglrtatico",
    estampas: estampas
  };
});
