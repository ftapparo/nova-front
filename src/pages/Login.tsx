import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
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
  const submitTopGapPx = 24;

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
          className="h-full w-full object-cover"
          style={{
            filter: "blur(10px)",
            transform: "scale(1.2)",
          }}
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#040008]/70 via-[#0a0115]/25 to-[#080113]/75" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div className="mx-auto w-full" style={{ width: "min(420px, calc(100vw - 2rem))" }}>
          <div className="w-full min-h-[540px] rounded-2xl border border-[#E3E6ED] bg-white p-6 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto mb-4 mt-3 flex items-center justify-center">
                <img
                  src="/logo-nova-residence.png"
                  alt="Nova Residence"
                  style={{
                    height: "80px",
                    width: "auto",
                    maxWidth: "400px",
                    objectFit: "contain",
                  }}
                />
              </div>
              <p className="mb-0 text-lg font-bold text-[#381569]">Portal Administrativo</p>
              <p className="text-xs text-[#6B7280]">Portaria e Zeladoria</p>
            </div>

            <div className="mt-3 rounded-xl bg-white p-6">
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <Label htmlFor="username" className="text-[#1F2933]">Usuário</Label>
                  <Input
                    id="username"
                    placeholder="portaria"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>

                <div className="mb-4">
                  <Label htmlFor="password" className="text-[#1F2933]">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>

                {error ? (
                  <div className="mb-4 rounded-md bg-red-50 p-3 text-sm font-medium text-red-700">
                    {error}
                  </div>
                ) : null}

                <Button
                  type="submit"
                  className="h-11 w-full text-sm font-semibold"
                  style={{ marginTop: submitTopGapPx }}
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

