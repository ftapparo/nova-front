import { beforeAll, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { startSession } from "@/core/session/sessionStore";
import { errorResponse, fakeApi, okResponse, sessionData, sessionUser, type FakeRequest } from "@/test/fakeApi";
import { installFakeWebSocket } from "@/test/fakeWebSocket";
import { renderApp } from "@/test/renderApp";
import { plateOwnedByOther, type Vehicle } from "./vehiclesApi";

const person = {
  sequencia: 91,
  nome: "FULANO DE TAL",
  cpf: "12345678900",
  telCelular: "11999990000",
  email: "fulano@exemplo.com",
  // Campos longos do ERP chegam como bytes (Buffer serializado), em Windows-1252.
  alertaPortaria: { type: "Buffer", data: [..."Encomendas s"].map((char) => char.charCodeAt(0)).concat(0xf3, ...[..." com o morador"].map((char) => char.charCodeAt(0))) },
  observacoes: { type: "Buffer", data: [] },
  foto: null,
};

const cpfResult = {
  cpf: "12345678900",
  isValid: true,
  exists: true,
  person,
  links: [{ pessoaVinculo: { sequencia: 1, seqUnidade: 97, prop: "S", loc: "N", mor: "S" }, unidade: { sequencia: 97, quadra: "A", lote: "124", bloquear: "N" } }],
};

const vehicle = (overrides: Partial<Vehicle> = {}): Vehicle => ({
  SEQUENCIA: 501,
  PLACA: "ABC1D23",
  MARCA: "FIAT",
  MODELO: "UNO",
  COR: "PRATA",
  SEQUNIDADE: 97,
  PROPRIETARIO: 91,
  TAGVEICULO: null,
  UNIDADEQUADRA: "A",
  UNIDADELOTE: "124",
  ...overrides,
});

type Routes = Parameters<typeof fakeApi>[0];

const open = (path: string, routes: Routes = {}): FakeRequest[] => {
  installFakeWebSocket();
  const user = sessionUser({ role: "porteiro" });
  const requests = fakeApi({
    "GET /auth/me": () => okResponse(user),
    "POST /ws/ticket": () => errorResponse("upstream-error", 503, null),
    "GET /tag/gates": () =>
      okResponse([
        { numeroDispositivo: 10, nome: "PORTÃO SAÍDA", sentido: "S", ativo: true },
        { numeroDispositivo: 9, nome: "PORTÃO ENTRADA", sentido: "E", ativo: true },
      ]),
    "GET /queries/cpf/12345678900": () => okResponse(cpfResult),
    "GET /access/verify": () => okResponse([{ NOME: "FULANO DE TAL", PERMITIDO: "S", MOR: "S" }]),
    "GET /vehicles": () => okResponse([vehicle()]),
    ...routes,
  });
  startSession(sessionData({ user }));
  renderApp(path);
  return requests;
};

const searchOwner = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(await screen.findByLabelText("CPF do proprietário"), "12345678900");
  await user.click(screen.getByRole("button", { name: "Buscar" }));
  await screen.findByRole("table", { name: "Veículos do proprietário" });
};

describe("plateOwnedByOther", () => {
  it("recusa placa de outro proprietário ou unidade", () => {
    expect(plateOwnedByOther(vehicle(), 91, 97)).toBe(false);
    expect(plateOwnedByOther(vehicle({ PROPRIETARIO: 12 }), 91, 97)).toBe(true);
    expect(plateOwnedByOther(vehicle({ SEQUNIDADE: 33 }), 91, 97)).toBe(true);
    expect(plateOwnedByOther(vehicle({ PROPRIETARIO: null, SEQUNIDADE: null }), 91, 97)).toBe(false);
  });
});

describe("Consultas", () => {
  beforeAll(async () => {
    await import("./QueriesPage");
  });

  it("consulta por CPF e mostra pessoa, aviso da portaria e unidades", async () => {
    const user = userEvent.setup();
    open("/consultas");

    await user.type(await screen.findByLabelText("CPF"), "123.456.789-00");
    await user.click(screen.getByRole("button", { name: "Consultar" }));

    expect(await screen.findByText("FULANO DE TAL")).toBeInTheDocument();
    expect(screen.getByText("CPF 123.456.789-00")).toBeInTheDocument();
    expect(screen.getByText("Aviso para a portaria: Encomendas só com o morador")).toBeInTheDocument();
    expect(screen.getByText("Proprietário · Morador")).toBeInTheDocument();
  });

  it("consulta por placa já no formato aceito pela API", async () => {
    const user = userEvent.setup();
    const requests = open("/consultas", {
      "GET /queries/plate/ABC1D23": () =>
        okResponse({
          plate: "ABC1D23",
          exists: true,
          vehicle: { sequencia: 501, placa: "ABC1D23", marca: "FIAT", modelo: "UNO", cor: "PRATA", tagVeiculo: "0001234567" },
          unit: { sequencia: 97, quadra: "A", lote: "124" },
          owner: person,
          accesses: [{ sequencia: 7, tipo: "TAG", id: "0001234567", id2: null, acessoLiberado: "S" }],
        }),
    });

    await user.click(await screen.findByRole("tab", { name: "Placa" }));
    await user.type(screen.getByLabelText("Placa"), "abc-1d23");
    await user.click(screen.getByRole("button", { name: "Consultar" }));

    expect(await screen.findByText("FIAT · UNO · PRATA")).toBeInTheDocument();
    expect(screen.getByText("Liberada")).toBeInTheDocument();
    expect(requests.some((request) => request.path === "/queries/plate/ABC1D23")).toBe(true);
  });

  it("só libera a consulta de TAG com 10 dígitos", async () => {
    const user = userEvent.setup();
    open("/consultas");

    await user.click(await screen.findByRole("tab", { name: "TAG" }));
    await user.type(screen.getByLabelText("TAG (10 dígitos)"), "12345");

    expect(screen.getByRole("button", { name: "Consultar" })).toBeDisabled();
  });
});

describe("Veículos", () => {
  beforeAll(async () => {
    await import("./VehiclesPage");
  });

  it("busca o proprietário, confere o vínculo no portão de entrada e lista os veículos", async () => {
    const user = userEvent.setup();
    const requests = open("/veiculos");

    await searchOwner(user);

    expect(screen.getByText("Pode cadastrar veículos")).toBeInTheDocument();
    expect(screen.getByText("ABC1D23")).toBeInTheDocument();
    const verify = requests.find((request) => request.path === "/access/verify");
    expect(Object.fromEntries(verify?.query ?? [])).toEqual({ id: "12345678900", numeroDispositivo: "9", sentido: "E" });
    expect(requests.find((request) => request.path === "/vehicles")?.query.get("ownerSeq")).toBe("91");
  });

  it("não deixa adicionar veículo quando o vínculo não permite", async () => {
    const user = userEvent.setup();
    open("/veiculos", { "GET /access/verify": () => okResponse([{ PERMITIDO: "N", MOR: "S" }]) });

    await searchOwner(user);

    expect(screen.getByText("Vínculo não permite cadastrar veículos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar veículo" })).toBeDisabled();
  });

  it("cadastra placa nova com os dados das fontes externas", async () => {
    const user = userEvent.setup();
    const requests = open("/veiculos", {
      "GET /vehicles/plate/XYZ9K88": () => okResponse({ exists: false, vehicle: null, accessTag: null }),
      "POST /vehicles/plate/lookup": () =>
        okResponse({ plate: "XYZ9K88", consolidated: { brand: "VW", model: "GOL", color: "BRANCO" }, overallSuccess: true }),
      "PUT /vehicles/plate/XYZ9K88": () => okResponse({ created: true, vehicle: vehicle({ PLACA: "XYZ9K88" }) }),
    });
    await searchOwner(user);

    await user.click(screen.getByRole("button", { name: "Adicionar veículo" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Placa"), "xyz9k88");
    await user.click(within(dialog).getByRole("button", { name: "Consultar placa" }));

    expect(await within(dialog).findByDisplayValue("GOL")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Gravar veículo" }));

    expect(await screen.findByText("Veículo cadastrado.")).toBeInTheDocument();
    expect(requests.find((request) => request.method === "PUT")?.body).toEqual({
      brand: "VW",
      model: "GOL",
      color: "BRANCO",
      ownerSeq: 91,
      unitSeq: 97,
    });
  });

  it("recusa placa que já é de outro proprietário", async () => {
    const user = userEvent.setup();
    const requests = open("/veiculos", {
      "GET /vehicles/plate/XYZ9K88": () =>
        okResponse({ exists: true, vehicle: vehicle({ PLACA: "XYZ9K88", PROPRIETARIO: 12, OWNERNOME: "BELTRANO", OWNERCPF: "98765432100", UNIDADEQUADRA: "C", UNIDADELOTE: "33" }), accessTag: null }),
    });
    await searchOwner(user);

    await user.click(screen.getByRole("button", { name: "Adicionar veículo" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Placa"), "XYZ9K88");
    await user.click(within(dialog).getByRole("button", { name: "Consultar placa" }));

    expect(await within(dialog).findByText(/Placa já vinculada a BELTRANO, CPF 987\.654\.321-00, unidade C-33/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Gravar veículo" })).toBeDisabled();
    expect(requests.some((request) => request.path === "/vehicles/plate/lookup")).toBe(false);
  });

  it("deixa digitar marca, modelo e cor quando as fontes externas falham", async () => {
    const user = userEvent.setup();
    open("/veiculos", {
      "GET /vehicles/plate/XYZ9K88": () => okResponse({ exists: false, vehicle: null, accessTag: null }),
      "POST /vehicles/plate/lookup": () => errorResponse("upstream-error", 502, "Falha ao consultar fontes externas da placa."),
    });
    await searchOwner(user);

    await user.click(screen.getByRole("button", { name: "Adicionar veículo" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Placa"), "XYZ9K88");
    await user.click(within(dialog).getByRole("button", { name: "Consultar placa" }));

    expect(await within(dialog).findByText("Não foi possível localizar a placa. Preencha marca, modelo e cor.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Gravar veículo" })).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Marca"), "vw");
    await user.type(within(dialog).getByLabelText("Modelo"), "gol");
    await user.type(within(dialog).getByLabelText("Cor"), "branco");
    expect(within(dialog).getByRole("button", { name: "Gravar veículo" })).toBeEnabled();
  });

  it("troca a TAG só depois de confirmar", async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    open("/veiculos", {
      "PUT /vehicles/501/tag": ({ body }) => {
        bodies.push(body);
        return (body as { forceSwap: boolean }).forceSwap
          ? okResponse({ status: "swapped", vehicleSeq: 501, tag: "0009998887" })
          : errorResponse("conflict", 409, "O veículo já tem a TAG 0001234567.", { title: "Confirmação necessária" });
      },
    });
    await searchOwner(user);

    await user.click(screen.getByRole("button", { name: "Ações do veículo ABC1D23" }));
    await user.click(await screen.findByRole("menuitem", { name: "Vincular TAG" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("TAG (10 dígitos)"), "0009998887");
    await user.click(within(dialog).getByRole("button", { name: "Salvar TAG" }));

    expect(await within(dialog).findByText(/O veículo já tem a TAG 0001234567\. Confirmar a troca\?/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Trocar a TAG" }));

    expect(await screen.findByText("TAG trocada.")).toBeInTheDocument();
    expect(bodies).toEqual([
      { cpf: "12345678900", tag: "0009998887", numeroDispositivo: 9, forceSwap: false },
      { cpf: "12345678900", tag: "0009998887", numeroDispositivo: 9, forceSwap: true },
    ]);
  });

  it("desvincula o veículo só depois de confirmar", async () => {
    const user = userEvent.setup();
    const requests = open("/veiculos", {
      "DELETE /vehicles/501/owner": () => okResponse({ vehicleSeq: 501, ownerUnlinked: true, tagRemoved: true }),
    });
    await searchOwner(user);

    await user.click(screen.getByRole("button", { name: "Ações do veículo ABC1D23" }));
    await user.click(await screen.findByRole("menuitem", { name: "Desvincular do proprietário" }));
    expect(requests.some((request) => request.method === "DELETE")).toBe(false);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Desvincular" }));

    expect(await screen.findByText("Veículo desvinculado do proprietário.")).toBeInTheDocument();
    await waitFor(() => expect(requests.filter((request) => request.path === "/vehicles").length).toBeGreaterThan(1));
  });
});
