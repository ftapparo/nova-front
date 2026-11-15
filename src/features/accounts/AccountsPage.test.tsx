import { beforeAll, describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { startSession } from "@/core/session/sessionStore";
import { errorResponse, fakeApi, okResponse, sessionData, sessionUser, type FakeRequest } from "@/test/fakeApi";
import { renderApp } from "@/test/renderApp";
import { canManageAccount, grantableRoles } from "./accountRules";

const ME = "9152eea2-c5e7-4fec-a296-85f20c68f51f";
const accounts = [
  { id: ME, email: "admin@novaresidence.com.br", role: "admin", mustChangePassword: false, createdAt: "2026-09-28T12:00:00.000Z" },
  { id: "id-porteiro", email: "portaria@novaresidence.com.br", role: "porteiro", mustChangePassword: true, createdAt: "2026-10-01T12:00:00.000Z" },
  { id: "id-morador", email: "morador@gmail.com", role: null, mustChangePassword: false, createdAt: "2026-10-02T12:00:00.000Z" },
];

const openAs = (role: "sindico" | "admin", routes: Record<string, (request: FakeRequest) => Response> = {}) => {
  const user = sessionUser({ id: ME, role, email: "admin@novaresidence.com.br" });
  const requests = fakeApi({
    "GET /auth/me": () => okResponse(user),
    "GET /auth/users": () => okResponse(accounts),
    ...routes,
  });
  startSession(sessionData({ user }));
  renderApp("/contas");
  return requests;
};

const openActions = async (user: ReturnType<typeof userEvent.setup>, email: string, action: string) => {
  await user.click(await screen.findByRole("button", { name: `Ações da conta ${email}` }));
  await user.click(await screen.findByRole("menuitem", { name: action }));
};

describe("regras de gestão de contas", () => {
  const admin = { id: "a", role: "admin" };
  const sindico = { id: "s", role: "sindico" };

  it("ninguém gerencia a própria conta", () => {
    expect(canManageAccount(admin, { id: "a", role: "admin" })).toBe(false);
  });

  it("admin gerencia qualquer outra conta", () => {
    expect(canManageAccount(admin, { id: "b", role: "admin" })).toBe(true);
    expect(canManageAccount(admin, { id: "c", role: null })).toBe(true);
  });

  it("síndico só gerencia quem está abaixo dele", () => {
    expect(canManageAccount(sindico, { id: "p", role: "porteiro" })).toBe(true);
    expect(canManageAccount(sindico, { id: "m", role: "morador" })).toBe(true);
    expect(canManageAccount(sindico, { id: "s2", role: "sindico" })).toBe(false);
    expect(canManageAccount(sindico, { id: "a", role: "admin" })).toBe(false);
  });

  it("só admin concede admin", () => {
    expect(grantableRoles("admin")).toContain("admin");
    expect(grantableRoles("sindico")).not.toContain("admin");
  });
});

describe("tela de contas", () => {
  // A rota carrega a tela com lazy(); importar antes tira o tempo do primeiro
  // carregamento de dentro do prazo do primeiro teste.
  beforeAll(async () => {
    await import("./AccountsPage");
  });

  it("lista as contas e não oferece ações sobre a própria", async () => {
    openAs("admin");

    expect(await screen.findByText("portaria@novaresidence.com.br")).toBeInTheDocument();
    expect(screen.getByText("Senha provisória")).toBeInTheDocument();
    expect(screen.getByText("Sem papel")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ações da conta admin@novaresidence.com.br" })).not.toBeInTheDocument();
  });

  it("cria uma conta de equipe", async () => {
    const user = userEvent.setup();
    const requests = openAs("admin", {
      "POST /auth/users": () => okResponse({ id: "novo", email: "zelador@novaresidence.com.br", role: "porteiro", mustChangePassword: false }, 201),
    });

    await user.click(await screen.findByRole("button", { name: "Nova conta" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("E-mail"), "zelador@novaresidence.com.br");
    await user.type(within(dialog).getByLabelText("Senha inicial"), "senha-inicial-1");
    await user.click(within(dialog).getByRole("button", { name: "Criar conta" }));

    expect(await screen.findByText("Conta zelador@novaresidence.com.br criada.")).toBeInTheDocument();
    expect(requests.find((request) => request.method === "POST" && request.path === "/auth/users")?.body).toEqual({
      email: "zelador@novaresidence.com.br",
      password: "senha-inicial-1",
      role: "porteiro",
    });
  });

  it("mostra a recusa quando o e-mail já tem conta", async () => {
    const user = userEvent.setup();
    openAs("admin", {
      "POST /auth/users": () => errorResponse("conflict", 409, "Já existe uma conta com este e-mail."),
    });

    await user.click(await screen.findByRole("button", { name: "Nova conta" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("E-mail"), "portaria@novaresidence.com.br");
    await user.type(within(dialog).getByLabelText("Senha inicial"), "senha-inicial-1");
    await user.click(within(dialog).getByRole("button", { name: "Criar conta" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Já existe uma conta com este e-mail.");
  });

  it("reseta a senha só depois de confirmar e mostra a provisória", async () => {
    const user = userEvent.setup();
    const requests = openAs("admin", {
      "POST /auth/password/staff-reset": () =>
        okResponse({ accountId: "id-porteiro", email: "portaria@novaresidence.com.br", temporaryPassword: "Xk7mPq2RtZ" }),
    });

    await openActions(user, "portaria@novaresidence.com.br", "Resetar senha");
    expect(requests.some((request) => request.path === "/auth/password/staff-reset")).toBe(false);

    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Resetar senha" }));

    expect(await screen.findByTestId("temporary-password")).toHaveTextContent("Xk7mPq2RtZ");
    expect(requests.find((request) => request.path === "/auth/password/staff-reset")?.body).toEqual({ accountId: "id-porteiro" });
    expect(window.localStorage.getItem("nova-residence-v3-session")).not.toContain("Xk7mPq2RtZ");
  });

  it("troca o perfil de uma conta", async () => {
    const user = userEvent.setup();
    const requests = openAs("admin", {
      "PATCH /auth/users/id-porteiro": () =>
        okResponse({ id: "id-porteiro", email: "portaria@novaresidence.com.br", role: "sindico", mustChangePassword: true }),
    });

    await openActions(user, "portaria@novaresidence.com.br", "Trocar perfil");
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Síndico" }));
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Perfil alterado.")).toBeInTheDocument();
    expect(requests.find((request) => request.method === "PATCH")?.body).toEqual({ role: "sindico" });
  });

  it("não oferece o perfil de administrador ao síndico", async () => {
    const user = userEvent.setup();
    openAs("sindico");

    await openActions(user, "portaria@novaresidence.com.br", "Trocar perfil");
    await user.click(within(await screen.findByRole("dialog")).getByRole("combobox"));

    expect(await screen.findByRole("option", { name: "Síndico" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Administrador" })).not.toBeInTheDocument();
  });

  it("exclui uma conta só depois de confirmar", async () => {
    const user = userEvent.setup();
    const requests = openAs("admin", { "DELETE /auth/users/id-morador": () => okResponse(null) });

    await openActions(user, "morador@gmail.com", "Excluir conta");
    expect(requests.some((request) => request.method === "DELETE")).toBe(false);

    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Excluir conta" }));

    expect(await screen.findByText("Conta morador@gmail.com excluída.")).toBeInTheDocument();
    expect(requests.find((request) => request.method === "DELETE")?.body).toEqual({ confirm: true });
  });
});
