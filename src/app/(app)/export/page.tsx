import { redirect } from "next/navigation";

// A seção de dados virou a aba "Dados" de Configurações.
export default function ExportRoute() {
  redirect("/settings?tab=dados");
}
