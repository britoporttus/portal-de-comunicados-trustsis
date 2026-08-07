// IDENTIDADE DO PREVIEW — quem está usando o portal quando ele roda EMBUTIDO num iframe.
//
// Por que isto existe: o preview do Hive renderiza o portal dentro de um iframe, e o Entra
// se recusa a autenticar ali (redirect mata o frame; popup não devolve a resposta pelo
// armazenamento particionado do iframe — foi exatamente o "fica carregando e não entra").
// Em vez de insistir num login interativo impossível, o portal EMBUTIDO abre DIRETO na home
// (como sempre funcionou) e oferece um SELETOR de usuário alimentado pelo diretório REAL do
// Entra (backend, Graph app-only com as credenciais da tela de Administração).
//
// O UPN escolhido é enviado em todo request como `x-portal-upn` (ver lib/api.ts). O backend
// só honra esse cabeçalho com a barreira DESLIGADA; em produção (barreira ligada, aba
// própria) quem identifica continua sendo o token do Entra, e nada disto tem efeito.
import { emIframe } from "./auth";

const CHAVE = "ts-identidade";

/** O portal está no modo "identificação por seleção"? (embutido = preview do Hive) */
export function modoPreview(): boolean {
  return emIframe();
}

/** UPN escolhido pelo usuário do preview (null = usa o usuário padrão do backend). */
export function identidadeEscolhida(): string | null {
  if (!modoPreview()) return null;
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

/** Fixa (ou limpa) o usuário do preview. Quem chama recarrega a página em seguida, para
 *  o portal inteiro subir já com a identidade nova (perfil, RBAC, agenda, pontos…). */
export function escolherIdentidade(upn: string | null): void {
  try {
    if (upn) localStorage.setItem(CHAVE, upn);
    else localStorage.removeItem(CHAVE);
  } catch {
    /* storage indisponível — ignora */
  }
}
