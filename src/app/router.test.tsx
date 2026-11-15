import { beforeEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { startSession } from "@/core/session/sessionStore";
import { fakeApi, okResponse, sessionData, sessionUser } from "@/test/fakeApi";
import { renderApp } from "@/test/renderApp";

const signInAs = (role: "porteiro" | "sindico" | "admin") => {
  const user = sessionUser({ role });
  fakeApi({ "GET /auth/me": () => okResponse(user) });
  startSession(sessionData({ user }));
};

describe("rotas do painel", () => {
  beforeEach(() => signInAs("admin"));

  it("abre a tela do endereço informado", async () => {
    renderApp("/exaustores");

    expect(await screen.findByRole("heading", { name: "Exaustores" })).toBeInTheDocument();
  });

  it("mostra página não encontrada para endereço desconhecido", async () => {
    renderApp("/nao-existe");

    expect(await screen.findByText("Página não encontrada")).toBeInTheDocument();
  });

  it("navega pelo menu", async () => {
    const user = userEvent.setup();
    renderApp("/");

    await user.click(screen.getByRole("button", { name: "Abrir ou recolher o menu" }));
    await user.click(await screen.findByRole("link", { name: "Acessos" }));

    expect(await screen.findByRole("heading", { name: "Acessos" })).toBeInTheDocument();
  });

  it("nega ao porteiro uma tela de síndico/admin, mesmo pelo endereço direto", async () => {
    signInAs("porteiro");
    renderApp("/contas");

    expect(await screen.findByText("Acesso negado")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Contas" })).not.toBeInTheDocument();
  });
});
