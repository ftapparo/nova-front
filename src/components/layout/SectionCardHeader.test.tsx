import { render, screen } from "@testing-library/react";
import SectionCardHeader from "@/components/layout/SectionCardHeader";

describe("SectionCardHeader", () => {
  it("applies semantic defaults", () => {
    render(<SectionCardHeader title="Buscar Pessoa" description="Informe CPF" />);

    expect(screen.getByRole("heading", { name: "Buscar Pessoa" })).toHaveClass("typo-card-title");
    expect(screen.getByText("Informe CPF")).toHaveClass("typo-card-subtitle");
  });

  it("keeps semantic defaults and accepts overrides", () => {
    render(
      <SectionCardHeader
        title="Buscar Pessoa"
        description="Informe CPF"
        titleClassName="custom-card-title"
        descriptionClassName="custom-card-description"
      />,
    );

    expect(screen.getByRole("heading", { name: "Buscar Pessoa" })).toHaveClass("typo-card-title", "custom-card-title");
    expect(screen.getByText("Informe CPF")).toHaveClass("typo-card-subtitle", "custom-card-description");
  });
});

