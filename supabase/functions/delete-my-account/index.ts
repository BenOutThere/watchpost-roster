import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/**
 * A guard deletes their own account from the phone portal (app store requirement).
 * Refused while they are signed on to a shift. Deletes the login, location data, group memberships, profile and access,
 * and blanks the guard's contact/licence details. The guard row (name, employee ID) stays, suspended, because past
 * sign-ons reference it for reconciliation and pay. Staff accounts are removed by delete-user instead.
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
    const userId = who.user.id;
    const admin = createClient(url, serviceKey);

    const { data: guard } = await admin.from("guards").select("id").eq("user_id", userId).maybeSingle();
    if (!guard) return json({ error: "Only guard accounts can be deleted here. Staff accounts are removed by an administrator." }, 400);

    const { data: open } = await admin.from("attendance").select("id").eq("guard_id", guard.id).is("signed_off_at", null).limit(1);
    if (open && open.length > 0) return json({ error: "You're signed on to a shift. You can delete your account once you've been signed off." }, 409);

    // Remove the login first; if that fails nothing else changes.
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr && !/not found/i.test(delErr.message)) return json({ error: delErr.message }, 400);

    const steps = await Promise.all([
      admin.from("guard_latest_locations").delete().eq("guard_id", guard.id),
      admin.from("guard_tracking_sessions").delete().eq("guard_id", guard.id),
      admin.from("guard_location_consents").delete().eq("guard_id", guard.id),
      admin.from("guard_group_members").delete().eq("guard_id", guard.id),
      admin.from("guards").update({ phone: "", email: "", licence_number: "", emergency_contact: "", profile_photo: null, status: "suspended" }).eq("id", guard.id),
      admin.from("contractor_members").delete().eq("user_id", userId),
      admin.from("user_permissions").delete().eq("user_id", userId),
      admin.from("user_roles").delete().eq("user_id", userId),
      admin.from("profiles").delete().eq("user_id", userId),
    ]);
    const failed = steps.find((r) => r.error);
    if (failed?.error) throw failed.error;

    return json({ deleted: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Something went wrong" }, 500);
  }
});
