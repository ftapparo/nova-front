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
    document.documentElement.style.colorScheme = "";
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

  it("updates theme-color meta in real time", async () => {
    const existingMeta = document.querySelector("meta[name='theme-color']");
    existingMeta?.remove();

    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey={STORAGE_KEY}>
        <ThemeHarness />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "dark" }));

    await waitFor(() => {
      const meta = document.querySelector("meta[name='theme-color']");
      expect(meta?.getAttribute("content")).toBe("#10131A");
      expect(document.documentElement.style.colorScheme).toBe("dark");
    });

    fireEvent.click(screen.getByRole("button", { name: "light" }));

    await waitFor(() => {
      const meta = document.querySelector("meta[name='theme-color']");
      expect(meta?.getAttribute("content")).toBe("#F5F6FA");
      expect(document.documentElement.style.colorScheme).toBe("light");
    });
  });
});
