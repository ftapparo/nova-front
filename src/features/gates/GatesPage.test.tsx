import { beforeAll, describe, expect, it } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { startSession } from "@/core/session/sessionStore";
import { errorResponse, fakeApi, okResponse, sessionData, sessionUser, type FakeRequest } from "@/test/fakeApi";
import { FakeWebSocket, installFakeWebSocket, lastSocket } from "@/test/fakeWebSocket";
import { renderApp } from "@/test/renderApp";

const gates = [
  { numeroDispositivo: 9, nome: "PORTÃO ENTRADA", sentido: "E", ativo: true },
  { numeroDispositivo: 10, nome: "PORTÃO SAÍDA", sentido: "S", ativo: true },
  { numeroDispositivo: 11, nome: "PORTÃO DESATIVADO", sentido: "E", ativo: false },
];

const resident = {
  NOME: "FULANO DE TAL",
  QUADRA: "A",
  LOTE: "124",
  DESCRICAO: "MORADOR",
  PERMITIDO: "S",
  PROP: "S",
  LOC: "N",
  MOR: "S",
  SEQPESSOA: 91,
  SEQCLASSIFICACAO: "3",
  CLASSIFAUTORIZADA: "S",
  AUTORIZACAOLANC: "S",
  TIPO: "P",
  SEQIDACESSO: 501,
  PANICO: "N",
  IDENT: "12345678900",
  SEQVEICULO: null,
};

type Routes = Parameters<typeof fakeApi>[0];

const openPage = (role: "porteiro" | "sindico" = "porteiro", routes: Routes = {}): FakeRequest[] => {
  installFakeWebSocket();
  const user = sessionUser({ role });
  const requests = fakeApi({
    "GET /auth/me": () => okResponse(user),
    "POST /ws/ticket": () => okResponse({ ticket: "t-1", expiresIn: 30 }),
    "GET /tag/gates": () => okResponse(gates),
    "GET /tag/status": () =>
      okResponse({
        updatedAt: null,
        gates: [
          { numeroDispositivo: 9, nome: "PORTÃO ENTRADA", sentido: "E", online: true },
          { numeroDispositivo: 10, nome: "PORTÃO SAÍDA", sentido: "S", online: false },
        ],
      }),
    "GET /tag/gate/state": ({ query }) =>
      query.get("numeroDispositivo") === "9" ? okResponse({ state: "closed" }) : errorResponse("upstream-error", 502, null),
    "GET /doors": () =>
      okResponse([
        { id: 1, nome: "PORTA SOCIAL", porta: 80, ativo: true },
        { id: 2, nome: "PORTA DESATIVADA", porta: 80, ativo: false },
      ]),
    "GET /doors/status": () => okResponse({ updatedAt: null, doors: [{ id: 1, nome: "PORTA SOCIAL", porta: 80, online: true }] }),
    ...routes,
  });
  startSession(sessionData({ user }));
  renderApp("/portoes-portas");
  return requests;
};

const post = (requests: FakeRequest[], path: string) =>
  requests.filter((request) => request.method === "POST" && request.path === path);

const verifyCpf = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(await screen.findByLabelText("CPF"), "12345678900");
  await user.click(screen.getByRole("button", { name: "Conferir" }));
};

describe("Portões e Portas", () => {
  beforeAll(async () => {
    await import("./GatesPage");
  });

  it("lista portões e portas ativos com a situação de cada um", async () => {
    openPage();

    const entrada = await screen.findByRole("heading", { name: "PORTÃO ENTRADA" });
    expect(screen.getByRole("heading", { name: "PORTÃO SAÍDA" })).toBeInTheDocument();
    expect(screen.queryByText("PORTÃO DESATIVADO")).not.toBeInTheDocument();
    expect(await within(entrada.closest(".MuiCard-root") as HTMLElement).findByText("Fechado")).toBeInTheDocument();
    expect(screen.getByText("Sem comunicação")).toBeInTheDocument();

    expect(await screen.findByText("PORTA SOCIAL")).toBeInTheDocument();
    expect(screen.queryByText("PORTA DESATIVADA")).not.toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();
  });

  it("só abre o portão depois de conferir o CPF, e registra a passagem", async () => {
    const user = userEvent.setup();
    const requests = openPage("porteiro", {
      "GET /access/verify": () => okResponse([resident]),
      "POST /tag/gate/open": () => okResponse({ action: "open", autoCloseSeconds: 15, gate: { state: "opening" } }),
      "POST /access/register": () => okResponse({}, 201),
    });

    const open = await screen.findByRole("button", { name: "Abrir portão" });
    expect(open).toBeDisabled();

    await verifyCpf(user);
    expect(await screen.findByText("FULANO DE TAL")).toBeInTheDocument();
    expect(screen.getByText("Autorizado")).toBeInTheDocument();
    const verify = requests.find((request) => request.path === "/access/verify");
    expect(Object.fromEntries(verify?.query ?? [])).toEqual({ id: "12345678900", numeroDispositivo: "9", sentido: "E" });

    await user.click(open);

    expect(await screen.findByText("PORTÃO ENTRADA aberto e passagem registrada.")).toBeInTheDocument();
    expect(post(requests, "/tag/gate/open")[0]?.body).toEqual({ numeroDispositivo: 9, autoCloseTime: 15 });
    expect(post(requests, "/access/register")[0]?.body).toEqual({
      dispositivo: 9,
      pessoa: 91,
      classificacao: 3,
      classAutorizado: "S",
      autorizacaoLanc: "S",
      origem: "P",
      seqIdAcesso: 501,
      sentido: "E",
      quadra: "A",
      lote: "124",
      panico: "N",
      formaAcesso: "TAG",
      idAcesso: "12345678900",
      seqVeiculo: 0,
    });
    // Depois de abrir, o painel volta ao começo: outra pessoa, outra conferência.
    expect(screen.getByLabelText("CPF")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Abrir portão" })).toBeDisabled();
  });

  it("não deixa abrir para quem não está autorizado", async () => {
    const user = userEvent.setup();
    openPage("porteiro", { "GET /access/verify": () => okResponse([{ ...resident, PERMITIDO: "N" }]) });

    await verifyCpf(user);

    expect(await screen.findByText("Não autorizado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir portão" })).toBeDisabled();
  });

  it("avisa quando o CPF não tem cadastro", async () => {
    const user = userEvent.setup();
    openPage("porteiro", {
      "GET /access/verify": () => errorResponse("not-found", 404, "Credencial não encontrada."),
    });

    await verifyCpf(user);

    expect(await screen.findByText("Nenhum cadastro encontrado para este CPF.")).toBeInTheDocument();
  });

  it("avisa quando o portão abriu mas a passagem não foi registrada", async () => {
    const user = userEvent.setup();
    openPage("porteiro", {
      "GET /access/verify": () => okResponse([resident]),
      "POST /tag/gate/open": () => okResponse({ action: "open", autoCloseSeconds: 15, gate: { state: "opening" } }),
      "POST /access/register": () => errorResponse("upstream-error", 502, "Falha ao registrar acesso."),
    });

    await verifyCpf(user);
    await user.click(await screen.findByRole("button", { name: "Abrir portão" }));

    expect(
      await screen.findByText("Portão aberto, mas a passagem não foi registrada: Falha ao registrar acesso."),
    ).toBeInTheDocument();
  });

  it("não repete o comando e trava o botão pelo tempo do Retry-After", async () => {
    const user = userEvent.setup();
    const requests = openPage("porteiro", {
      "GET /access/verify": () => okResponse([resident]),
      "POST /tag/gate/open": () =>
        errorResponse("rate-limited", 429, "Muitos comandos. Tente novamente em instantes.", { retryAfter: 30 }),
    });

    await verifyCpf(user);
    await user.click(await screen.findByRole("button", { name: "Abrir portão" }));

    expect(await screen.findByRole("button", { name: "Aguarde 30 s" })).toBeDisabled();
    expect(post(requests, "/tag/gate/open")).toHaveLength(1);
    expect(post(requests, "/access/register")).toHaveLength(0);
  });

  it("abre a porta", async () => {
    const user = userEvent.setup();
    const requests = openPage("porteiro", { "POST /doors/1/open": () => okResponse({ id: 1, nome: "PORTA SOCIAL", porta: 80 }) });

    await user.click(await screen.findByRole("button", { name: "Abrir" }));

    expect(await screen.findByText("PORTA SOCIAL: aberta.")).toBeInTheDocument();
    expect(post(requests, "/doors/1/open")).toHaveLength(1);
  });

  it("mostra a recusa do equipamento sem repetir o comando", async () => {
    const user = userEvent.setup();
    const requests = openPage("porteiro", {
      "POST /doors/1/open": () => errorResponse("conflict", 409, "Porta sem IP configurado."),
    });

    const button = await screen.findByRole("button", { name: "Abrir" });
    await user.click(button);

    expect(await screen.findByText("Porta sem IP configurado.")).toBeInTheDocument();
    // Liberado para o operador tentar de novo à mão, mas nada foi repetido sozinho.
    await waitFor(() => expect(button).toBeEnabled());
    expect(post(requests, "/doors/1/open")).toHaveLength(1);
  });

  it("atualiza estado e comunicação pelos eventos do tempo real", async () => {
    openPage();
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    act(() => lastSocket().serverOpen());
    const card = (await screen.findByRole("heading", { name: "PORTÃO ENTRADA" })).closest(".MuiCard-root") as HTMLElement;
    expect(await within(card).findByText("Fechado")).toBeInTheDocument();

    act(() =>
      lastSocket().serverSend({ event: "gate.state.changed", data: { numeroDispositivo: 9, state: "open", keepOpen: true } }),
    );
    expect(await within(card).findByText("Aberto")).toBeInTheDocument();
    expect(within(card).getByText("Mantido aberto")).toBeInTheDocument();

    act(() =>
      lastSocket().serverSend({ event: "antenna.connection.changed", data: { numeroDispositivo: 9, connected: false } }),
    );
    expect(await within(card).findByText("Antena desconectada")).toBeInTheDocument();

    act(() =>
      lastSocket().serverSend({
        event: "devices.status.changed",
        data: { updatedAt: null, gates: [], doors: [{ id: 1, nome: "PORTA SOCIAL", online: false }] },
      }),
    );
    await waitFor(() => expect(screen.queryByText("Online")).not.toBeInTheDocument());
  });

  it("esconde de quem é porteiro as ações de síndico/admin", async () => {
    openPage("porteiro");

    await screen.findByRole("heading", { name: "PORTÃO ENTRADA" });
    expect(screen.queryByRole("button", { name: "Mais ações de PORTÃO ENTRADA" })).not.toBeInTheDocument();
  });

  it("síndico mantém o portão aberto só depois de confirmar", async () => {
    const user = userEvent.setup();
    const requests = openPage("sindico", {
      "POST /tag/gate/open": () =>
        okResponse({ action: "open", autoCloseSeconds: null, gate: { state: "opening", keepOpen: true } }),
    });

    await user.click(await screen.findByRole("button", { name: "Mais ações de PORTÃO ENTRADA" }));
    await user.click(await screen.findByRole("menuitem", { name: "Manter aberto" }));
    expect(post(requests, "/tag/gate/open")).toHaveLength(0);

    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Abrir e manter aberto" }));

    expect(await screen.findByText("PORTÃO ENTRADA: mantido aberto até ser fechado.")).toBeInTheDocument();
    expect(post(requests, "/tag/gate/open")[0]?.body).toEqual({ numeroDispositivo: 9, keepOpen: true });
  });
});
