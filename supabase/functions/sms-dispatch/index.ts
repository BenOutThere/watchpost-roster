// Sends queued automatic texts (variation alerts). Called by the database when texts are queued. Takes no
// input: it only sends messages the database queued, each through its own event's Tall Bob account.
import { createClient } from "npm:@supabase/supabase-js@2";
import { deliverMessage } from "../_shared/tallbob.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async () => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: ids, error } = await admin.rpc("claim_sms_messages", { _limit: 20 });
  if (error) return json({ error: error.message }, 500);
  const results: Record<string, string> = {};
  for (const id of (ids ?? []) as string[]) {
    try {
      const r = await deliverMessage(admin, id);
      results[id] = r.status;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin.from("sms_messages").update({ status: "failed", error: `Sending stopped unexpectedly: ${msg}`.slice(0, 500) }).eq("id", id);
      results[id] = "failed";
    }
  }
  return json({ processed: Object.keys(results).length, results });
});
