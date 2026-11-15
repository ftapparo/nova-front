import { describe, expect, it } from "vitest";
import { navigation, navigationFor } from "./navigation";

const titlesFor = (role: Parameters<typeof navigationFor>[0]) =>
  navigationFor(role).flatMap((group) => group.items.map((item) => item.title));

describe("navigationFor", () => {
  it("não mostra menu para conta sem papel de equipe", () => {
    expect(navigationFor(null)).toEqual([]);
  });

  it("esconde do porteiro o que é de síndico/admin", () => {
    const titles = titlesFor("porteiro");

    expect(titles).toContain("Portões e Portas");
    expect(titles).toContain("Reset de senha");
    expect(titles).not.toContain("Contas");
    expect(titles).not.toContain("Vínculos");
    expect(titles).not.toContain("Notificações");
  });

  it("mostra tudo para síndico e admin", () => {
    const all = navigation.flatMap((section) => section.items.map((item) => item.title));

    expect(titlesFor("sindico")).toEqual(all);
    expect(titlesFor("admin")).toEqual(all);
  });

  it("não devolve grupo vazio", () => {
    for (const group of navigationFor("porteiro")) {
      expect(group.items.length).toBeGreaterThan(0);
    }
  });

  it("não repete caminho entre itens", () => {
    const paths = navigation.flatMap((section) => section.items.map((item) => item.path));

    expect(new Set(paths).size).toBe(paths.length);
  });
});
