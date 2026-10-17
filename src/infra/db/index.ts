import { AutorDatabase } from "./schema";

let instance: AutorDatabase | undefined;

/** Lazy singleton — avoids touching IndexedDB at module import (tests, SSR). */
export function getDatabase(): AutorDatabase {
  instance ??= new AutorDatabase();
  return instance;
}
