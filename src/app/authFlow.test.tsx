import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getSession, startSession } from "@/core/session/sessionStore";
import { errorResponse, fakeApi, okResponse, sessionData, sessionUser } from "@/test/fakeApi";
import { renderApp } from "@/test/renderApp";

const fillLogin = async (user: ReturnType<typeof userEvent.setup>, email: string, password: string) => {
  await user.type(await screen.findByLabelText("E-mail"), email);
  await user.type(screen.getByLabelText("Senha"), password);
  await user.click(screen.getByRole("button", { name: "Entrar" }));
};

describe("login", () => {
  it("pede login e depois volta para a tela que a pessoa queria abrir", async () => {
    const user = userEvent.setup();
    const requests = fakeApi({
      "POST /auth/login": () => okResponse(sessionData()),
      "GET /auth/me": () => okResponse(sessionUser()),
    });
    renderApp("/exaustores");

    await fillLogin(user, "portaria@novaresidence.com.br", "senha-correta");

    expect(await screen.findByRole("heading", { name: "Exaustores" })).toBeInTheDocument();
    expect(requests[0]?.body).toEqual({ email: "portaria@novaresidence.com.br", password: "senha-correta" });
  });

  it("mostra a recusa do servidor para credenciais erradas", async () => {
    const user = userEvent.setup();
    fakeApi({ "POST /auth/login": () => errorResponse("unauthorized", 401, "Credenciais inválidas.") });
    renderApp("/login");

    await fillLogin(user, "portaria@novaresidence.com.br", "errada");

    expect(await screen.findByRole("alert")).toHaveTextContent("Credenciais inválidas.");
    expect(getSession()).toBeNull();
  });

  it("valida os campos antes de chamar a API", async () => {
    const user = userEvent.setup();
    const requests = fakeApi({});
    renderApp("/login");

    await user.click(await screen.findByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Informe um e-mail válido.")).toBeInTheDocument();
    expect(screen.getByText("Informe a senha.")).toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });

  it("trava o botão pelo tempo do Retry-After", async () => {
    const user = userEvent.setup();
    fakeApi({
      "POST /auth/login": () =>
        errorResponse("rate-limited", 429, "Muitas tentativas. Tente novamente mais tarde.", { retryAfter: 30 }),
    });
    renderApp("/login");

    await fillLogin(user, "portaria@novaresidence.com.br", "errada");

    expect(await screen.findByRole("button", { name: "Aguarde 30 s" })).toBeDisabled();
  });
});

describe("pendências da conta", () => {
  it("leva direto para a troca quando a senha é provisória e libera o painel depois", async () => {
    const user = userEvent.setup();
    const pending = sessionUser({ mustChangePassword: true });
    const requests = fakeApi({
      "GET /auth/me": () => okResponse(getSession()?.user),
      "POST /auth/password/change": () => okResponse(sessionData({ accessToken: "access-2", refreshToken: "refresh-2" })),
    });
    startSession(sessionData({ user: pending }));
    renderApp("/");

    expect(await screen.findByRole("heading", { name: "Defina uma nova senha" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Senha provisória"), "provisoria-123");
    await user.type(screen.getByLabelText("Nova senha"), "nova-senha-123");
    await user.type(screen.getByLabelText("Repita a nova senha"), "nova-senha-123");
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(await screen.findByRole("heading", { name: "Painel Operacional" })).toBeInTheDocument();
    expect(requests.find((request) => request.path === "/auth/password/change")?.body).toEqual({
      currentPassword: "provisoria-123",
      newPassword: "nova-senha-123",
    });
    expect(getSession()?.refreshToken).toBe("refresh-2");
  });

  it("não envia a troca quando a confirmação não confere", async () => {
    const user = userEvent.setup();
    const requests = fakeApi({ "GET /auth/me": () => okResponse(getSession()?.user) });
    startSession(sessionData({ user: sessionUser({ mustChangePassword: true }) }));
    renderApp("/");

    await user.type(await screen.findByLabelText("Senha provisória"), "provisoria-123");
    await user.type(screen.getByLabelText("Nova senha"), "nova-senha-123");
    await user.type(screen.getByLabelText("Repita a nova senha"), "outra-coisa-123");
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(await screen.findByText("As senhas não conferem.")).toBeInTheDocument();
    expect(requests.some((request) => request.path === "/auth/password/change")).toBe(false);
  });

  it("não pede aceite do Termo: ele é do aplicativo dos moradores", async () => {
    const requests = fakeApi({ "GET /auth/me": () => okResponse(getSession()?.user) });
    startSession(sessionData({ user: sessionUser({ mustAcceptTerms: true }) }));
    renderApp("/");

    expect(await screen.findByRole("heading", { name: "Painel Operacional" })).toBeInTheDocument();
    expect(requests.some((request) => request.path.startsWith("/legal"))).toBe(false);
  });

  it("não abre o painel para conta sem papel de equipe", async () => {
    const resident = sessionUser({ role: null, email: "morador@gmail.com" });
    fakeApi({ "GET /auth/me": () => okResponse(resident) });
    startSession(sessionData({ user: resident }));
    renderApp("/");

    expect(await screen.findByRole("heading", { name: "Painel de uso da equipe" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Painel Operacional" })).not.toBeInTheDocument();
  });

  it("aplica o papel relido do servidor quando ele mudou desde o login", async () => {
    fakeApi({ "GET /auth/me": () => okResponse(sessionUser({ role: null })) });
    startSession(sessionData({ user: sessionUser({ role: "admin" }) }));
    renderApp("/");

    expect(await screen.findByRole("heading", { name: "Painel de uso da equipe" })).toBeInTheDocument();
  });
});

describe("logout", () => {
  it("sai e limpa a sessão local mesmo quando a chamada de logout falha", async () => {
    const user = userEvent.setup();
    fakeApi({
      "GET /auth/me": () => okResponse(sessionUser()),
      "POST /auth/logout": () => errorResponse("upstream-error", 503, "Serviço de autenticação indisponível."),
    });
    startSession(sessionData());
    renderApp("/");

    await user.click(await screen.findByRole("button", { name: "Conta" }));
    await user.click(await screen.findByRole("menuitem", { name: "Sair" }));

    expect(await screen.findByRole("button", { name: "Entrar" })).toBeInTheDocument();
    await waitFor(() => expect(getSession()).toBeNull());
  });
});
