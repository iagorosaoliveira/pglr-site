/* Links de contato: WhatsApp com mensagem pronta e Instagram.
   Os números e o @ vêm do catálogo; aqui só se monta o link. */
(function (raiz, fabrica) {
  var api = fabrica();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { raiz.PGLR = raiz.PGLR || {}; raiz.PGLR.contato = api; }
})(this, function () {
  "use strict";

  var MENSAGEM_GERAL = "Fala, Guilherme! Vim pelo site da PGLR Tático.";

  function linkWhatsApp(numero, texto) {
    return "https://wa.me/" + numero + "?text=" + encodeURIComponent(texto);
  }

  function linkInstagram(usuario) {
    return "https://instagram.com/" + usuario;
  }

  // Todo [data-whatsapp] vira link do WhatsApp (o valor do atributo é a mensagem;
  // vazio = mensagem geral) e todo [data-instagram] vira link do perfil.
  function ligarContatos(doc, catalogo) {
    function externo(a, href) {
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener";
    }
    [].forEach.call(doc.querySelectorAll("[data-whatsapp]"), function (a) {
      externo(a, linkWhatsApp(catalogo.whatsapp, a.getAttribute("data-whatsapp") || MENSAGEM_GERAL));
    });
    [].forEach.call(doc.querySelectorAll("[data-instagram]"), function (a) {
      externo(a, linkInstagram(catalogo.instagram));
    });
  }

  return {
    MENSAGEM_GERAL: MENSAGEM_GERAL,
    linkWhatsApp: linkWhatsApp,
    linkInstagram: linkInstagram,
    ligarContatos: ligarContatos
  };
});
