import { beforeAll, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { startSession } from "@/core/session/sessionStore";
import { errorResponse, fakeApi, okResponse, sessionData, sessionUser, type FakeRequest } from "@/test/fakeApi";
import { installFakeWebSocket } from "@/test/fakeWebSocket";
import { renderApp } from "@/test/renderApp";

const ADMIN = "9152eea2-c5e7-4fec-a296-85f20c68f51f";
const accounts = [
  { id: ADMIN, email: "admin@novaresidence.com.br", role: "admin", mustChangePassword: false, createdAt: "2026-09-01T12:00:00.000Z" },
  { id: "acc-self", email: "morador.app@gmail.com", role: null, mustChangePassword: false, createdAt: "2026-10-01T12:00:00.000Z" },
  { id: "acc-staff-linked", email: "vinculado@gmail.com", role: null, mustChangePassword: false, createdAt: "2026-10-02T12:00:00.000Z" },
  { id: "acc-pending", email: "novo.morador@gmail.com", role: null, mustChangePassword: false, createdAt: "2026-11-10T12:00:00.000Z" },
];
const links = [
  { accountId: "acc-self", personSequencia: 91, linkedBy: "acc-self", linkedAt: "2026-10-01T13:00:00.000Z" },
  { accountId: "acc-staff-linked", personSequencia: 92, linkedBy: ADMIN, linkedAt: "2026-10-03T13:00:00.000Z" },
];

type Routes = Parameters<typeof fakeApi>[0];

const openPage = (routes: Routes = {}): FakeRequest[] => {
  installFakeWebSocket();
  const user = sessionUser({ id: ADMIN, role: "admin" });
  const requests = fakeApi({
    "GET /auth/me": () => okResponse(user),
    "POST /ws/ticket": () => errorResponse("upstream-error", 503, null),
    "GET /auth/users": () => okResponse(accounts),
    "GET /residence/links": () => okResponse(links),
    ...routes,
  });
  startSession(sessionData({ user }));
  renderApp("/vinculos");
  return requests;
};

describe("Vínculos", () => {
  beforeAll(async () => {
    await import("./LinksPage");
  });

  it("mostra as contas de morador sem vínculo, sem a equipe", async () => {
    openPage();

    const table = await screen.findByRole("table", { name: "Contas sem vínculo" });
    expect(within(table).getByText("novo.morador@gmail.com")).toBeInTheDocument();
    expect(within(table).queryByText("admin@novaresidence.com.br")).not.toBeInTheDocument();
    expect(within(table).queryByText("morador.app@gmail.com")).not.toBeInTheDocument();
  });

  it("mostra quem fez cada vínculo", async () => {
    const user = userEvent.setup();
    openPage();

    await user.click(await screen.findByRole("tab", { name: "Vinculadas (2)" }));
    const table = await screen.findByRole("table", { name: "Contas vinculadas" });
    const self = within(table).getByText("morador.app@gmail.com").closest("tr") as HTMLElement;
    expect(within(self).getByText("O próprio morador")).toBeInTheDocument();
    const byStaff = within(table).getByText("vinculado@gmail.com").closest("tr") as HTMLElement;
    expect(within(byStaff).getByText("admin@novaresidence.com.br")).toBeInTheDocument();
  });

  it("vincula depois de conferir a pessoa pelo CPF", async () => {
    const user = userEvent.setup();
    const requests = openPage({
      "GET /queries/cpf/12345678900": () =>
        okResponse({
          cpf: "12345678900",
          isValid: true,
          exists: true,
          person: { sequencia: 93, nome: "NOVO MORADOR", cpf: "12345678900" },
          links: [{ pessoaVinculo: { sequencia: 5, seqUnidade: 97, prop: "N", loc: "S", mor: "S" }, unidade: { sequencia: 97, quadra: "B", lote: "51" } }],
        }),
      "PUT /residence/links/acc-pending": () =>
        okResponse({ accountId: "acc-pending", personSequencia: 93, linkedBy: ADMIN, linkedAt: "2026-11-16T12:00:00.000Z" }),
    });

    const table = await screen.findByRole("table", { name: "Contas sem vínculo" });
    await user.click(within(table).getByRole("button", { name: "Vincular" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Vincular a esta pessoa" })).toBeDisabled();
    await user.type(within(dialog).getByLabelText("CPF"), "12345678900");
    await user.click(within(dialog).getByRole("button", { name: "Buscar" }));

    expect(await within(dialog).findByText("NOVO MORADOR")).toBeInTheDocument();
    expect(within(dialog).getByText("B-51 · Locatário · Morador")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Vincular a esta pessoa" }));

    expect(await screen.findByText("Conta vinculada ao cadastro.")).toBeInTheDocument();
    expect(requests.find((request) => request.method === "PUT")?.body).toEqual({ personSequencia: 93 });
  });

  it("mostra a recusa quando a pessoa já tem outra conta", async () => {
    const user = userEvent.setup();
    openPage({
      "GET /queries/cpf/12345678900": () =>
        okResponse({ cpf: "12345678900", isValid: true, exists: true, person: { sequencia: 91, nome: "JÁ VINCULADO", cpf: "12345678900" }, links: [] }),
      "PUT /residence/links/acc-pending": () => errorResponse("conflict", 409, "Esta pessoa já está vinculada a outra conta."),
    });

    await user.click(within(await screen.findByRole("table", { name: "Contas sem vínculo" })).getByRole("button", { name: "Vincular" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("CPF"), "12345678900");
    await user.click(within(dialog).getByRole("button", { name: "Buscar" }));
    await user.click(await within(dialog).findByRole("button", { name: "Vincular a esta pessoa" }));

    expect(await within(dialog).findByText("Esta pessoa já está vinculada a outra conta.")).toBeInTheDocument();
  });

  it("remove o vínculo só depois de confirmar", async () => {
    const user = userEvent.setup();
    const requests = openPage({ "DELETE /residence/links/acc-self": () => okResponse(null) });

    await user.click(await screen.findByRole("tab", { name: "Vinculadas (2)" }));
    const row = within(await screen.findByRole("table", { name: "Contas vinculadas" })).getByText("morador.app@gmail.com").closest("tr") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Remover" }));
    expect(requests.some((request) => request.method === "DELETE")).toBe(false);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Remover vínculo" }));

    expect(await screen.findByText("Vínculo removido.")).toBeInTheDocument();
    await waitFor(() => expect(requests.filter((request) => request.path === "/residence/links").length).toBeGreaterThan(1));
  });
});
