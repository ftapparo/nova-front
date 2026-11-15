import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotifyProvider from "./NotifyProvider";
import { useNotify } from "./useNotify";

function Trigger() {
  const notify = useNotify();
  return (
    <>
      <button onClick={() => notify.success("Portão aberto")}>ok</button>
      <button onClick={() => notify.error("Portão recusou o comando")}>falha</button>
    </>
  );
}

describe("NotifyProvider", () => {
  it("mostra o aviso pedido", async () => {
    const user = userEvent.setup();
    render(
      <NotifyProvider>
        <Trigger />
      </NotifyProvider>,
    );

    await user.click(screen.getByRole("button", { name: "ok" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Portão aberto");
  });

  it("mostra o próximo aviso da fila depois que o atual é fechado", async () => {
    const user = userEvent.setup();
    render(
      <NotifyProvider>
        <Trigger />
      </NotifyProvider>,
    );

    await user.click(screen.getByRole("button", { name: "ok" }));
    await user.click(screen.getByRole("button", { name: "falha" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Portão aberto");

    await user.click(screen.getByRole("button", { name: /fechar|close/i }));

    expect(await screen.findByText("Portão recusou o comando")).toBeInTheDocument();
  });

  it("falha de forma clara fora do provider", () => {
    expect(() => render(<Trigger />)).toThrow("useNotify precisa estar dentro de NotifyProvider");
  });
});
