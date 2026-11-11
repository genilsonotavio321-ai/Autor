import type { SouriauFunctionId } from "@/shared/types/database";

/**
 * Catálogos dramáticos CLASSIFICATÓRIOS (não sequenciais): servem para
 * nomear a situação de um beat, não para montar um esqueleto de atos.
 */
export interface PoltiSituation {
  id: string;
  title: string;
  description: string;
}

export const POLTI_SITUATIONS: PoltiSituation[] = [
  { id: "polti_1", title: "Súplica", description: "Alguém implora por ajuda a um poder que pode salvar ou condenar." },
  { id: "polti_2", title: "Salvamento", description: "Um salvador resgata uma vítima indefesa." },
  { id: "polti_3", title: "Vingança por um crime", description: "O criminoso é perseguido por quem busca vingança." },
  { id: "polti_4", title: "Vingança entre parentes", description: "Parentes se voltam uns contra os outros em busca de vingança." },
  { id: "polti_5", title: "Perseguição", description: "Alguém foge de um perseguidor implacável." },
  { id: "polti_6", title: "Desastre", description: "Uma catástrofe destrói ou ameaça o que importa." },
  { id: "polti_7", title: "Vítima da crueldade", description: "Uma pessoa sofre nas mãos de alguém cruel ou do infortúnio." },
  { id: "polti_8", title: "Revolta", description: "Alguém se rebela contra a autoridade estabelecida." },
  { id: "polti_9", title: "Empreendimento audacioso", description: "Um plano arriscado é executado contra todas as chances." },
  { id: "polti_10", title: "Rapto", description: "Alguém é levado à força e precisa ser resgatado." },
  { id: "polti_11", title: "O enigma", description: "Um mistério precisa ser decifrado para salvar alguém." },
  { id: "polti_12", title: "Obtenção", description: "Algo precioso precisa ser conquistado por meios difíceis." },
  { id: "polti_13", title: "Ódio entre parentes", description: "Um parente odeia e conspira contra outro." },
  { id: "polti_14", title: "Rivalidade entre parentes", description: "Parentes disputam o mesmo bem ou afeto." },
  { id: "polti_15", title: "Adultério homicida", description: "Um adultério leva ao crime." },
  { id: "polti_16", title: "Loucura", description: "A razão se perde e arrasta outros consigo." },
  { id: "polti_17", title: "Imprudência fatal", description: "Um erro impensado desencadeia a tragédia." },
  { id: "polti_18", title: "Crime involuntário por amor", description: "Por amor, alguém comete um crime sem querer." },
  { id: "polti_19", title: "Assassinato de um parente desconhecido", description: "Matar sem saber que a vítima é da própria família." },
  { id: "polti_20", title: "Sacrifício de si por um ideal", description: "Alguém abre mão de tudo por uma causa." },
  { id: "polti_21", title: "Sacrifício de si por um parente", description: "Alguém se sacrifica para salvar a família." },
  { id: "polti_22", title: "Sacrifício de tudo por uma paixão", description: "Tudo é perdido em nome de uma paixão." },
  { id: "polti_23", title: "Sacrificar um ente querido", description: "A necessidade obriga a sacrificar quem se ama." },
  { id: "polti_24", title: "Rivalidade entre superior e inferior", description: "Um embate de poder entre quem manda e quem obedece." },
  { id: "polti_25", title: "Adultério", description: "A traição abala a confiança de um casal." },
  { id: "polti_26", title: "Crimes de amor", description: "O amor leva a atos proibidos e suas consequências." },
  { id: "polti_27", title: "Descoberta da desonra de um ente querido", description: "Uma verdade vergonhosa sobre alguém amado é revelada." },
  { id: "polti_28", title: "Obstáculo ao amor", description: "Barreiras sociais, familiares ou geográficas separam os amantes." },
  { id: "polti_29", title: "Inimigo amado", description: "Alguém se apaixona por quem deveria combater." },
  { id: "polti_30", title: "Ambição", description: "A sede de poder corrompe e move a trama." },
  { id: "polti_31", title: "Conflito com o divino", description: "Alguém luta contra forças superiores ou destino." },
  { id: "polti_32", title: "Ciúme equivocado", description: "Um ciúme infundado destrói relações." },
  { id: "polti_33", title: "Erro judiciário", description: "Uma injustiça do julgamento decide o destino de alguém." },
  { id: "polti_34", title: "Remorso", description: "A culpa consome e leva à reparação." },
  { id: "polti_35", title: "Reencontro", description: "Alguém perdido é reencontrado." },
  { id: "polti_36", title: "Perda de um ente querido", description: "A morte de alguém amado reestrutura a trama." },
];

export function getPoltiSituation(
  id: string | undefined,
): PoltiSituation | undefined {
  if (!id) return undefined;
  return POLTI_SITUATIONS.find((situation) => situation.id === id);
}

export interface SouriauFunction {
  id: SouriauFunctionId;
  name: string;
  /** Símbolo usado por Souriau na combinatória. */
  symbol: string;
  description: string;
}

/**
 * As seis funções dramáticas de Souriau (1950). A "situação dramática" nasce
 * da distribuição de personagens entre elas — não de uma ordem de cenas.
 */
export const SOURIAU_FUNCTIONS: SouriauFunction[] = [
  {
    id: "leo",
    symbol: "Leão",
    name: "Força temática",
    description:
      "A potência que move a situação — o desejo, a causa ou a energia que orienta tudo.",
  },
  {
    id: "soleil",
    symbol: "Sol",
    name: "Valor desejado",
    description: "O bem cobiçado: amor, poder, verdade, liberdade.",
  },
  {
    id: "terre",
    symbol: "Terra",
    name: "Quem deseja",
    description: "O destinatário do valor — quem sofre pela falta ou pelo desejo.",
  },
  {
    id: "mars",
    symbol: "Marte",
    name: "Oponente",
    description: "A força que resiste, atrapalha ou ameaça.",
  },
  {
    id: "balance",
    symbol: "Balança",
    name: "Árbitro",
    description: "Quem julga, distribui ou decide o destino dos valores.",
  },
  {
    id: "lune",
    symbol: "Lua",
    name: "Auxiliar",
    description: "Quem ajuda, media ou fornece os meios da ação.",
  },
];
