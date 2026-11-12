import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useOps, useSecurityView } from "./OpsContext";
import { Drawer, Field, Page, Panel, Row, Table, Tabs, useFlash } from "./ui";
import { Copy, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PERMISSIONS, SECURITY_USER_TYPES, USER_TYPES, addableUserTypes, canRemoveUser, userTypeOf } from "@/lib/roster";
import { cn } from "@/lib/utils";
import { shareableOrigin } from "@/lib/publicUrl";
import { SmsIntegration } from "./SmsSettings";

export function SettingsPage() {
  const { can } = useOps();
  const securityView = useSecurityView();
  const [tab, setTab] = useState<"event" | "contractors" | "users">("event");
  // In the Security Manager view the only thing on Settings is adding provider users.
  if (securityView || !can("view_settings")) return <Page><Users /></Page>;
  return (
    <Page>
      <Tabs tabs={[{ id: "event", label: "Events" }, { id: "contractors", label: "Contractors" }, { id: "users", label: "Users & roles" }]} value={tab} onChange={setTab} />
      {tab === "event" && <Events />}
      {tab === "contractors" && <Contractors />}
      {tab === "users" && <Users />}
    </Page>
  );
}

const zones = ["Australia/Sydney", "Australia/Melbourne", "Australia/Brisbane", "Australia/Adelaide", "Australia/Perth", "Australia/Hobart", "Australia/Darwin", "Pacific/Auckland", "Europe/London", "UTC"];

function Events() {
  const { events, event, setEventId, reload, isManager, can } = useOps();
  const [f, setF] = useState<Record<string, any>>({});
  const flash = useFlash();
  useEffect(() => { if (event) setF({ ...event }); }, [event]);

  const save = async () => {
    const payload = { name: f.name, venue: f.venue ?? "", timezone: f.timezone, event_date: f.event_date || null, gps_required: !!f.gps_required, venue_lat: f.venue_lat ? Number(f.venue_lat) : null, venue_lng: f.venue_lng ? Number(f.venue_lng) : null, venue_radius_m: Number(f.venue_radius_m || 500) };
    const { error } = event && f.id ? await supabase.from("events").update(payload).eq("id", f.id) : await supabase.from("events").insert(payload);
    if (error) flash.show(errMsg(error), true); else { flash.show("Saved."); reload(); }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
      <Panel title="Events" actions={isManager && <button className="secondary-button h-9" onClick={() => setF({ timezone: "Australia/Sydney", venue_radius_m: 500 })}>New event</button>}>
        <div className="space-y-2">
          {events.map((e) => (
            <button key={e.id} onClick={() => setEventId(e.id)} className={`w-full rounded-md border p-3 text-left ${event?.id === e.id ? "border-primary" : "border-border"}`}>
              <p className="font-semibold">{e.name}</p><p className="text-xs text-muted-foreground">{e.venue} · {e.timezone}</p>
            </button>
          ))}
        </div>
      </Panel>
      <div className="space-y-5">
      <Panel title={f.id ? "Event settings" : "New event"}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Event name"><input className="control-input h-11" value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Venue"><input className="control-input h-11" value={f.venue ?? ""} onChange={(e) => setF({ ...f, venue: e.target.value })} /></Field>
          <Field label="Date"><input type="date" className="control-input h-11" value={f.event_date ?? ""} onChange={(e) => setF({ ...f, event_date: e.target.value })} /></Field>
          <Field label="Time zone"><select className="control-input h-11" value={f.timezone ?? "Australia/Sydney"} onChange={(e) => setF({ ...f, timezone: e.target.value })}>{zones.map((z) => <option key={z}>{z}</option>)}</select></Field>
        </div>
        {/* The location check only applied to guards signing themselves on from their phone; all sign-ons now happen at the Sign-in desk. */}
        {isManager && <button className="primary-button mt-4 h-11" onClick={save}>Save</button>}
        <div className="mt-3">{flash.node}</div>
      </Panel>
      {f.id && event?.id === f.id && can("manage_sms") && <SmsIntegration eventId={f.id} eventName={f.name ?? event.name} />}
      </div>
    </div>
  );
}

function Contractors() {
  const { contractors, reload, isManager, guards } = useOps();
  const [f, setF] = useState<Record<string, string>>({});
  const flash = useFlash();
  const add = async () => {
    if (!f.name) return flash.show("Name required.", true);
    const { error } = await supabase.from("contractors").insert({ name: f.name, contact_name: f.contact || null, phone: f.phone || null, email: f.email || null });
    if (error) flash.show(errMsg(error), true); else { setF({}); flash.show("Contractor added."); reload(); }
  };
  return (
    <Panel title="Security contractors">
      <Table head={["Name", "Contact", "Phone", "Email", "Guards"]} empty={contractors.length === 0}>
        {contractors.map((c) => <tr key={c.id}><td className="px-3 py-2 font-semibold">{c.name}</td><td className="px-3 py-2">{c.contact_name}</td><td className="px-3 py-2">{c.phone}</td><td className="px-3 py-2">{c.email}</td><td className="px-3 py-2 tabular-nums">{guards.filter((g) => g.contractor_id === c.id).length}</td></tr>)}
      </Table>
      {isManager && (
        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          {(["name", "contact", "phone", "email"] as const).map((k) => <input key={k} className="control-input h-10" placeholder={k[0].toUpperCase() + k.slice(1)} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} />)}
          <button className="primary-button h-10" onClick={add}>Add</button>
        </div>
      )}
      <div className="mt-3">{flash.node}</div>
    </Panel>
  );
}

type Profile = { user_id: string; full_name: string; email: string; phone: string | null };

/** Staff mobile, used for automatic variation alerts (acknowledgement / approval needed). */
function MobileCell({ userId, phone, canEdit, onSaved }: { userId: string; phone: string | null; canEdit: boolean; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(phone ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("set_user_mobile", { _user_id: userId, _phone: value });
    setBusy(false);
    if (error) return setErr(errMsg(error));
    await onSaved(); setEditing(false);
  };
  if (editing) return (
    <div className="flex min-w-[220px] flex-col gap-1">
      <div className="flex gap-1">
        <input className="control-input h-8 w-36 text-sm" value={value} maxLength={20} placeholder="0412 345 678" autoFocus onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }} />
        <button className="primary-button h-8 px-3 text-xs" disabled={busy} onClick={save}>{busy ? "…" : "Save"}</button>
        <button className="secondary-button h-8 px-2 text-xs" onClick={() => { setEditing(false); setValue(phone ?? ""); setErr(null); }}>Cancel</button>
      </div>
      {err && <p className="text-xs text-danger">{err}</p>}
    </div>
  );
  return (
    <div className="flex items-center gap-2">
      {phone ? <span className="tabular-nums">{phone}</span> : <span className="text-muted-foreground">No mobile</span>}
      {canEdit && <button className="text-xs font-semibold text-primary underline-offset-2 hover:underline" onClick={() => setEditing(true)}>{phone ? "Edit" : "Add"}</button>}
    </div>
  );
}
const legacyLabels: Record<string, string> = { operations_manager: "Operations Manager (old)", site_supervisor: "Supervisor (old)", contractor_manager: "Contractor Manager (old)", security_guard: "Security Guard" };
const labelOf = (role: string) => userTypeOf(role)?.label ?? legacyLabels[role] ?? role;
const permissionHelp: Record<string, string> = {
  view_dashboard: "Live staffing numbers and missing positions",
  view_roster: "The current approved roster and its history",
  view_costs: "Hourly rates, shift costs and variation cost impact",
  view_variations: "The variation register and request details",
  view_guards: "The guard directory",
  view_sign_in: "The Sign-in desk page",
  view_communications: "Messages to guards and message history",
  view_locations: "Live Map of signed-on guards who share their phone location",
  view_settings: "Events, contractors and users",
  request_variations: "Raise new variation requests",
  acknowledge_variations: "Acknowledge requests for their security provider",
  approve_variations: "Give final approval so the roster updates",
  sign_on_guards: "Scan or look up guards and sign them on to a position",
};


type RolePerm = { role: string; permission: string };

function newPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function TypeSelect({ value, onChange, allowed }: { value: string; onChange: (v: string) => void; allowed?: string[] }) {
  const list = USER_TYPES.filter((t) => !allowed || allowed.includes(t.role));
  const event = list.filter((t) => !t.security);
  const security = list.filter((t) => t.security);
  return (
    <select className="control-input h-11 w-full py-0" value={value} onChange={(e) => onChange(e.target.value)}>
      {event.length > 0 && <optgroup label="Event">{event.map((t) => <option key={t.role} value={t.role}>{t.label}</option>)}</optgroup>}
      {security.length > 0 && <optgroup label="Contracted security provider">{security.map((t) => <option key={t.role} value={t.role}>{t.label}</option>)}</optgroup>}
    </select>
  );
}

function Users() {
  const { contractors, roles: myRoles, permissions, session, myContractorIds } = useOps();
  const securityView = useSecurityView();
  const isSuper = myRoles.includes("super_admin");
  const addable = addableUserTypes(myRoles, permissions, securityView);
  // Real security provider users can only add to their own provider; a Super Admin previewing can pick any.
  const providerOptions = isSuper ? contractors : contractors.filter((c) => myContractorIds.includes(c.id));
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<{ user_id: string; role: string }[]>([]);
  const [members, setMembers] = useState<{ id: string; user_id: string; contractor_id: string }[]>([]);
  const [rolePerms, setRolePerms] = useState<RolePerm[]>([]);
  const [editing, setEditing] = useState<string | "new" | null>(null);

  const load = async () => {
    const [p, r, m, rp] = await Promise.all([
      supabase.from("profiles").select("user_id,full_name,email,phone"),
      supabase.from("user_roles").select("user_id,role"),
      supabase.from("contractor_members").select("id,user_id,contractor_id"),
      supabase.from("role_permissions").select("role,permission"),
    ]);
    setProfiles((p.data ?? []) as Profile[]); setRoles((r.data ?? []) as any); setMembers((m.data ?? []) as any); setRolePerms((rp.data ?? []) as any);
  };
  useEffect(() => { load(); }, []);

  const userType = (id: string) => roles.find((r) => r.user_id === id && r.role !== "security_guard")?.role ?? "";
  const userIds = [...new Set([...profiles.map((p) => p.user_id), ...roles.filter((r) => r.role !== "security_guard").map((r) => r.user_id)])]
    .filter((id) => userType(id) || !roles.some((r) => r.user_id === id && r.role === "security_guard"))
    .filter((id) => !securityView || SECURITY_USER_TYPES.includes(userType(id)));
  const nameOf = (id: string) => { const p = profiles.find((x) => x.user_id === id); return p ? `${p.full_name || p.email}` : id.slice(0, 8); };
  const emailOf = (id: string) => profiles.find((x) => x.user_id === id)?.email ?? "";
  const phoneOf = (id: string) => profiles.find((x) => x.user_id === id)?.phone ?? null;
  const canEditMobile = (id: string) => isSuper || id === session?.user.id || permissions.includes("add_provider_users");
  const providerOf = (id: string) => members.filter((m) => m.user_id === id).map((m) => contractors.find((c) => c.id === m.contractor_id)?.name).join(", ") || "—";
  const canChangeType = isSuper && !securityView;
  const canRemove = (id: string) => canRemoveUser({
    actorId: session?.user.id ?? "", actorRoles: myRoles, actorPermissions: permissions, actorContractorIds: myContractorIds, securityView,
    targetId: id, targetRole: userType(id), targetContractorIds: members.filter((m) => m.user_id === id).map((m) => m.contractor_id),
  });
  const showActions = canChangeType || userIds.some(canRemove);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const flash = useFlash();
  const removeUser = async () => {
    if (!removing) return;
    const name = nameOf(removing);
    setRemoveBusy(true); flash.clear();
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", { body: { user_id: removing } });
      if (error) {
        const ctx = (error as any).context;
        const body = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
        throw new Error(body?.error ?? error.message);
      }
      if (data?.error) throw new Error(data.error);
      setRemoving(null);
      flash.show(`${name} has been removed and can no longer sign in.`);
      await load();
    } catch (e) { setRemoving(null); flash.show(errMsg(e), true); }
    setRemoveBusy(false);
  };

  return (
    <div className="grid gap-5">
      <Panel
        title="Users"
        description={securityView
          ? "Add people from your security provider. You can add Security Managers, Security Zone Managers and Security Sign In users. What each type can do is set by a Super Admin."
          : "Each person has one user type. Their access comes from that type, set below. Security user types belong to a contracted security provider and only see that provider's shifts and guards."}
        actions={addable.length > 0 && <button className="primary-button h-10 px-4" onClick={() => setEditing("new")}><UserPlus className="mr-2 h-4 w-4" />Add user</button>}
      >
        <p className="mb-3 text-xs text-muted-foreground">Mobile numbers are used to text people automatically when a variation needs their acknowledgement or approval.</p>
        <div className="mb-3">{flash.node}</div>
        <Table head={showActions ? ["User", "User type", "Security provider", "Mobile", ""] : ["User", "User type", "Security provider", "Mobile"]} empty={userIds.length === 0}>
          {userIds.map((id) => (
            <tr key={id}>
              <td className="px-3 py-2"><p className="font-semibold">{nameOf(id)}</p><p className="text-xs text-muted-foreground">{emailOf(id)}</p></td>
              <td className="px-3 py-2">{userType(id) ? labelOf(userType(id)) : <span className="text-muted-foreground">No access yet</span>}</td>
              <td className="px-3 py-2">{providerOf(id)}</td>
              <td className="px-3 py-2"><MobileCell key={`${id}-${phoneOf(id) ?? ""}`} userId={id} phone={phoneOf(id)} canEdit={canEditMobile(id)} onSaved={load} /></td>
              {showActions && (
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    {canChangeType && <button className="secondary-button h-8 px-3 text-xs" onClick={() => setEditing(id)}>Change type</button>}
                    {canRemove(id) && <button className="secondary-button h-8 px-3 text-xs text-danger hover:border-danger" onClick={() => setRemoving(id)} aria-label={`Remove ${nameOf(id)}`}><Trash2 className="mr-1 h-3.5 w-3.5" />Remove</button>}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </Table>
      </Panel>

      <AlertDialog open={removing !== null} onOpenChange={(o) => { if (!o && !removeBusy) setRemoving(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing ? nameOf(removing) : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing && emailOf(removing) && <span className="mb-2 block font-semibold text-foreground">{emailOf(removing)}{userType(removing) ? ` · ${labelOf(userType(removing))}` : ""}</span>}
              Their login is deleted straight away and they can no longer sign in or receive alerts. Their name stays on past variations, sign-ons and messages. This can't be undone — to give them access again, add them as a new user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeBusy}>Cancel</AlertDialogCancel>
            <button className="inline-flex h-10 items-center justify-center rounded-md bg-destructive px-4 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60" disabled={removeBusy} onClick={removeUser}>{removeBusy ? "Removing…" : "Remove user"}</button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!securityView && <AccessByType isSuper={isSuper} rolePerms={rolePerms} roles={roles} onSaved={load} />}

      {editing && (
        <UserDrawer
          key={editing}
          userId={editing === "new" ? null : editing}
          name={editing === "new" ? "" : nameOf(editing)}
          currentType={editing === "new" ? "" : userType(editing)}
          currentProvider={editing === "new" ? (providerOptions.length === 1 ? providerOptions[0].id : "") : members.find((m) => m.user_id === editing)?.contractor_id ?? ""}
          existingRoles={editing === "new" ? [] : roles.filter((r) => r.user_id === editing).map((r) => r.role)}
          isSelf={editing === session?.user.id}
          contractors={editing === "new" ? providerOptions : contractors}
          allowedTypes={editing === "new" ? addable : undefined}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

function UserDrawer({ userId, name, currentType, currentProvider, existingRoles, isSelf, contractors, allowedTypes, onClose, onSaved }: {
  userId: string | null; name: string; currentType: string; currentProvider: string; existingRoles: string[]; isSelf: boolean;
  contractors: { id: string; name: string }[]; allowedTypes?: string[]; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const adding = userId === null;
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState(newPassword);
  const [invite, setInvite] = useState(true);
  const [type, setType] = useState(currentType && userTypeOf(currentType) ? currentType : allowedTypes?.includes("security_manager") !== false ? "security_manager" : allowedTypes[0]);
  const [provider, setProvider] = useState(currentProvider);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ email: string; password: string; invited: boolean } | null>(null);
  const flash = useFlash();
  const def = userTypeOf(type)!;

  const submit = async () => {
    flash.clear();
    if (def.security && !provider) return flash.show("Choose the security provider this person works for.", true);
    setBusy(true);
    try {
      if (adding) {
        if (!fullName.trim()) throw new Error("Enter the person's name.");
        if (!email.trim()) throw new Error("Enter their email address.");
        const { data, error } = await supabase.functions.invoke("create-user", {
          body: { full_name: fullName.trim(), email: email.trim(), mobile: mobile.trim(), invite, password: invite ? "" : password, redirect_to: `${shareableOrigin()}/set-password`, user_type: type, contractor_id: def.security ? provider : null },
        });
        if (error) {
          const ctx = (error as any).context;
          const body = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
          throw new Error(body?.error ?? error.message);
        }
        if (data?.error) throw new Error(data.error);
        setDone({ email: email.trim().toLowerCase(), password, invited: invite });
      } else {
        if (isSelf && type !== "super_admin") throw new Error("You can't remove your own Super Admin access. Ask another Super Admin to do it.");
        const remove = existingRoles.filter((r) => r !== "security_guard" && r !== type);
        if (remove.length) { const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).in("role", remove as any); if (error) throw error; }
        { const { error } = await supabase.from("user_roles").upsert({ user_id: userId, role: type as any }, { onConflict: "user_id,role" }); if (error) throw error; }
        { const { error } = await supabase.from("contractor_members").delete().eq("user_id", userId); if (error) throw error; }
        if (def.security) { const { error } = await supabase.from("contractor_members").insert({ user_id: userId, contractor_id: provider }); if (error) throw error; }
        await onSaved();
        onClose();
        return;
      }
      await onSaved();
    } catch (e) { flash.show(errMsg(e), true); }
    setBusy(false);
  };

  return (
    <Drawer open onClose={onClose} title={adding ? "Add user" : `Change user type — ${name}`}>
      {done?.invited ? (
        <div className="space-y-4">
          <p className="rounded-md bg-success/15 p-3 text-sm text-success">Invitation sent to {done.email}. They'll get an email with a link to create their own password, then they can sign in as {def.label}.</p>
          <p className="text-xs text-muted-foreground">No email? Ask them to check their spam folder. The link works once — if it expires, remove them and add them again, or use a temporary password instead.</p>
          <button className="primary-button h-11 px-6" onClick={onClose}>Done</button>
        </div>
      ) : done ? (
        <div className="space-y-4">
          <p className="rounded-md bg-success/15 p-3 text-sm text-success">Account created. They can sign in straight away with these details:</p>
          <div className="rounded-md border border-border p-4 text-sm">
            <Row label="Email" value={done.email} />
            <Row label="Temporary password" value={<span className="font-mono">{done.password}</span>} />
            <Row label="User type" value={def.label} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="secondary-button h-11 px-4" onClick={() => navigator.clipboard?.writeText(`Sign in at ${shareableOrigin()}\nEmail: ${done.email}\nTemporary password: ${done.password}`)}><Copy className="mr-2 h-4 w-4" />Copy login details</button>
            <button className="primary-button h-11 px-6" onClick={onClose}>Done</button>
          </div>
          <p className="text-xs text-muted-foreground">Send these to the person yourself. Ask them to keep the password private.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {adding && (
            <>
              <Field label="Full name"><input className="control-input h-11 w-full" value={fullName} maxLength={120} onChange={(e) => setFullName(e.target.value)} /></Field>
              <Field label="Email"><input type="email" className="control-input h-11 w-full" value={email} maxLength={255} onChange={(e) => setEmail(e.target.value)} /></Field>
              <Field label="Mobile (optional)" hint="Used to text them when a variation needs their acknowledgement or approval."><input type="tel" className="control-input h-11 w-full" value={mobile} maxLength={20} placeholder="0412 345 678" onChange={(e) => setMobile(e.target.value)} /></Field>
              <Field label="How should they get in?">
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className={cn("h-11 rounded-md border px-3 text-sm", invite ? "border-primary bg-primary/15 font-semibold" : "border-border")} onClick={() => setInvite(true)}>Email invitation</button>
                  <button type="button" className={cn("h-11 rounded-md border px-3 text-sm", !invite ? "border-primary bg-primary/15 font-semibold" : "border-border")} onClick={() => setInvite(false)}>Temporary password</button>
                </div>
              </Field>
              {invite ? <p className="text-xs text-muted-foreground">They'll be emailed a link to create their own password.</p> : (
              <Field label="Temporary password" hint="They'll use this to sign in. At least 8 characters.">
                <div className="flex gap-2">
                  <input className="control-input h-11 w-full font-mono" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" className="secondary-button h-11 whitespace-nowrap px-3" onClick={() => setPassword(newPassword())}><RefreshCw className="mr-2 h-4 w-4" />New</button>
                </div>
              </Field>)}
            </>
          )}
          <Field label="User type" hint={allowedTypes && allowedTypes.length < USER_TYPES.length ? "You can add security provider user types only. Their access comes from the user type." : "Their access comes from this user type. Change what each type can do under Access by user type."}><TypeSelect value={type} onChange={setType} allowed={allowedTypes} /></Field>
          {def.security && (
            <Field label="Security provider"><select className="control-input h-11 w-full py-0" value={provider} onChange={(e) => setProvider(e.target.value)}><option value="">Choose provider…</option>{contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          )}
          {flash.node}
          <button className="primary-button h-11 w-full" disabled={busy} onClick={submit}>{busy ? "Saving…" : adding ? (invite ? "Send invitation" : "Add user") : "Save user type"}</button>
        </div>
      )}
    </Drawer>
  );
}

function AccessByType({ isSuper, rolePerms, roles, onSaved }: { isSuper: boolean; rolePerms: RolePerm[]; roles: { user_id: string; role: string }[]; onSaved: () => Promise<void> }) {
  const [type, setType] = useState("security_manager");
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const flash = useFlash();
  const def = userTypeOf(type)!;
  const isSuperType = type === "super_admin";

  useEffect(() => { setTicked(new Set(rolePerms.filter((x) => x.role === type).map((x) => x.permission))); }, [type, rolePerms]);
  const toggle = (k: string) => setTicked((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const people = new Set(roles.filter((r) => r.role === type).map((r) => r.user_id)).size;
  const saved = new Set(rolePerms.filter((x) => x.role === type).map((x) => x.permission));
  const changed = !isSuperType && (saved.size !== ticked.size || [...ticked].some((k) => !saved.has(k)));

  const save = async () => {
    setBusy(true); flash.clear();
    try {
      { const { error } = await supabase.from("role_permissions").delete().eq("role", type as any); if (error) throw error; }
      const rows = [...ticked].map((permission) => ({ role: type as any, permission }));
      if (rows.length) { const { error } = await supabase.from("role_permissions").insert(rows); if (error) throw error; }
      await onSaved();
      flash.show(`Access saved for every ${def.label}. They'll see the change next time they refresh.`);
    } catch (e) { flash.show(errMsg(e), true); }
    setBusy(false);
  };

  return (
    <Panel title="Access by user type" description="Choose a user type and tick what it can see and do. Everyone with that user type gets this access.">
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="User type"><TypeSelect value={type} onChange={(v) => { setType(v); flash.clear(); }} /></Field>
          <div className="flex items-end pb-2 text-sm text-muted-foreground md:col-span-2">
            {people} {people === 1 ? "person has" : "people have"} this user type.{def.security ? " Security types only see their own provider's shifts and guards." : ""}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {(["view", "do"] as const).map((g) => {
            const list = PERMISSIONS.filter((p) => p.group === g);
            const on = isSuperType ? list.length : list.filter((p) => ticked.has(p.key)).length;
            return (
              <fieldset key={g} className="rounded-md border border-border p-4">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <legend className="text-sm font-bold">{g === "view" ? "Can view" : "Can do"}</legend>
                  <span className="text-xs tabular-nums text-muted-foreground">{on} of {list.length} ticked</span>
                </div>
                <div className="space-y-2">
                  {list.map((p) => {
                    const checked = isSuperType || ticked.has(p.key);
                    const locked = isSuperType || !isSuper;
                    return (
                      <label key={p.key} className={cn("flex items-start gap-3 rounded-md border px-3 py-2.5 transition-colors", checked ? "border-primary/50 bg-primary/5" : "border-border", locked ? "cursor-default" : "cursor-pointer hover:bg-secondary/40")}>
                        <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-primary" disabled={locked} checked={checked} onChange={() => toggle(p.key)} />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{p.label}</span>
                          {permissionHelp[p.key] && <span className="block text-xs text-muted-foreground">{permissionHelp[p.key]}</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground sm:max-w-[60%]">
            {isSuperType ? "Super Admins always have full access, including uploading rosters and managing users." : !isSuper ? "Only a Super Admin can change access." : "Only Super Admins can upload rosters or manage users."}
          </p>
          {isSuper && !isSuperType && (
            <div className="flex gap-2">
              <button className="secondary-button h-11 whitespace-nowrap px-4" onClick={() => setTicked(new Set(def.defaults))}>Reset to usual access</button>
              <button className="primary-button h-11 whitespace-nowrap px-6" disabled={busy || !changed} onClick={save}>{busy ? "Saving…" : "Save access"}</button>
            </div>
          )}
        </div>
        {flash.node}
      </div>
    </Panel>
  );
}
