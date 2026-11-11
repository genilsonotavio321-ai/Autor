import type { StructureTemplateId } from "@/shared/types/database";

export interface StructureTemplateBeat {
  title: string;
  description: string;
}

export interface StructureTemplateSection {
  /** Stable key referenced by beats created from this section. */
  key: string;
  title: string;
  description: string;
  beats: StructureTemplateBeat[];
}

export interface StructureTemplate {
  id: StructureTemplateId;
  name: string;
  description: string;
  /** Autor(es) da teoria — aparece no seletor como apoio. */
  author: string;
  sections: StructureTemplateSection[];
}

const threeActs: StructureTemplate = {
  id: "three_acts",
  name: "Três atos",
  description: "Setup, confronto e resolução — a estrutura clássica.",
  author: "Aristóteles · Syd Field",
  sections: [
    {
      key: "ato1",
      title: "Ato I — Setup",
      description: "Apresenta o mundo, o protagonista e a ruptura do equilíbrio.",
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
      ],
    },
    {
      key: "ato2",
      title: "Ato II — Confronto",
      description: "O protagonista tenta, falha e é pressionado até o ponto médio.",
      beats: [
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
      ],
    },
    {
      key: "ato3",
      title: "Ato III — Resolução",
      description: "Confronto final e o novo normal.",
      beats: [
        {
          title: "Pré-clímax",
          description: "O plano final é montado com o que sobrou.",
        },
        {
          title: "Clímax",
          description: "Confronto final que resolve o conflito central.",
        },
        {
          title: "Resolução",
          description: "Novo normal — o custo e a lição ficam claros.",
        },
      ],
    },
  ],
};

const herosJourney: StructureTemplate = {
  id: "heros_journey",
  name: "Jornada do herói",
  description: "Monomito de Campbell/Vogler em 12 etapas.",
  author: "Joseph Campbell · Christopher Vogler",
  sections: [
    {
      key: "partida",
      title: "Partida",
      description: "O herói sai do mundo comum.",
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
      ],
    },
    {
      key: "iniciacao",
      title: "Iniciação",
      description: "Testes e a crise central.",
      beats: [
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
      ],
    },
    {
      key: "retorno",
      title: "Retorno",
      description: "O caminho de volta e a transformação.",
      beats: [
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
    },
  ],
};

const saveTheCat: StructureTemplate = {
  id: "save_the_cat",
  name: "Save the Cat",
  description: "Beat sheet de Blake Snyder com 15 batidas.",
  author: "Blake Snyder",
  sections: [
    {
      key: "ato1",
      title: "Ato 1 — Tese",
      description: "O mundo 1 e a decisão de atravessar.",
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
      ],
    },
    {
      key: "ato2",
      title: "Ato 2 — Diversão e jogos",
      description: "A promessa do conceito, a pressão e o fundo do poço.",
      beats: [
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
      ],
    },
    {
      key: "ato3",
      title: "Ato 3 — Síntese",
      description: "O plano final e o novo normal.",
      beats: [
        {
          title: "Final",
          description: "Plano final em execução, com reversões.",
        },
        {
          title: "Corda bamba",
          description: "Última tensão antes do fim.",
        },
        { title: "Climax", description: "Resolução do conflito central." },
        {
          title: "Final / tabela",
          description: "Novo normal e respostas do tema.",
        },
      ],
    },
  ],
};

const kishotenketsu: StructureTemplate = {
  id: "kishotenketsu",
  name: "Kishōtenketsu",
  description:
    "Estrutura oriental sem conflito obrigatório: introdução, desenvolvimento, reviravolta, conclusão.",
  author: "Tradição chinesa/japonesa",
  sections: [
    {
      key: "ki",
      title: "Ki — Introdução",
      description: "Apresente personagens e cenário.",
      beats: [
        {
          title: "Ki (introdução)",
          description: "Apresente personagens e cenário.",
        },
      ],
    },
    {
      key: "sho",
      title: "Shō — Desenvolvimento",
      description: "Aprofunde o contexto; nenhum conflito ainda.",
      beats: [
        {
          title: "Shō (desenvolvimento)",
          description: "Aprofunde o contexto; nenhum conflito ainda.",
        },
      ],
    },
    {
      key: "ten",
      title: "Ten — Reviravolta",
      description: "Um elemento inesperado recontextualiza tudo.",
      beats: [
        {
          title: "Ten (reviravolta)",
          description: "Um elemento inesperado recontextualiza tudo.",
        },
      ],
    },
    {
      key: "ketsu",
      title: "Ketsu — Conclusão",
      description: "Síntese dos elementos em um todo coeso.",
      beats: [
        {
          title: "Ketsu (conclusão)",
          description: "Síntese dos elementos em um todo coeso.",
        },
      ],
    },
  ],
};

/** Os sete enredos básicos de Christopher Booker, com seus estágios. */
const bookerTemplates: StructureTemplate[] = [
  {
    id: "booker_overcoming_the_monster",
    name: "Booker — Vitória sobre o monstro",
    description:
      "O herói enfrenta uma ameaça que põe em risco a comunidade — e escapa por um triz.",
    author: "Christopher Booker",
    sections: [
      {
        key: "antecipacao",
        title: "Antecipação",
        description: "A ameaça é anunciada; o herói é chamado.",
        beats: [
          {
            title: "A ameaça se revela",
            description: "O monstro ou perigo toma forma e ameaça o lar.",
          },
          {
            title: "O chamado",
            description: "O herói é convocado a enfrentar a ameaça.",
          },
        ],
      },
      {
        key: "sonho",
        title: "Sonho",
        description: "O herói parte confiante e tem sucessos iniciais.",
        beats: [
          {
            title: "Primeiros êxitos",
            description: "A jornada começa bem; a invencibilidade parece possível.",
          },
        ],
      },
      {
        key: "frustracao",
        title: "Frustração",
        description: "O primeiro confronto real e a perda da ilusão.",
        beats: [
          {
            title: "Primeiro confronto",
            description: "O inimigo é mais forte do que parecia.",
          },
        ],
      },
      {
        key: "pesadelo",
        title: "Pesadelo",
        description: "A ameaça parece invencível; a esperança quase acaba.",
        beats: [
          {
            title: "Fundo do poço",
            description: "O herói está cercado; o monstro domina.",
          },
        ],
      },
      {
        key: "resolucao",
        title: "Resolução",
        description: "A fuga triunfante e a conquista milagrosa.",
        beats: [
          {
            title: "Confronto final",
            description: "O herói derrota a ameaça contra todas as chances.",
          },
        ],
      },
    ],
  },
  {
    id: "booker_rags_to_riches",
    name: "Booker — Da miséria à riqueza",
    description:
      "Alguém desfavorecido ganha poder/amor, perde tudo e reconquista — crescido.",
    author: "Christopher Booker",
    sections: [
      {
        key: "miseria",
        title: "Miséria inicial",
        description: "O protagonista vive uma situação de carência.",
        beats: [
          {
            title: "A vida precária",
            description: "Mostre a falta que define o protagonista.",
          },
        ],
      },
      {
        key: "chamado",
        title: "O chamado",
        description: "Uma oportunidade aparece.",
        beats: [
          {
            title: "A oportunidade",
            description: "Algo oferece uma saída da miséria.",
          },
        ],
      },
      {
        key: "sucesso",
        title: "Sucesso inicial",
        description: "O protagonista floresce no novo mundo.",
        beats: [
          {
            title: "Florescimento",
            description: "A nova vida dá certo; o protagonista brilha.",
          },
        ],
      },
      {
        key: "crise",
        title: "Crise central",
        description: "Tudo é perdido — ou parece ser.",
        beats: [
          {
            title: "A perda",
            description: "O que foi conquistado é ameaçado ou tomado.",
          },
        ],
      },
      {
        key: "realizacao",
        title: "Realização",
        description: "A reconquista com amadurecimento.",
        beats: [
          {
            title: "A reconquista",
            description: "O protagonista volta a conquistar — transformado.",
          },
        ],
      },
    ],
  },
  {
    id: "booker_the_quest",
    name: "Booker — A busca",
    description:
      "O protagonista e seus companheiros partem atrás de um objetivo, enfrentando provações.",
    author: "Christopher Booker",
    sections: [
      {
        key: "chamado",
        title: "O chamado",
        description: "Um objetivo precioso é definido.",
        beats: [
          {
            title: "A missão",
            description: "O objeto ou destino da busca é apresentado.",
          },
        ],
      },
      {
        key: "travessia",
        title: "A travessia",
        description: "A jornada, os aliados e os perigos.",
        beats: [
          {
            title: "Partida e provações",
            description: "O grupo avança enfrentando tentações e inimigos.",
          },
        ],
      },
      {
        key: "chegada",
        title: "Chegada e frustração",
        description: "O destino não entrega o que prometia.",
        beats: [
          {
            title: "Portas fechadas",
            description: "O objetivo parece inalcançável; o grupo hesita.",
          },
        ],
      },
      {
        key: "prova",
        title: "Provação final",
        description: "O último teste antes da conquista.",
        beats: [
          {
            title: "O último obstáculo",
            description: "Tudo depende de um confronto decisivo.",
          },
        ],
      },
      {
        key: "objetivo",
        title: "O objetivo",
        description: "A conquista e o que ela custou.",
        beats: [
          {
            title: "A conquista",
            description: "O objetivo é alcançado — com um preço.",
          },
        ],
      },
    ],
  },
  {
    id: "booker_voyage_and_return",
    name: "Booker — Viagem e retorno",
    description:
      "O protagonista vai a um mundo estranho, sobrevive e volta transformado.",
    author: "Christopher Booker",
    sections: [
      {
        key: "antecipacao",
        title: "Antecipação",
        description: "O chamado para deixar o mundo familiar.",
        beats: [
          {
            title: "A travessia",
            description: "O protagonista cruza para o mundo desconhecido.",
          },
        ],
      },
      {
        key: "deslumbramento",
        title: "Deslumbramento",
        description: "O novo mundo encanta e diverte.",
        beats: [
          {
            title: "O encanto",
            description: "O mundo estranho parece maravilhoso.",
          },
        ],
      },
      {
        key: "pesadelo",
        title: "Pesadelo",
        description: "O mundo se volta contra o protagonista.",
        beats: [
          {
            title: "A armadilha",
            description: "O que encantava revela seu lado perigoso.",
          },
        ],
      },
      {
        key: "fuga",
        title: "Fuga",
        description: "Uma saída desesperada.",
        beats: [
          {
            title: "Escapar",
            description: "O protagonista luta para sair vivo.",
          },
        ],
      },
      {
        key: "retorno",
        title: "Retorno",
        description: "De volta ao lar, com a lição aprendida.",
        beats: [
          {
            title: "O lar transformado",
            description: "O retorno revela o que mudou no protagonista.",
          },
        ],
      },
    ],
  },
  {
    id: "booker_comedy",
    name: "Booker — Comédia",
    description:
      "Confusão, máscaras e revelações até a ordem se restabelecer — com autoconhecimento.",
    author: "Christopher Booker",
    sections: [
      {
        key: "antecipacao",
        title: "Antecipação",
        description: "Um mundo escondido ou reprimido é insinuado.",
        beats: [
          {
            title: "A situação inicial",
            description: "A ordem é rígida; algo está prestes a desandar.",
          },
        ],
      },
      {
        key: "sonho",
        title: "Sonho",
        description: "A euforia da liberdade e da confusão.",
        beats: [
          {
            title: "Saída do controle",
            description: "Mal-entendidos e disfarces dominam.",
          },
        ],
      },
      {
        key: "frustracao",
        title: "Frustração",
        description: "A confusão se complica e as máscaras ameaçam cair.",
        beats: [
          {
            title: "Tudo se embaraça",
            description: "As tramas colidem; ninguém entende ninguém.",
          },
        ],
      },
      {
        key: "pesadelo",
        title: "Pesadelo",
        description: "O caos atinge o ponto máximo.",
        beats: [
          {
            title: "O caos",
            description: "Verdades vêm à tona; o mundo ameaça desabar.",
          },
        ],
      },
      {
        key: "resolucao",
        title: "Resolução",
        description: "Reconciliação e nova ordem.",
        beats: [
          {
            title: "O novo equilíbrio",
            description: "As máscaras caem e o mundo se reconcilia.",
          },
        ],
      },
    ],
  },
  {
    id: "booker_tragedy",
    name: "Booker — Tragédia",
    description:
      "O herói é consumido por um desejo/defeito e caminha para a própria destruição.",
    author: "Christopher Booker",
    sections: [
      {
        key: "antecipacao",
        title: "Antecipação",
        description: "O herói sente que falta algo — e quer.",
        beats: [
          {
            title: "O desejo",
            description: "O herói se apaixona por uma ideia, poder ou pessoa.",
          },
        ],
      },
      {
        key: "sonho",
        title: "Sonho",
        description: "Tudo começa a dar certo, rápido demais.",
        beats: [
          {
            title: "A boa sorte",
            description: "O caminho parece aberto — como se não houvesse volta.",
          },
        ],
      },
      {
        key: "frustracao",
        title: "Frustração",
        description: "As primeiras rachaduras aparecem.",
        beats: [
          {
            title: "Os sinais",
            description: "Consequências do desejo começam a cobrar seu preço.",
          },
        ],
      },
      {
        key: "pesadelo",
        title: "Pesadelo",
        description: "O herói está preso no próprio caminho.",
        beats: [
          {
            title: "Sem saída",
            description: "O herói não consegue mais recuar.",
          },
        ],
      },
      {
        key: "destruicao",
        title: "Destruição",
        description: "A queda final — e o que ela ensina.",
        beats: [
          {
            title: "A queda",
            description: "Tudo desmorona; resta o reconhecimento tardio.",
          },
        ],
      },
    ],
  },
  {
    id: "booker_rebirth",
    name: "Booker — Renascimento",
    description:
      "O herói, preso a uma força sombria, é redimido por uma transformação.",
    author: "Christopher Booker",
    sections: [
      {
        key: "antecipacao",
        title: "Antecipação",
        description: "O herói está encarcerado por um poder sombrio.",
        beats: [
          {
            title: "A prisão",
            description: "Mostre como o herói está preso à própria sombra.",
          },
        ],
      },
      {
        key: "sonho",
        title: "Sonho",
        description: "Um vislumbre de libertação.",
        beats: [
          {
            title: "O vislumbre",
            description: "Algo mostra que outra vida é possível.",
          },
        ],
      },
      {
        key: "pesadelo",
        title: "Pesadelo",
        description: "O poder sombrio aperta o cerco.",
        beats: [
          {
            title: "O aperto",
            description: "A escuridão ameaça engolir o herói de vez.",
          },
        ],
      },
      {
        key: "frustracao",
        title: "Frustração",
        description: "A tentativa de escapar falha.",
        beats: [
          {
            title: "A tentativa",
            description: "Uma saída é tentada — e parece fracassar.",
          },
        ],
      },
      {
        key: "renascimento",
        title: "Renascimento",
        description: "A redenção por um ato de amor/verdade.",
        beats: [
          {
            title: "A transformação",
            description: "Um gesto redentor liberta o herói e a comunidade.",
          },
        ],
      },
    ],
  },
];

/** As 31 funções narrativas de Propp, agrupadas em seis esferas. */
const propp: StructureTemplate = {
  id: "propp",
  name: "Funções de Propp",
  description:
    "As 31 funções do conto maravilhoso russo, agrupadas nas esferas da ação.",
  author: "Vladimir Propp",
  sections: [
    {
      key: "preparacao",
      title: "Preparação",
      description: "A situação inicial e a partida (funções 1–7).",
      beats: [
        { title: "1. Afastamento", description: "Alguém da família se ausenta." },
        { title: "2. Interdição", description: "Uma proibição é imposta ao herói." },
        { title: "3. Transgressão", description: "A interdição é violada." },
        { title: "4. Interrogatório", description: "O antagonista obtém informação." },
        { title: "5. Informação", description: "Informações sobre a vítima são reveladas." },
        { title: "6. Trapaça", description: "O antagonista tenta enganar a vítima." },
        { title: "7. Cumplicidade", description: "A vítima cai na trapaça." },
      ],
    },
    {
      key: "complicacao",
      title: "Complicação",
      description: "A danificação e o início da reação (funções 8–11).",
      beats: [
        { title: "8. Danificação", description: "O antagonista causa um dano/falta." },
        { title: "9. Mediação", description: "O herói é chamado a reparar a falta." },
        { title: "10. Início da reação", description: "O herói decide agir." },
        { title: "11. Partida", description: "O herói deixa a casa." },
      ],
    },
    {
      key: "transferencia",
      title: "Transferência",
      description: "A prova do doador e o meio mágico (funções 12–15).",
      beats: [
        { title: "12. Provação", description: "O doador testa o herói." },
        { title: "13. Reação do herói", description: "O herói reage à prova." },
        { title: "14. Recebimento", description: "O herói ganha o meio mágico." },
        { title: "15. Deslocamento", description: "O herói chega ao novo lugar." },
      ],
    },
    {
      key: "luta",
      title: "Luta",
      description: "O confronto e a vitória (funções 16–18).",
      beats: [
        { title: "16. Combate", description: "Herói e antagonista se enfrentam." },
        { title: "17. Marcação", description: "O herói é marcado no combate." },
        { title: "18. Vitória", description: "O antagonista é derrotado." },
      ],
    },
    {
      key: "retorno",
      title: "Retorno",
      description: "A reparação, o retorno e a perseguição (funções 19–22).",
      beats: [
        { title: "19. Reparação", description: "A falta inicial é reparada." },
        { title: "20. Retorno", description: "O herói volta para casa." },
        { title: "21. Perseguição", description: "O herói é perseguido." },
        { title: "22. Salvamento", description: "O herói é salvo da perseguição." },
      ],
    },
    {
      key: "reconhecimento",
      title: "Reconhecimento",
      description: "O retorno incógnito e a recompensa final (funções 23–31).",
      beats: [
        { title: "23. Chegada incógnita", description: "O herói chega disfarçado." },
        { title: "24. Pretensões falsas", description: "Um falso herói reivindica a vitória." },
        { title: "25. Tarefa difícil", description: "Uma prova é imposta ao herói." },
        { title: "26. Solução", description: "O herói cumpre a tarefa." },
        { title: "27. Reconhecimento", description: "O herói é reconhecido." },
        { title: "28. Desmascaramento", description: "O falso herói é exposto." },
        { title: "29. Transfiguração", description: "O herói assume nova aparência." },
        { title: "30. Punição", description: "O antagonista é punido." },
        { title: "31. Casamento", description: "O herói é recompensado e se casa." },
      ],
    },
  ],
};

export const STRUCTURE_TEMPLATES: StructureTemplate[] = [
  threeActs,
  herosJourney,
  saveTheCat,
  kishotenketsu,
  ...bookerTemplates,
  propp,
];

export function getStructureTemplate(
  id: StructureTemplateId,
): StructureTemplate | undefined {
  return STRUCTURE_TEMPLATES.find((template) => template.id === id);
}

/** Beats do template achatados na ordem de criação, com a seção de origem. */
export function flattenTemplateBeats(
  template: StructureTemplate,
): { sectionKey: string; title: string; description: string }[] {
  return template.sections.flatMap((section) =>
    section.beats.map((beat) => ({ sectionKey: section.key, ...beat })),
  );
}

/** Seção de destino de um beat antigo (posição no template achatado). */
export function sectionKeyForBeatIndex(
  template: StructureTemplate,
  index: number,
): string | undefined {
  return flattenTemplateBeats(template)[index]?.sectionKey;
}
