import type { PlotStructure } from "@/shared/types/database";

export interface BeatTemplateEntry {
  title: string;
  description: string;
}

export interface BeatTemplate {
  structure: PlotStructure;
  name: string;
  description: string;
  beats: BeatTemplateEntry[];
}

const threeActs: BeatTemplate = {
  structure: "three_acts",
  name: "Três atos",
  description: "Setup, confronto e resolução — a estrutura clássica.",
  beats: [
    {
      title: "Mundo comum",
      description: "Apresente a rotina do protagonista antes da mudança.",
    },
    {
      title: "Incidente incitante",
      description: "O evento que sacode a rotina e lança a premissa.",
    },
    {
      title: "Debate / recusa",
      description: "Dúvidas e obstáculos antes do comprometimento.",
    },
    {
      title: "Entrada no ato 2",
      description: "O protagonista atravessa para o mundo novo.",
    },
    {
      title: "Subenredo e complicações",
      description: "Aliados, inimigos e o plano que começa a dar errado.",
    },
    {
      title: "Ponto médio",
      description: "Revelação ou reviravolta que muda o objetivo.",
    },
    {
      title: "Tudo piora",
      description: "Consequências do ponto médio; baixa do herói.",
    },
    {
      title: "Pré-clímax",
      description: "O plano final é montado com o que sobrou.",
    },
    {
      title: "Climax",
      description: "Confronto final que resolve o conflito central.",
    },
    {
      title: "Resolução",
      description: "Novo normal — o custo e a lição ficam claros.",
    },
  ],
};

const herosJourney: BeatTemplate = {
  structure: "heros_journey",
  name: "Jornada do herói",
  description: "Monomito de Campbell/Vogler em 12 etapas.",
  beats: [
    {
      title: "Mundo comum",
      description: "A vida ordinária do herói, com suas falhas.",
    },
    {
      title: "Chamado à aventura",
      description: "O problema ou convite que o herói não pode ignorar.",
    },
    {
      title: "Recusa do chamado",
      description: "Medo, insegurança ou dever que segura o herói.",
    },
    {
      title: "Encontro com o mentor",
      description: "Alguém dá instrumento, conhecimento ou coragem.",
    },
    {
      title: "Cruzagem do primeiro limiar",
      description: "O herói entra no mundo especial de verdade.",
    },
    {
      title: "Testes, aliados e inimigos",
      description: "A nova realidade é mapeada por tentativa e erro.",
    },
    {
      title: "Aproximação da caverna",
      description: "Preparação para o maior medo do herói.",
    },
    {
      title: "Ordeal",
      description: "Crise central — morte simbólica e renascimento.",
    },
    {
      title: "Recompensa",
      description: "O tesouro conquistado na ordeal.",
    },
    {
      title: "Caminho de volta",
      description: "O herói retorna com o tesouro; perseguição possível.",
    },
    {
      title: "Ressurreição",
      description: "Teste final que purifica o herói de vez.",
    },
    {
      title: "Retorno com o elixir",
      description: "O herói volta ao mundo comum transformado.",
    },
  ],
};

const saveTheCat: BeatTemplate = {
  structure: "save_the_cat",
  name: "Save the Cat",
  description: "Beat sheet de Blake Snyder com 15 batidas.",
  beats: [
    { title: "Abertura / tema", description: "Tom e tese do filme em uma cena." },
    {
      title: "Exposição catalisadora",
      description: "O protagonista está preso; o mundo é mostrado.",
    },
    {
      title: "Debate / setup",
      description: "A proposta chega; custos e medos são listados.",
    },
    {
      title: "Fio de Buda (break into 2)",
      description: "Decisão de deixar o mundo 1 para o mundo 2.",
    },
    {
      title: "B e C histórias",
      description: "Subplot e personagens de apoio entram em cena.",
    },
    {
      title: "Diversão e jogos",
      description: "A promessa do conceito é entregue ao público.",
    },
    {
      title: "Ponto médio falso",
      description: "Parece que deu certo — até o tapa na cara.",
    },
    {
      title: "Vilão se aproxima",
      description: "Pressão crescente; o plano antigo falha.",
    },
    {
      title: "Não pode haver volta",
      description: "O mundo 1 ficou inacessível.",
    },
    {
      title: "Noite escura da alma",
      description: "O herói atinge o fundo do poço.",
    },
    {
      title: "Fio de Buda final (break into 3)",
      description: "A síntese entre os mundos 1 e 2 é encontrada.",
    },
    {
      title: "Final",
      description: "Plano final em execução, com reversões.",
    },
    {
      title: "Corda bamba",
      description: "Última tensão antes do fim.",
    },
    {
      title: "Climax",
      description: "Resolução do conflito central.",
    },
    {
      title: "Final / tabela",
      description: "Novo normal e respostas do tema.",
    },
  ],
};

const kishotenketsu: BeatTemplate = {
  structure: "kishotenketsu",
  name: "Kishōtenketsu",
  description: "Estrutura oriental sem conflito obrigatório: introdução, desenvolvimento, reviravolta, conclusão.",
  beats: [
    { title: "Ki (introdução)", description: "Apresente personagens e cenário." },
    {
      title: "Shō (desenvolvimento)",
      description: "Aprofunde o contexto; nenhum conflito ainda.",
    },
    {
      title: "Ten (reviravolta)",
      description: "Um elemento inesperado recontextualiza tudo.",
    },
    {
      title: "Ketsu (conclusão)",
      description: "Síntese dos elementos em um todo coeso.",
    },
  ],
};

export const BEAT_TEMPLATES: BeatTemplate[] = [
  threeActs,
  herosJourney,
  saveTheCat,
  kishotenketsu,
];

export function getBeatTemplate(structure: PlotStructure): BeatTemplate | undefined {
  return BEAT_TEMPLATES.find((template) => template.structure === structure);
}
