import { processarRespostaDeAuth } from './lib/authBridge'

// Bootstrap:
// 1) Esta página é uma JANELA AUXILIAR do login (popup de retorno do Entra ou iframe oculto
//    de renovação silenciosa)? Então ela só publica a resposta para a janela principal
//    (redirect bridge do msal v5) e encerra — o portal NÃO monta aqui.
// 2) Caso normal: carrega o app.
processarRespostaDeAuth().then((eraPonte) => {
  if (eraPonte) return
  void import('./bootstrap')
})
