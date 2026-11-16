import { beforeAll, describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { startSession } from "@/core/session/sessionStore";
import { errorResponse, fakeApi, okResponse, sessionData, sessionUser, type FakeRequest } from "@/test/fakeApi";
import { installFakeWebSocket } from "@/test/fakeWebSocket";
import { renderApp } from "@/test/renderApp";

type Routes = Parameters<typeof fakeApi>[0];

const cpfResult = {
  cpf: "12345678900",
  isValid: true,
  exists: true,
  person: { sequencia: 91, nome: "FULANO DE TAL", cpf: "12345678900" },
  links: [{ pessoaVinculo: { sequencia: 1, seqUnidade: 97, prop: "S", loc: "N", mor: "S" }, unidade: { sequencia: 97, quadra: "A", lote: "124" } }],
};

const openPage = (role: "porteiro" | "sindico", routes: Routes = {}): FakeRequest[] => {
  installFakeWebSocket();
  const user = sessionUser({ role });
  const requests = fakeApi({
    "GET /auth/me": () => okResponse(user),
    "POST /ws/ticket": () => errorResponse("upstream-error", 503, null),
    "GET /queries/cpf/12345678900": () => okResponse(cpfResult),
    ...routes,
  });
  startSession(sessionData({ user }));
  renderApp("/reset-senha");
  return requests;
};

const findPerson = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(await screen.findByLabelText("CPF do morador"), "12345678900");
  await user.click(screen.getByRole("button", { name: "Buscar" }));
  await screen.findByText("FULANO DE TAL");
};

describe("Reset de senha", () => {
  beforeAll(async () => {
    await import("./ResetPasswordPage");
  });

  it("porteiro reseta pela pessoa do cadastro e vê a senha provisória uma vez", async () => {
    const user = userEvent.setup();
    const requests = openPage("porteiro", {
      "POST /auth/password/staff-reset": () =>
        okResponse({ accountId: "acc-1", email: "fulano@gmail.com", temporaryPassword: "Xk7mPq2RtZ" }),
    });

    await findPerson(user);
    expect(screen.getByText("A-124 · Proprietário · Morador")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Resetar senha" }));
    const dialog = await screen.findByRole("dialog");
    expect(requests.some((request) => request.path === "/auth/password/staff-reset")).toBe(false);
    await user.click(within(dialog).getByRole("button", { name: "Resetar senha" }));

    expect(await within(dialog).findByTestId("temporary-password")).toHaveTextContent("Xk7mPq2RtZ");
    expect(within(dialog).getByText("fulano@gmail.com")).toBeInTheDocument();
    expect(requests.find((request) => request.path === "/auth/password/staff-reset")?.body).toEqual({ personSequencia: 91 });
  });

  it("avisa quando a pessoa não tem conta no aplicativo", async () => {
    const user = userEvent.setup();
    openPage("porteiro", {
      "POST /auth/password/staff-reset": () => errorResponse("not-found", 404, "Nenhuma conta vinculada a esta pessoa."),
    });

    await findPerson(user);
    await user.click(screen.getByRole("button", { name: "Resetar senha" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Resetar senha" }));

    expect(await within(dialog).findByText("Esta pessoa não tem conta vinculada no aplicativo.")).toBeInTheDocument();
  });

  it("avisa quando o perfil não pode resetar aquela conta", async () => {
    const user = userEvent.setup();
    openPage("porteiro", { "POST /auth/password/staff-reset": () => errorResponse("forbidden", 403, "Acesso negado.") });

    await findPerson(user);
    await user.click(screen.getByRole("button", { name: "Resetar senha" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Resetar senha" }));

    expect(await within(dialog).findByText("Seu perfil não pode resetar a senha desta conta.")).toBeInTheDocument();
  });

  it("indica a tela Contas para síndico/admin", async () => {
    openPage("sindico");

    expect(await screen.findByRole("link", { name: "Contas" })).toHaveAttribute("href", "/contas");
  });
});
