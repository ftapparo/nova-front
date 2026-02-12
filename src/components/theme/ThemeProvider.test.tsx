import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useTheme } from "next-themes";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

const STORAGE_KEY = "nr-theme-test";

function ThemeHarness() {
  const { setTheme } = useTheme();

  return (
    <div>
      <button type="button" onClick={() => setTheme("dark")}>
        dark
      </button>
      <button type="button" onClick={() => setTheme("light")}>
        light
      </button>
    </div>
  );
}

describe("ThemeProvider", () => {
  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    document.documentElement.classList.remove("dark", "light");
  });

  it("applies dark class and persists theme", async () => {
    localStorage.removeItem(STORAGE_KEY);

    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey={STORAGE_KEY}>
        <ThemeHarness />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "dark" }));

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });

  it("removes dark class when switched to light", async () => {
    localStorage.setItem(STORAGE_KEY, "dark");

    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey={STORAGE_KEY}>
        <ThemeHarness />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "light" }));

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe("light");
  });
});
