import type {
  Character,
  CharacterGender,
  CharacterRole,
  Relationship,
  RelationshipType,
} from "@/shared/types/database";

import { RELATIONSHIP_TYPE_LABELS } from "./repository";

/**
 * Ficha aleatória (item 9): monta uma personagem completa com nome, gênero,
 * papel, objetivos, medos, traços e relações com fichas existentes.
 * `random` injetável mantém o teste determinístico.
 */

export const MALE_NAMES = [
  "Aurêlio", "Bento", "Cássio", "Davi", "Eliseu",
  "Fausto", "Gaspar", "Heitor", "Ícaro", "João",
  "Kenji", "Lucas", "Mateus", "Noé", "Otávio",
  "Pedro", "Quirino", "Rafael", "Sérgio", "Tiago",
  "Úrsio", "Valdo", "Wando", "Xisto", "Yago",
  "Zeno", "Afonso", "Bruno", "Caetano", "Damião",
];

export const FEMALE_NAMES = [
  "Alma", "Bruma", "Clara", "Diana", "Esmeralda",
  "Fernanda", "Graça", "Helena", "Íris", "Joana",
  "Kátia", "Lúcia", "Marina", "Nélida", "Olívia",
  "Paula", "Quitéria", "Rosália", "Sílvia", "Tereza",
  "Úrsula", "Vitória", "Wanda", "Xênia", "Yara",
  "Zuleica", "Alice", "Bianca", "Camila", "Dulce",
];

const DESCRIPTIONS = [
  "Carrega um segredo que nunca contou a ninguém.",
  "Fala pouco, mas observa tudo ao redor.",
  "Sorri fácil, embora os olhos nem sempre acompanhem.",
  "Tem as mãos calejadas de um ofício que abandonou.",
  "Veste roupas simples demais para o gosto que aparenta.",
  "Um vício antigo deixou marcas visíveis.",
  "Chama atenção em qualquer sala, mesmo calado(a).",
  "Guarda uma carta amassada no bolso, relida dezenas de vezes.",
  "Parece sempre estar de partida, mesmo parado(a).",
  "Mente com tanta naturalidade que já acredita nas próprias histórias.",
];

const BACKSTORIES = [
  "Cresceu numa vila costeira que o mar levou embora num só inverno.",
  "Foi criado(a) por uma ordem religiosa que depois negou conhecer.",
  "Herrou uma fortuna em uma única noite de jogo — e nunca explicou como.",
  "Aprendeu a ler escondido(a), às escondidas roubando livros.",
  "Sobrou de uma guerra que não escolheu e não ganhou ninguém.",
  "Trabalhou para uma família poderosa até o dia em que desapareceu.",
  "Cumpriu uma pena por um crime que jura não ter cometido.",
  "Foi o(a) único(a) sobrevivente de um incêndio que ninguém investigou.",
  "Nasceu numa carroça de artistas e nunca conheceu um teto fixo.",
  "Foi prometido(a) a uma vida que fugiu na véspera.",
];

const GOALS = [
  "Recuperar o que lhe foi tirado, custe o que custar.",
  "Provar para a família que escolheu o caminho certo.",
  "Encontrar a pessoa que desapareceu sem deixar rasto.",
  "Comprar a liberdade de alguém que não pode pagar.",
  "Ser lembrado(a) por algo maior que o próprio nome.",
  "Destruir quem destruiu tudo o que amava.",
  "Chegar viva ou morto à cidade proibida.",
  "Limpar o nome que sujaram por ele(a).",
  "Impedir que a profecia se cumpra.",
  "Guardar o objeto a salvo até encontrar quem o mereça.",
  "Voltar para casa antes que a porta feche de vez.",
  "Subir na ordem até ninguém mais poder mandar nele(a).",
];

const FEARS = [
  "Repetir o erro que manchou sua juventude.",
  "Descobrir que a causa pela qual lutou era mentira.",
  "Perder a única pessoa que ainda lhe resta.",
  "Voltar a ficar em silêncio, sem ninguém para ouvir.",
  "Ver o próprio reflexo mudar para o do pai ou da mãe.",
  "Ser esquecido(a) em vida.",
  "Depender de alguém para sobreviver.",
  "Que descubram o que esconde debaixo do colchão.",
  "O escuro dos lugares onde a tocha não alcança.",
  "Ficar preso(a) num lugar pequeno, sem horizonte.",
  "Falhar publicamente, mais uma vez.",
  "Que o perdão oferecido seja recusado.",
];

const TRAITS = [
  "leal", "impulsivo", "observador", "orgulhoso", "generoso",
  "vingativo", "paciente", "ingênuo", "sarcástico", "corajoso",
  "cético", "romântico", "pragmático", "teimoso", "carismático",
  "reservado", "justo", "oportunista", "curioso", "disciplinado",
  "imprevisível", "gentil", "ambicioso", "cauteloso", "tagarela",
];

const RELATION_NOTES = [
  "deve um favor que nunca cobrou",
  "sabe algo que poderia destruir o outro",
  "cresceram juntos antes das ruas os separarem",
  "salvou a vida do outro uma vez e nunca deixou barato",
  "não confia, mas precisa dele(a)",
  "finge amizade por conveniência",
  "guarda um ressentimento antigo e silencioso",
  "é o único(a) que conhece a verdade sobre o passado do outro",
  "protege por um juramento feito a um terceiro",
  "apaixonado(a) e nunca admitiu",
];

const RELATIONSHIP_TYPES = Object.keys(
  RELATIONSHIP_TYPE_LABELS,
) as RelationshipType[];

/** Sorteia um item da lista (random injetável p/ teste). */
function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] as T;
}

/** Sorteia `count` itens distintos de uma lista. */
function pickDistinct<T>(
  items: readonly T[],
  count: number,
  random: () => number,
): T[] {
  const pool = [...items];
  const picked: T[] = [];
  while (picked.length < count && pool.length > 0) {
    const index = Math.floor(random() * pool.length);
    picked.push(pool[index] as T);
    pool.splice(index, 1);
  }
  return picked;
}

function pickGender(random: () => number): CharacterGender {
  const roll = random();
  if (roll < 0.45) return "masculino";
  if (roll < 0.9) return "feminino";
  return "outro";
}

function pickRole(random: () => number): CharacterRole {
  const roll = random();
  if (roll < 0.2) return "protagonist";
  if (roll < 0.35) return "antagonist";
  if (roll < 0.85) return "supporting";
  return "minor";
}

function uniqueName(gender: CharacterGender, random: () => number, existing: Character[]): string {
  const pool =
    gender === "masculino"
      ? MALE_NAMES
      : gender === "feminino"
        ? FEMALE_NAMES
        : [...MALE_NAMES, ...FEMALE_NAMES];
  const used = new Set(existing.map((character) => character.name));
  let name = pick(pool, random);
  let attempts = 0;
  while (used.has(name) && attempts < 50) {
    name = pick(pool, random);
    attempts++;
  }
  return used.has(name) ? `${name} II` : name;
}

/** Ficha pronta sem `projectId` — a página completa ao criar. */
export function buildRandomCharacter(
  existing: Character[],
  random: () => number = Math.random,
): {
  name: string;
  role: CharacterRole;
  gender: CharacterGender;
  description: string;
  backstory: string;
  goals: string;
  fears: string;
  traits: string[];
  relationships: Relationship[];
} {
  const gender = pickGender(random);
  const role = pickRole(random);
  const relationshipCount = existing.length > 0 ? (random() < 0.5 ? 1 : 2) : 0;
  const targets = pickDistinct(existing, Math.min(relationshipCount, existing.length), random);

  return {
    name: uniqueName(gender, random, existing),
    role,
    gender,
    description: pick(DESCRIPTIONS, random),
    backstory: pick(BACKSTORIES, random),
    goals: pick(GOALS, random),
    fears: pick(FEARS, random),
    traits: pickDistinct(TRAITS, random() < 0.5 ? 2 : 3, random),
    relationships: targets.map((target) => ({
      targetId: target.id,
      type: pick(RELATIONSHIP_TYPES, random),
      note: pick(RELATION_NOTES, random),
    })),
  };
}
