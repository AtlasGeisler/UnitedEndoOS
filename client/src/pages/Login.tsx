import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

// The seeded demo accounts, surfaced on the login card so the app is
// explorable on first launch. Synthetic only.
const DEMO_ACCOUNTS = [
  { email: "owner@ue.demo", label: "Practice Owner" },
  { email: "provider@ue.demo", label: "Provider" },
  { email: "manager@ue.demo", label: "Office Manager" },
  { email: "frontdesk@ue.demo", label: "Front Desk" },
  { email: "refdoc@gp.demo", label: "Referring Doctor" },
];

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("provider@ue.demo");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-canvas p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-hairline bg-surface shadow-panel"
      >
        <div className="bg-forest px-7 py-8 text-parchment">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-endo text-lg font-bold text-white">
            UE
          </div>
          <h1 className="font-serif text-2xl font-semibold">UnitedEndoOS</h1>
          <p className="mt-1 text-[13px] text-parchment/70">
            United Endodontics, Twin Cities. Synthetic demo data only.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3 px-7 py-6">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-content-soft">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-hairline bg-[var(--surface-2)] px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-sage"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-content-soft">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-hairline bg-[var(--surface-2)] px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-sage"
            />
          </div>
          {error && <div className="text-[12px] text-urgent">{error}</div>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="border-t border-hairline px-7 py-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-content-soft">
            Demo accounts, password demo1234
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                onClick={() => {
                  setEmail(a.email);
                  setPassword("demo1234");
                }}
                className="rounded-full border border-hairline px-2.5 py-1 text-[11px] text-content-soft hover:border-endo hover:text-endo"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
