import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import BrandLogo from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("portaria");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem("nr_remember_me") === "true");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    localStorage.setItem("nr_remember_me", String(rememberMe));
    const result = await login(username, password, rememberMe);
    setLoading(false);

    if (result.success) {
      navigate("/dashboard", { replace: true });
    } else {
      setError(result.error || "Erro desconhecido");
    }
  };

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-background sm:bg-transparent">
      <div className="absolute inset-0 z-0 hidden sm:block">
        <img
          src="/background-nova-residence.png"
          alt=""
          aria-hidden="true"
          className="h-full w-full scale-[1.2] object-cover blur-[10px]"
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/35 via-primary/10 to-primary-dark/45" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center p-8 sm:px-4 sm:py-10">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="w-full min-h-[540px] p-0 sm:rounded-2xl sm:border sm:border-border sm:bg-card sm:p-6 sm:shadow-2xl">
            <div className="text-center">
              <div className="mx-auto mb-4 mt-3 flex items-center justify-center">
                <BrandLogo className="h-20 w-auto max-w-[400px]" fallbackClassName="h-20 w-20" />
              </div>
              <p className="mb-0 typo-section-title text-primary dark:text-white">Portal Administrativo</p>
              <p className="typo-caption">Portaria e Zeladoria</p>
            </div>

            <div className="mt-3 p-0 sm:rounded-xl sm:bg-card sm:p-6">
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <Label htmlFor="username" className="typo-label text-foreground">Usuário</Label>
                  <Input
                    id="username"
                    placeholder="portaria"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                    className="h-9"
                  />
                </div>

                <div className="mb-4">
                  <Label htmlFor="password" className="typo-label text-foreground">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    className="h-9"
                  />
                </div>

                <div className="mb-4 flex items-center gap-2">
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                  />
                  <Label htmlFor="remember-me" className="cursor-pointer typo-caption text-foreground">
                    Lembrar de mim
                  </Label>
                </div>

                {error ? (
                  <div className="state-danger-soft mb-4 rounded-md border p-3 typo-body font-medium">
                    {error}
                  </div>
                ) : null}

                <Button
                  type="submit"
                  className="mt-6 h-11 w-full typo-body font-semibold text-white bg-[var(--color-brand-purple)] hover:bg-[var(--color-brand-purple-dark)]"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
