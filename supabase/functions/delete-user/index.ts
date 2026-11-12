import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SECURITY_TYPES = ["security_manager", "security_zone_manager", "security_sign_in"];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/**
 * Removes a staff user's account. Same rule as canRemoveUser() in src/lib/roster.ts: nobody removes themselves;
 * a Super Admin may remove anyone; "Add security provider users" may only remove security users of their own provider.
 * Past records keep the person's name (stored as text), so history is unaffected.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Please sign in again." }, 401);

    const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: who, error: whoErr } = await asCaller.auth.getUser(authHeader.slice(7));
    if (whoErr || !who.user) return json({ error: "Please sign in again." }, 401);
    const admin = createClient(url, serviceKey);

    const body = await req.json().catch(() => ({}));
    const targetId = String(body.user_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(targetId)) return json({ error: "Choose a user to remove." }, 400);
    if (targetId === who.user.id) return json({ error: "You can't remove your own account." }, 400);

    const { data: isSuper } = await admin.rpc("has_role", { _user_id: who.user.id, _role: "super_admin" });
    const { data: canManage } = isSuper ? { data: true } : await admin.rpc("has_permission", { _user_id: who.user.id, _permission: "add_provider_users" });
    if (!isSuper && !canManage) return json({ error: "You don't have permission to remove users." }, 403);

    const [{ data: targetRoles }, { data: targetMembers }, { data: guardRows }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", targetId),
      admin.from("contractor_members").select("contractor_id").eq("user_id", targetId),
      admin.from("guards").select("id").eq("user_id", targetId).limit(1),
    ]);
    if (guardRows && guardRows.length > 0) return json({ error: "This account belongs to a guard. Guards are managed under Guards, not here." }, 400);
    const roles = (targetRoles ?? []).map((r) => r.role as string);

    if (!isSuper) {
      if (!roles.length || !roles.every((r) => SECURITY_TYPES.includes(r))) return json({ error: "You can only remove Security Manager, Security Zone Manager or Security Sign In users." }, 403);
      const cids = (targetMembers ?? []).map((m) => m.contractor_id as string);
      if (!cids.length) return json({ error: "You can only remove people from your own security provider." }, 403);
      for (const cid of cids) {
        const { data: member } = await admin.rpc("is_contractor_member", { _user_id: who.user.id, _contractor_id: cid });
        if (!member) return json({ error: "You can only remove people from your own security provider." }, 403);
      }
    }

    // Remove the login first; if that fails nothing else changes.
    const { error: delErr } = await admin.auth.admin.deleteUser(targetId);
    if (delErr && !/not found/i.test(delErr.message)) return json({ error: delErr.message }, 400);

    // Then their access and profile. Past variations, sign-ons and messages keep the name they were saved with.
    await admin.from("staff_email_alerts").update({ status: "expired", last_error: "User removed" }).eq("user_id", targetId).in("status", ["pending", "sending"]);
    const cleanup = await Promise.all([
      admin.from("contractor_members").delete().eq("user_id", targetId),
      admin.from("user_permissions").delete().eq("user_id", targetId),
      admin.from("user_roles").delete().eq("user_id", targetId),
      admin.from("profiles").delete().eq("user_id", targetId),
    ]);
    const failed = cleanup.find((r) => r.error);
    if (failed?.error) throw failed.error;

    return json({ removed: targetId });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Something went wrong" }, 500);
  }
});
