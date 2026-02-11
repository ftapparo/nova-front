import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("portaria");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    const result = login(username, password);
    setLoading(false);

    if (result.success) {
      navigate("/dashboard", { replace: true });
    } else {
      setError(result.error || "Erro desconhecido");
    }
  };

  return (
    <div className="relative isolate min-h-screen overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img
          src="/background-nova-residence.png"
          alt=""
          aria-hidden="true"
          className="h-full w-full scale-[1.2] object-cover blur-[10px]"
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/35 via-primary/10 to-primary-dark/45" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="w-full min-h-[540px] rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto mb-4 mt-3 flex items-center justify-center">
                <img
                  src="/logo-nova-residence.png"
                  alt="Nova Residence"
                  className="h-20 w-auto max-w-[400px] object-contain"
                />
              </div>
              <p className="mb-0 text-lg font-bold text-primary">Portal Administrativo</p>
              <p className="text-xs text-muted-foreground">Portaria e Zeladoria</p>
            </div>

            <div className="mt-3 rounded-xl bg-card p-6">
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <Label htmlFor="username" className="text-foreground">Usuario</Label>
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
                  <Label htmlFor="password" className="text-foreground">Senha</Label>
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

                {error ? (
                  <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive">
                    {error}
                  </div>
                ) : null}

                <Button type="submit" className="mt-6 h-11 w-full text-sm font-semibold" disabled={loading}>
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
