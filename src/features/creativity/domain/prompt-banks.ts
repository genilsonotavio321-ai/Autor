import type {
  Character,
  CharacterGender,
  Location,
} from "@/shared/types/database";

/**
 * Bancos de prompts curados (pt-BR) para destravar a escrita —
 * funções puras e determinísticas, sem IA (app 100% offline).
 */

export type PromptCategory = "enredo" | "personagem" | "mundo" | "conflito";

export const PROMPT_CATEGORY_LABELS: Record<PromptCategory, string> = {
  enredo: "Enredo",
  personagem: "Personagem",
  mundo: "Mundo",
  conflito: "Conflito",
};

export const PROMPT_CATEGORIES = Object.keys(
  PROMPT_CATEGORY_LABELS,
) as PromptCategory[];

/** Perguntas provocativas por categoria. */
export const PROMPT_BANKS: Record<PromptCategory, string[]> = {
  enredo: [
    "Qual é a pior coisa que pode acontecer ao seu protagonista agora? Por que você ainda não fez isso acontecer?",
    "O que o protagonista quer e o que ele precisa são a mesma coisa? E se fossem opostos?",
    "Se você remover o último capítulo que escreveu, o que muda na história? Se nada muda, ele é necessário?",
    "Qual promessa feita no início da história ainda não foi cumprida?",
    "Qual cena você está evitando escrever? Escreva essa primeiro.",
    "O que aconteceria se o protagonista falhasse nesta etapa? A história ficaria melhor?",
  ],
  personagem: [
    "Qual segredo seu protagonista nunca contaria? Quem descobre esse segredo?",
    "Qual trauma o protagonista carrega sem perceber — e quem foi o primeiro a enxergar?",
    "Qual personagem tem razão quando discorda do protagonista?",
    "O que a antagonista acha que está certo? Como a história provaria isso?",
    "Qual memória o protagonista revisitaria se estivesse prestes a morrer?",
    "Quem o protagonista está tentando impressionar — e essa pessoa merece isso?",
  ],
  mundo: [
    "Qual regra do seu mundo já foi quebrada em segredo por alguém?",
    "O que neste mundo é considerado normal e seria escandaloso no nosso?",
    "Qual luxo existe aqui que não existe em nenhum outro lugar?",
    "Quem tem poder neste mundo e ainda não apareceu em nenhuma cena?",
    "Qual história as crianças deste mundo ouvem antes de dormir?",
    "Que preço este mundo cobra de quem tenta mudá-lo?",
  ],
  conflito: [
    "Quem perde se o protagonista vencer?",
    "Qual pergunta o protagonista evita fazer em voz alta?",
    "Qual escolha colocaria o protagonista contra tudo aquilo que ele ama?",
    "Qual é a menor briga que pode se transformar na maior catástrofe desta história?",
    "Quem deveria estar do lado do protagonista e não está?",
    "O que dois personagens querem que não pode ser dividido?",
  ],
};

/**
 * Perguntas com `{personagem}` — o placeholder é trocado pelo nome de uma
 * ficha sorteada do projeto; sem fichas, este banco fica fora do sorteio.
 */
export const CHARACTER_PROMPT_BANKS: Record<PromptCategory, string[]> = {
  enredo: [
    "Qual é a pior coisa que pode acontecer a {personagem} agora — e quem se beneficia com isso?",
    "O que {personagem} quer e o que precisa são a mesma coisa? E se fossem opostos?",
  ],
  personagem: [
    "Qual segredo {personagem} nunca contaria? Quem descobre esse segredo?",
    "Qual memória {personagem} revisitaria se estivesse prestes a morrer?",
    "O que {personagem} defende como justo — e onde a história provaria o contrário?",
  ],
  mundo: [
    "O que {personagem} considera normal neste mundo que seria escandaloso no nosso?",
    "Que preço este mundo já cobrou de {personagem} por tentar mudá-lo?",
  ],
  conflito: [
    "Qual escolha colocaria {personagem} contra tudo aquilo que ama?",
    "Quem deveria estar do lado de {personagem} e não está?",
    "O que {personagem} e a pessoa que mais ama querem que não pode ser dividido?",
  ],
};

/**
 * Perguntas com `{local}` — o placeholder é trocado pelo nome de um local
 * sorteado do projeto; sem locais, este banco fica fora do sorteio.
 */
export const LOCATION_PROMPT_BANKS: Record<PromptCategory, string[]> = {
  enredo: [
    "Qual segredo está enterrado em {local} — e quem morreu para mantê-lo?",
    "O que muda na história se {local} queimar amanhã?",
  ],
  personagem: [
    "Quem frequenta {local} de madrugada — e por quê?",
    "Que trauma nasceu em {local} e ainda machuca quem volta?",
  ],
  mundo: [
    "O que é proibido dentro de {local} — e quem é a exceção?",
    "Qual lenda os moradores contam sobre {local}?",
  ],
  conflito: [
    "Por que dois lados não podem dividir {local}?",
    "Qual verdade sobre {local} causaria uma guerra se fosse revelada?",
  ],
};

/** Eixos do gerador "E se...": sujeito × obstáculo × cenário. O sufixo `@`
 * marca concordância de gênero (obrigad@ → obrigado/obrigada). */
export const WHAT_IF_SUBJECTS = [
  "o protagonista",
  "a antagonista",
  "o personagem que você menos suspeita",
  "o mentor do herói",
  "a pessoa que o protagonista ama",
] as const;

export const WHAT_IF_OBSTACLES = [
  "descobrisse que a pessoa em quem mais confia mente desde o início",
  "perdesse tudo o que construiu até aqui",
  "tivesse que escolher entre a verdade e a pessoa que ama",
  "encontrasse uma carta que muda tudo",
  "fosse obrigad@ a voltar ao lugar que jurou nunca mais pisar",
  "recebesse a proposta que sempre quis — do inimigo errado",
] as const;

export const WHAT_IF_SETTINGS = [
  "na véspera da batalha final",
  "no dia em que finalmente conquistou seu objetivo",
  "diante de todos os aliados",
  "no silêncio da madrugada",
  "diante do inimigo que já derrotou",
] as const;

/**
 * Sorteio determinístico: `seed` escolhe o índice; se cair no mesmo item
 * sorteado antes (`last`) e o banco tiver mais de um item, avança um.
 */
export function drawFrom<T>(items: readonly T[], seed: number, last?: T): T {
  if (items.length === 0) throw new Error("Banco de prompts vazio");
  const index = ((seed % items.length) + items.length) % items.length;
  const item = items[index]!;
  if (items.length > 1 && last !== undefined && item === last) {
    return items[(index + 1) % items.length]!;
  }
  return item;
}

/**
 * Concordância de gênero nos templates: `@` vira "o"/"a" conforme o gênero
 * da ficha sorteada. Personagens sem gênero m/f ("outro" ou indefinido)
 * nunca recebem templates com `@` — eles são filtrados antes do sorteio.
 */
function agree(text: string, gender?: CharacterGender): string {
  if (!text.includes("@")) return text;
  return text.replaceAll("@", gender === "feminino" ? "a" : "o");
}

/** Sorteia uma pergunta provocativa da categoria; com fichas de personagem
 * ou locais no projeto, o banco ganha perguntas sobre um deles. `weight` é
 * a chance de sair variante customizada (0 = nunca, 1 = sempre); sem
 * variantes elegíveis o banco embutido responde sozinho. */
export function drawPrompt(
  category: PromptCategory,
  seed: number,
  last?: string,
  characters?: Character[],
  locations?: Location[],
  custom?: string[],
  weight = 0.5,
): string {
  const customPool = (custom ?? []).filter(
    (item) =>
      ((characters?.length ?? 0) > 0 || !item.includes("{personagem}")) &&
      ((locations?.length ?? 0) > 0 || !item.includes("{local}")),
  );
  const builtinPool = [
    ...PROMPT_BANKS[category],
    ...(characters?.length ? CHARACTER_PROMPT_BANKS[category] : []),
    ...(locations?.length ? LOCATION_PROMPT_BANKS[category] : []),
  ];
  // Roll determinístico do seed decide entre pool custom e embutido.
  const roll = (((seed % 100) + 100) % 100) / 100;
  const pool =
    customPool.length > 0 && roll < weight ? customPool : builtinPool;
  const question = drawFrom(pool, seed);
  const character =
    characters && characters.length > 0
      ? drawFrom(characters, seed + 3)
      : undefined;
  const location =
    locations && locations.length > 0
      ? drawFrom(locations, seed + 11)
      : undefined;
  let text = question;
  if (character) text = text.replaceAll("{personagem}", character.name);
  if (location) text = text.replaceAll("{local}", location.name);
  text = agree(text, character?.gender);
  return text === last
    ? drawPrompt(
        category,
        seed + 7,
        undefined,
        characters,
        locations,
        customPool,
        weight,
      )
    : text;
}

/** Sorteia uma combinação "E se..." dos três eixos; com fichas, uma delas
 * entra como sujeito e os templates concordam com seu gênero. `weight` é a
 * chance de sair variante customizada: frase que já começa com "E se" é
 * usada inteira (placeholders + @ aplicados); obstáculo custom compõe a
 * frase com sujeito e cenário. Sem variantes elegíveis, só banco embutido. */
export function drawWhatIf(
  seed: number,
  last?: string,
  characters?: Character[],
  custom?: string[],
  locations?: Location[],
  weight = 0.5,
): string {
  const character =
    characters && characters.length > 0
      ? drawFrom(characters, seed)
      : undefined;
  const agrees =
    character?.gender === "masculino" || character?.gender === "feminino";
  // Ficha sem gênero m/f nunca recebe templates com `@`.
  const dropGendered = character !== undefined && !agrees;
  // Variante que depende de um placeholder vazio fica fora do sorteio.
  const customPool = (custom ?? []).filter(
    (item) =>
      ((characters?.length ?? 0) > 0 || !item.includes("{personagem}")) &&
      ((locations?.length ?? 0) > 0 || !item.includes("{local}")),
  );
  const eligibleCustoms = dropGendered
    ? customPool.filter((item) => !item.includes("@"))
    : customPool;
  const fullSentences = eligibleCustoms.filter((item) =>
    /^e se/i.test(item),
  );
  const customObstacles = eligibleCustoms.filter(
    (item) => !/^e se/i.test(item),
  );
  // Roll determinístico do seed decide entre pool custom e embutido.
  const roll = (((seed % 100) + 100) % 100) / 100;
  const useCustom = eligibleCustoms.length > 0 && roll < weight;

  /** Placeholders + concordância de gênero na variante sorteada. */
  const fill = (text: string): string => {
    let filled = text;
    if (characters && characters.length > 0) {
      filled = filled.replaceAll(
        "{personagem}",
        drawFrom(characters, seed + 5).name,
      );
    }
    if (locations && locations.length > 0) {
      filled = filled.replaceAll(
        "{local}",
        drawFrom(locations, seed + 13).name,
      );
    }
    return agree(filled, character?.gender);
  };

  const subject = character
    ? character.name
    : drawFrom(WHAT_IF_SUBJECTS, seed);
  let text: string;
  if (useCustom && fullSentences.length > 0) {
    text = fill(drawFrom(fullSentences, seed + 1));
  } else {
    const obstacles =
      useCustom || dropGendered
        ? (useCustom ? customObstacles : WHAT_IF_OBSTACLES).filter((item) =>
            dropGendered ? !item.includes("@") : true,
          )
        : WHAT_IF_OBSTACLES;
    const setting = drawFrom(WHAT_IF_SETTINGS, seed + 2);
    text = `E se ${subject} ${fill(drawFrom(obstacles, seed + 1))}, ${setting}?`;
  }
  return text === last
    ? drawWhatIf(seed + 7, undefined, characters, custom, locations, weight)
    : text;
}
