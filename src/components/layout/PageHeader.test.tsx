import { render, screen } from "@testing-library/react";
import PageHeader from "@/components/layout/PageHeader";

describe("PageHeader", () => {
  it("applies semantic defaults", () => {
    render(<PageHeader title="Painel" description="Resumo geral" />);

    expect(screen.getByRole("heading", { name: "Painel" })).toHaveClass("typo-page-title");
    expect(screen.getByText("Resumo geral")).toHaveClass("typo-page-subtitle");
  });

  it("keeps semantic defaults and accepts overrides", () => {
    render(
      <PageHeader
        title="Painel"
        description="Resumo geral"
        titleClassName="custom-title"
        descriptionClassName="custom-description"
      />,
    );

    expect(screen.getByRole("heading", { name: "Painel" })).toHaveClass("typo-page-title", "custom-title");
    expect(screen.getByText("Resumo geral")).toHaveClass("typo-page-subtitle", "custom-description");
  });
});

