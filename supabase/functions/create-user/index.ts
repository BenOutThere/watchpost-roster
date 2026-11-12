import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const USER_TYPES = ["super_admin", "senior_management", "event_manager", "event_control_assistant", "security_manager", "security_zone_manager", "security_sign_in"];
const SECURITY_TYPES = ["security_manager", "security_zone_manager", "security_sign_in"];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const LIVE_HOST = "security.outthereadmin.com.au";
const DEFAULT_REDIRECT = `https://${LIVE_HOST}/set-password`;
function liveRedirect(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_REDIRECT;
  try {
    const u = new URL(raw.slice(0, 500));
    return u.protocol === "https:" && u.hostname === LIVE_HOST ? u.toString() : DEFAULT_REDIRECT;
  } catch {
    return DEFAULT_REDIRECT;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Please sign in again." }, 401);

    // Who is asking? A Super Admin may add any user type. Anyone ticked "Add security provider users"
    // (Security Managers by default) may only add security provider user types for their own provider.
    const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: who, error: whoErr } = await asCaller.auth.getUser(authHeader.slice(7));
    if (whoErr || !who.user) return json({ error: "Please sign in again." }, 401);
    const admin = createClient(url, serviceKey);
    const { data: isSuper } = await admin.rpc("has_role", { _user_id: who.user.id, _role: "super_admin" });
    const { data: canAddProvider } = isSuper ? { data: true } : await admin.rpc("has_permission", { _user_id: who.user.id, _permission: "add_provider_users" });
    if (!isSuper && !canAddProvider) return json({ error: "You don't have permission to add users." }, 403);

    const body = await req.json().catch(() => ({}));
    const fullName = String(body.full_name ?? "").trim().slice(0, 120);
    const email = String(body.email ?? "").trim().toLowerCase();
    const mobile = String(body.mobile ?? "").trim().slice(0, 20);
    if (mobile && !/^\+?[0-9 ()-]{8,20}$/.test(mobile)) return json({ error: "Enter a valid mobile number, e.g. 0412 345 678" }, 400);
    const invite = body.invite === true;
    const password = String(body.password ?? "");
    // Invite links must land on the live app, never the private editor preview.
    const redirectTo = liveRedirect(body.redirect_to);
    const userType = String(body.user_type ?? "");
    const contractorId = body.contractor_id ? String(body.contractor_id) : null;

    if (!fullName) return json({ error: "Enter the person's name." }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) return json({ error: "Enter a valid email address." }, 400);
    if (!invite && password.length < 8) return json({ error: "The temporary password must be at least 8 characters." }, 400);
    if (!USER_TYPES.includes(userType)) return json({ error: "Choose a user type." }, 400);
    if (SECURITY_TYPES.includes(userType) && !contractorId) return json({ error: "Choose the security provider this person works for." }, 400);
    if (!isSuper) {
      if (!SECURITY_TYPES.includes(userType)) return json({ error: "You can only add Security Manager, Security Zone Manager or Security Sign In users." }, 403);
      const { data: member } = await admin.rpc("is_contractor_member", { _user_id: who.user.id, _contractor_id: contractorId });
      if (!member) return json({ error: "You can only add people to your own security provider." }, 403);
    }

    // Invite: the person gets an email with a link to set their own password.
    const { data: created, error: createErr } = invite
      ? await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName }, redirectTo })
      : await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
    if (createErr || !created.user) {
      const msg = createErr?.message ?? "Could not create the account.";
      return json({ error: /already/i.test(msg) ? "Someone with that email already has an account." : msg }, 400);
    }
    const uid = created.user.id;

    const { error: roleErr } = await admin.from("user_roles").insert({ user_id: uid, role: userType });
    if (roleErr) throw roleErr;
    if (SECURITY_TYPES.includes(userType)) {
      const { error } = await admin.from("contractor_members").insert({ user_id: uid, contractor_id: contractorId });
      if (error) throw error;
    }
    // Profile normally comes from the sign-up trigger; make sure the name is set.
    await admin.from("profiles").upsert({ user_id: uid, full_name: fullName, email, phone: mobile || null }, { onConflict: "user_id" });

    return json({ user_id: uid });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Something went wrong" }, 500);
  }
});
