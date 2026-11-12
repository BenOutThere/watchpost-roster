import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, useOps } from "./OpsContext";
import { Field, Page, Panel, Table, Tabs, useFlash } from "./ui";
import { GuardPoster } from "./GuardPoster";
import { shareableOrigin } from "@/lib/publicUrl";
import { GUARD_IMPORT_HEADERS, parseGuardRows, type GuardImportRow } from "@/lib/guardImport";

export function GuardsPage() {
  const [tab, setTab] = useState<"directory" | "add" | "groups" | "poster">(() => (new URLSearchParams(window.location.search).get("tab") === "poster" ? "poster" : "directory"));
  return (
    <Page>
      <Tabs tabs={[{ id: "directory", label: "Directory" }, { id: "add", label: "Register guard" }, { id: "groups", label: "SMS groups" }, { id: "poster", label: "Sign-up QR poster" }]} value={tab} onChange={setTab} />
      {tab === "directory" && <Directory />}
      {tab === "add" && <AddGuard />}
      {tab === "groups" && <Groups />}
      {tab === "poster" && <GuardPoster />}
    </Page>
  );
}

function useScopedGuards() {
  const { guards, isManager, myContractorIds } = useOps();
  return useMemo(() => (isManager ? guards : guards.filter((g) => g.contractor_id && myContractorIds.includes(g.contractor_id))), [guards, isManager, myContractorIds]);
}

function Directory() {
  const { contractors, contractorName, attendance, isManager, reload } = useOps();
  const guards = useScopedGuards();
  const [q, setQ] = useState("");
  const [c, setC] = useState("");
  const flash = useFlash();
  // Event staff can correct a guard who picked the wrong provider at sign-up.
  const moveGuard = async (id: string, contractor_id: string) => {
    const { error } = await supabase.from("guards").update({ contractor_id: contractor_id || null }).eq("id", id);
    if (error) flash.show(errMsg(error), true); else { flash.show("Provider updated."); reload(); }
  };
  const onNow = new Set(attendance.filter((a) => !a.signed_off_at).map((a) => a.guard_id));
  const rows = guards.filter((g) => (!c || g.contractor_id === c) && (!q || `${g.name} ${g.employee_id} ${g.phone} ${g.licence_number}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <Panel title={`Guards · ${rows.length}`} actions={
      <>
        <input className="control-input h-10 w-56" placeholder="Search name, ID, phone…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="control-input h-10 w-auto" value={c} onChange={(e) => setC(e.target.value)}><option value="">All contractors</option>{contractors.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      </>
    }>
      {flash.node && <div className="mb-3">{flash.node}</div>}
      <Table head={["Name", "Employee ID", "Contractor", "Phone", "Licence", "Signed on"]} empty={rows.length === 0}>
        {rows.slice(0, 500).map((g) => (
          <tr key={g.id}>
            <td className="px-3 py-2 font-semibold">{g.name}</td>
            <td className="px-3 py-2">{g.employee_id}</td>
            <td className="px-3 py-2">{isManager
              ? <select aria-label={`Provider for ${g.name}`} className="control-input h-9 w-auto py-0 text-sm" value={g.contractor_id ?? ""} onChange={(e) => moveGuard(g.id, e.target.value)}>
                  <option value="">No provider</option>{contractors.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              : contractorName(g.contractor_id)}</td>
            <td className="px-3 py-2"><a className="text-primary" href={`tel:${g.phone}`}>{g.phone}</a></td>
            <td className="px-3 py-2">{g.licence_number}</td>
            <td className="px-3 py-2">{onNow.has(g.id) ? <span className="text-success">Yes</span> : "—"}</td>
          </tr>
        ))}
      </Table>
    </Panel>
  );
}

function AddGuard() {
  const { contractors, isManager, myContractorIds, reload } = useOps();
  const [f, setF] = useState<Record<string, string>>({});
  const flash = useFlash();
  const allowed = isManager ? contractors : contractors.filter((c) => myContractorIds.includes(c.id));
  const link = `${shareableOrigin()}/mobile/onboarding`;
  const save = async () => {
    if (!f.name || !f.phone || !f.employee_id) return flash.show("Name, phone and employee ID are required.", true);
    const { error } = await supabase.from("guards").insert({
      user_id: crypto.randomUUID(), name: f.name, phone: f.phone, email: f.email || "", employee_id: f.employee_id,
      licence_number: f.licence || "", emergency_contact: f.emergency || "", contractor_id: f.contractor || null, status: "active",
    });
    if (error) return flash.show(errMsg(error), true);
    flash.show("Guard added."); setF({}); reload();
  };
  const input = (k: string, label: string) => <Field label={label}><input className="control-input h-11" value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>;
  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <Panel title="Add a guard">
        <div className="grid gap-3 sm:grid-cols-2">
          {input("name", "Full name")}{input("employee_id", "Employee ID")}{input("phone", "Mobile")}{input("email", "Email")}{input("licence", "Security licence")}{input("emergency", "Emergency contact")}
          <Field label="Contractor"><select className="control-input h-11" value={f.contractor ?? ""} onChange={(e) => setF({ ...f, contractor: e.target.value })}><option value="">—</option>{allowed.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        </div>
        <button className="primary-button mt-4 h-11" onClick={save}>Add guard</button>
        <div className="mt-3">{flash.node}</div>
      </Panel>
      <Panel title="Self-registration link" description="Guards can register themselves from their phone using this link or its QR code.">
        <div className="flex flex-col items-center gap-3">
          <img alt="Registration QR code" className="h-44 w-44 rounded-md bg-foreground p-2" src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}`} />
          <code className="break-all rounded-md bg-secondary p-2 text-xs">{link}</code>
          <button className="secondary-button h-10" onClick={() => navigator.clipboard.writeText(link)}>Copy link</button>
          <a className="text-sm text-primary underline" href="/admin/guards?tab=poster">Make a branded poster</a>
        </div>
      </Panel>
      {isManager && <div className="lg:col-span-2"><BulkUpload /></div>}
    </div>
  );
}

function BulkUpload() {
  const { contractors, guards, reload } = useOps();
  const [rows, setRows] = useState<GuardImportRow[]>([]);
  const [raw, setRaw] = useState<Record<string, unknown>[]>([]);
  const [def, setDef] = useState("");
  const [busy, setBusy] = useState(false);
  const flash = useFlash();
  useEffect(() => { setRows(raw.length ? parseGuardRows(raw, contractors, guards, def || null) : []); }, [raw, def, contractors, guards]);
  const onFile = async (file?: File) => {
    if (!file) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array", raw: false, cellText: true });
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false });
    if (!data.length) return flash.show("No rows found in that file.", true);
    setRaw(data);
  };
  const template = () => {
    const csv = GUARD_IMPORT_HEADERS.join(",") + "\nJane Citizen,EMP001,0400000000,jane@example.com,123456789,John Citizen 0411111111," + (contractors[0]?.name ?? "") + "\n";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "guard_upload_template.csv"; a.click();
  };
  const valid = rows.filter((r) => r.errors.length === 0);
  const save = async () => {
    setBusy(true);
    const payload = valid.map((r) => ({
      user_id: crypto.randomUUID(), name: r.name, phone: r.phone, email: r.email, employee_id: r.employee_id,
      licence_number: r.licence_number, emergency_contact: r.emergency_contact, contractor_id: r.contractor_id, status: "active" as const,
    }));
    for (let i = 0; i < payload.length; i += 500) {
      const { error } = await supabase.from("guards").insert(payload.slice(i, i + 500));
      if (error) { setBusy(false); reload(); return flash.show(`Stopped after ${i} guards: ${errMsg(error)}`, true); }
    }
    setBusy(false); setRaw([]); reload();
    flash.show(`${payload.length} guards added.`);
  };
  return (
    <Panel title="Bulk upload guards" description="Upload a CSV or Excel file. Required: name, employee_id, phone. Optional: email, licence_number, emergency_contact, contractor (provider name)." actions={<button className="secondary-button h-10" onClick={template}>Download template</button>}>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="File"><input type="file" accept=".csv,.xlsx,.xls" className="control-input h-11" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} /></Field>
        <Field label="Provider for rows without one"><select className="control-input h-11" value={def} onChange={(e) => setDef(e.target.value)}><option value="">No provider</option>{contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        {rows.length > 0 && <button className="primary-button h-11" disabled={busy || valid.length === 0} onClick={save}>{busy ? "Adding…" : `Add ${valid.length} guards`}</button>}
        {rows.length > 0 && <button className="secondary-button h-11" onClick={() => setRaw([])}>Clear</button>}
      </div>
      <div className="mt-3">{flash.node}</div>
      {rows.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-sm">{valid.length} ready · <span className={rows.length - valid.length ? "text-destructive" : ""}>{rows.length - valid.length} with problems (skipped)</span></p>
          <Table head={["Row", "Name", "Employee ID", "Mobile", "Provider", "Status"]} empty={false}>
            {rows.slice(0, 300).map((r) => (
              <tr key={r.line}>
                <td className="px-3 py-2">{r.line}</td><td className="px-3 py-2">{r.name}</td><td className="px-3 py-2">{r.employee_id}</td>
                <td className="px-3 py-2">{r.phone}</td><td className="px-3 py-2">{contractors.find((c) => c.id === r.contractor_id)?.name ?? "—"}</td>
                <td className="px-3 py-2">{r.errors.length ? <span className="text-destructive">{r.errors.join("; ")}</span> : <span className="text-success">Ready</span>}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </Panel>
  );
}

type Group = { id: string; name: string; kind: string; filter: Record<string, string>; contractor_id: string | null };

export function resolveGroup(g: Group, members: string[], ctx: ReturnType<typeof useOps>) {
  if (g.kind === "manual") return members;
  // Legacy dynamic groups: real guards only — those signed on now to matching positions, or a contractor's guards.
  const f = g.filter;
  const ids = new Set<string>();
  if (f.zone || f.role || f.position) {
    const slotIds = new Set(ctx.slots.filter((s) => (!f.zone || s.zone === f.zone) && (!f.role || s.role === f.role) && (!f.position || s.position === f.position) && (!f.contractor || s.contractor_id === f.contractor)).map((s) => s.id));
    ctx.attendance.filter((a) => !a.signed_off_at && a.slot_id && slotIds.has(a.slot_id)).forEach((a) => ids.add(a.guard_id));
  } else if (f.contractor) ctx.guards.filter((x) => x.contractor_id === f.contractor).forEach((x) => ids.add(x.id));
  return [...ids];
}

function GuardPicker({ picked, setPicked }: { picked: string[]; setPicked: (ids: string[]) => void }) {
  const { contractors, contractorName, attendance } = useOps();
  const guards = useScopedGuards();
  const [q, setQ] = useState("");
  const [c, setC] = useState("");
  const [onlyOn, setOnlyOn] = useState(false);
  const onNow = useMemo(() => new Set(attendance.filter((a) => !a.signed_off_at).map((a) => a.guard_id)), [attendance]);
  const rows = guards.filter((g) => (!c || g.contractor_id === c) && (!onlyOn || onNow.has(g.id)) && (!q || `${g.name} ${g.employee_id} ${g.phone}`.toLowerCase().includes(q.toLowerCase())));
  const shown = rows.slice(0, 300);
  const set = new Set(picked);
  const addable = shown.filter((g) => g.phone?.trim());
  return (
    <div className="space-y-2">
      <input className="control-input h-10 w-full" placeholder="Search name, mobile or employee ID…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        <select className="control-input h-9 w-auto text-sm" value={c} onChange={(e) => setC(e.target.value)}><option value="">All contractors</option>{contractors.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={onlyOn} onChange={(e) => setOnlyOn(e.target.checked)} />Signed on now</label>
      </div>
      <div className="flex gap-3 text-xs">
        <button type="button" className="text-primary" onClick={() => setPicked([...new Set([...picked, ...addable.map((g) => g.id)])])}>Select all shown ({addable.length})</button>
        <button type="button" className="text-muted-foreground" onClick={() => { const drop = new Set(shown.map((g) => g.id)); setPicked(picked.filter((id) => !drop.has(id))); }}>Clear shown</button>
      </div>
      <div className="max-h-72 divide-y divide-border overflow-y-auto rounded-md border border-border">
        {shown.length === 0 && <p className="p-3 text-sm text-muted-foreground">No guards match.</p>}
        {shown.map((g) => {
          const noPhone = !g.phone?.trim();
          return (
            <label key={g.id} className={`flex items-center gap-2 px-2 py-1.5 text-sm ${noPhone ? "opacity-60" : "cursor-pointer"}`}>
              <input type="checkbox" disabled={noPhone} checked={set.has(g.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, g.id] : picked.filter((x) => x !== g.id))} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{g.name}{onNow.has(g.id) && <span className="ml-2 text-xs text-success">● on</span>}</span>
                <span className="block truncate text-xs text-muted-foreground">{contractorName(g.contractor_id) || "No contractor"} · {g.employee_id}</span>
              </span>
              <span className={`shrink-0 tabular-nums text-xs ${noPhone ? "text-danger" : ""}`}>{noPhone ? "No mobile" : g.phone}</span>
            </label>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{picked.length} selected{rows.length > shown.length ? ` · showing first ${shown.length} of ${rows.length}, search to narrow` : ""}</p>
    </div>
  );
}

function Groups() {
  const ctx = useOps();
  const { isManager, myContractorIds, session, guards, contractorName } = ctx;
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Record<string, string[]>>({});
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const flash = useFlash();
  const gmap = useMemo(() => new Map(guards.map((g) => [g.id, g])), [guards]);

  const load = async () => {
    const { data } = await supabase.from("guard_groups").select("*").order("created_at", { ascending: false });
    setGroups((data ?? []) as Group[]);
    const { data: m } = await supabase.from("guard_group_members").select("group_id,guard_id");
    const map: Record<string, string[]> = {};
    (m ?? []).forEach((r: any) => (map[r.group_id] ||= []).push(r.guard_id));
    setMembers(map);
  };
  useEffect(() => { load(); }, []);

  const reset = () => { setName(""); setPicked([]); setEditing(null); };
  const save = async () => {
    if (!name.trim()) return flash.show("Give the group a name.", true);
    if (!picked.length) return flash.show("Pick at least one guard.", true);
    let id = editing;
    if (editing) {
      const { error } = await supabase.from("guard_groups").update({ name: name.trim(), kind: "manual", filter: {} }).eq("id", editing);
      if (error) return flash.show(errMsg(error), true);
      const { error: d } = await supabase.from("guard_group_members").delete().eq("group_id", editing);
      if (d) return flash.show(errMsg(d), true);
    } else {
      const { data, error } = await supabase.from("guard_groups").insert({ name: name.trim(), kind: "manual", filter: {}, contractor_id: isManager ? null : myContractorIds[0] ?? null, event_id: ctx.event?.id, created_by: session?.user.id }).select("id").single();
      if (error) return flash.show(errMsg(error), true);
      id = data.id;
    }
    for (let i = 0; i < picked.length; i += 500) {
      const { error } = await supabase.from("guard_group_members").insert(picked.slice(i, i + 500).map((guard_id) => ({ group_id: id!, guard_id })));
      if (error) return flash.show(errMsg(error), true);
    }
    flash.show(editing ? "Group updated." : "Group created."); reset(); load();
  };
  const edit = (g: Group) => { setEditing(g.id); setName(g.name); setPicked(resolveGroup(g, members[g.id] ?? [], ctx)); };
  const remove = async (id: string) => { if (!window.confirm("Delete this group?")) return; await supabase.from("guard_groups").delete().eq("id", id); if (editing === id) reset(); load(); };

  return (
    <div className="grid gap-5 lg:grid-cols-[420px_minmax(0,1fr)]">
      <Panel title={editing ? "Edit group" : "New group"} description="Pick the actual guards to text. Only guards with a mobile number can be added." className="min-w-0">
        <div className="space-y-3">
          <Field label="Name"><input className="control-input h-11 w-full" placeholder="e.g. Gate 1 team" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <GuardPicker picked={picked} setPicked={setPicked} />
          <div className="flex gap-2">
            <button className="primary-button h-11 flex-1" onClick={save}>{editing ? "Save changes" : "Create group"}</button>
            {editing && <button className="secondary-button h-11" onClick={reset}>Cancel</button>}
          </div>
          {flash.node}
        </div>
      </Panel>
      <Panel title="Groups" className="min-w-0">
        {groups.length === 0 && <p className="text-sm text-muted-foreground">No groups yet.</p>}
        <div className="space-y-2">
          {groups.map((g) => {
            const ids = resolveGroup(g, members[g.id] ?? [], ctx);
            const withPhone = ids.filter((id) => gmap.get(id)?.phone?.trim()).length;
            return (
              <div key={g.id} className="rounded-md border border-border">
                <div className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(open === g.id ? null : g.id)}>
                    <span className="block font-semibold">{g.name}</span>
                    <span className="block text-xs text-muted-foreground">{ids.length} guard{ids.length === 1 ? "" : "s"} · {withPhone} with a mobile{g.kind !== "manual" ? " · old roster-based group" : ""}</span>
                  </button>
                  <button className="text-sm text-primary" onClick={() => setOpen(open === g.id ? null : g.id)}>{open === g.id ? "Hide" : "View"}</button>
                  <button className="text-sm text-primary" onClick={() => edit(g)}>Edit</button>
                  <button className="text-sm text-danger" onClick={() => remove(g.id)}>Delete</button>
                </div>
                {open === g.id && (
                  <div className="max-h-72 overflow-y-auto border-t border-border">
                    <Table head={["Guard", "Mobile", "Contractor"]} empty={ids.length === 0}>
                      {ids.map((id) => { const x = gmap.get(id); return (
                        <tr key={id}><td className="px-3 py-1.5 font-semibold">{x?.name ?? "Unknown guard"}</td><td className={`px-3 py-1.5 tabular-nums ${x?.phone?.trim() ? "" : "text-danger"}`}>{x?.phone?.trim() || "No mobile"}</td><td className="px-3 py-1.5">{contractorName(x?.contractor_id ?? null)}</td></tr>
                      ); })}
                    </Table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
