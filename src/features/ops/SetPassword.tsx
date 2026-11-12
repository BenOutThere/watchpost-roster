import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/** Landing page for invitation and password-reset links: the person chooses their own password. */
export default function SetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, session) => { if (session) setReady(true); });
    supabase.auth.getSession().then(({ data: s }) => { if (s.session) setReady(true); });
    const t = setTimeout(() => setReady((r) => { if (!r) setError("This link is invalid or has expired. Ask your administrator to send a new invitation."); return r; }), 4000);
    return () => { data.subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  const save = async () => {
    setError("");
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    navigate("/admin", { replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="panel w-full max-w-md space-y-4 p-6">
        <h1 className="text-2xl font-semibold text-foreground">Create your password</h1>
        <p className="text-sm text-muted-foreground">Choose a password you'll use to sign in from now on.</p>
        <input type="password" className="control-input h-11 w-full" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={!ready} />
        <input type="password" className="control-input h-11 w-full" placeholder="Type it again" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={!ready} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="primary-button h-11 w-full" disabled={!ready || busy} onClick={save}>{busy ? "Saving…" : ready ? "Save and continue" : "Checking your link…"}</button>
      </div>
    </main>
  );
}
