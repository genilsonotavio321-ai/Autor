import { redirect } from "next/navigation";

// A seção virou a rota /canvas; o item "Criatividade" saiu do menu.
export default function ExportRoute() {
  redirect("/canvas");
}
