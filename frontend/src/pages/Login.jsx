import { Spinner, LoadingOverlay } from "@/components/admin/loader";

import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminLogin } from "@/lib/admin.functions";

function LoginPage() {
  const navigate = useNavigate();

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    document.title = "Kirish — GunAydin Admin";
  }, []);

  const [submitting, setSubmitting] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const res = await adminLogin({
      data: { login, password },
    }).catch(() => ({ ok: false }));
    setSubmitting(false);

    if (res.ok && res.token) {
      // Faqat sessiya tokeni saqlanadi; login/parol bazada turadi.
      localStorage.setItem("eb-admin-auth", JSON.stringify({ token: res.token }));

      toast.success("Xush kelibsiz!");
      navigate("/", { replace: true });
    } else {
      toast.error("Login yoki parol noto'g'ri");
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-6">
      <LoadingOverlay active={submitting} text="Kirilmoqda…" />
      <form
        onSubmit={submit}
        className="panel w-full max-w-sm space-y-5 p-5 sm:p-8"
      >
        <div className="text-center">
          <div className="flex items-center justify-center gap-3">
            <img
              src="/gunaydin-logo.jpg"
              alt="GünAydın Turkish Food"
              className="size-14 shrink-0 rounded-md object-cover"
            />

            <h1 className="font-brand text-5xl leading-tight text-primary">
              GünAydın
            </h1>
          </div>

          <p className="mt-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Admin
          </p>

          <p className="text-sm text-muted-foreground">
            Panelga kirish
          </p>
        </div>

        {/* Login */}
        <div className="space-y-2">
          <Label htmlFor="login">Login</Label>

          <Input
            id="login"
            type="text"
            placeholder="Loginingizni kiriting"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
            required
          />
        </div>

        {/* Parol va ko'zcha */}
        <div className="space-y-2">
          <Label htmlFor="password">Parol</Label>

          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Parolingizni kiriting"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="pr-11"
              required
            />

            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-0 top-0 flex h-full items-center justify-center px-3 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
              title={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
            >
              {showPassword ? (
                <EyeOff className="size-5" />
              ) : (
                <Eye className="size-5" />
              )}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? <><Spinner />Kirilmoqda…</> : "Kirish"}
        </Button>
      </form>
    </div>
  );
}

export default LoginPage;
