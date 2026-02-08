import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    // simulate small delay for UX
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl gradient-header shadow-lg">
            <Building2 className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Nova Residence</h1>
          <p className="text-sm font-medium text-primary">Portal Administrativo</p>
          <p className="text-xs text-muted-foreground">Portaria e Zeladoria</p>
        </div>

        {/* Login card */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                placeholder="portaria"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive font-medium">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
