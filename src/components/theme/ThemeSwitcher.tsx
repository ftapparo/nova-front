import { useEffect, useState } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ThemeOption = "light" | "dark" | "system";

const OPTIONS: { value: ThemeOption; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

function ThemeLabel({ value }: { value: ThemeOption }) {
  const option = OPTIONS.find((item) => item.value === value) ?? OPTIONS[2];
  const Icon = option.icon;

  return (
    <span className="flex items-center gap-2">
      <Icon className="h-4 w-4" />
      <span>{option.label}</span>
    </span>
  );
}

export default function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme: ThemeOption = mounted && (theme === "light" || theme === "dark" || theme === "system") ? theme : "system";
  const activeOption = OPTIONS.find((item) => item.value === activeTheme) ?? OPTIONS[2];
  const ActiveIcon = activeOption.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={compact ? "icon" : "sm"} className={cn("justify-start", compact ? "h-8 w-8" : "h-8 w-full px-2")}>
          <span className="sr-only">Alternar tema</span>
          {compact ? <ActiveIcon className="h-4 w-4" /> : <ThemeLabel value={activeTheme} />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        {OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => setTheme(option.value)}
            className="flex items-center justify-between gap-3"
          >
            <ThemeLabel value={option.value} />
            {activeTheme === option.value ? <Check className="h-4 w-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
