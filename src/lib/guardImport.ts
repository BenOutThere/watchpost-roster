// Pure rules for the admin bulk guard upload (CSV/Excel rows → validated guard records).
export const GUARD_IMPORT_HEADERS = ["name", "employee_id", "phone", "email", "licence_number", "emergency_contact", "contractor"] as const;

export type GuardImportRow = {
  line: number; name: string; employee_id: string; phone: string; email: string;
  licence_number: string; emergency_contact: string; contractor_id: string | null; errors: string[];
};

const ALIASES: Record<string, (typeof GUARD_IMPORT_HEADERS)[number]> = {
  name: "name", fullname: "name", guardname: "name",
  employeeid: "employee_id", staffid: "employee_id", id: "employee_id",
  phone: "phone", mobile: "phone", mobilephone: "phone",
  email: "email",
  licence: "licence_number", licencenumber: "licence_number", license: "licence_number", licensenumber: "licence_number", securitylicence: "licence_number",
  emergencycontact: "emergency_contact", emergency: "emergency_contact",
  contractor: "contractor", provider: "contractor", securityprovider: "contractor",
};

export function normalisePhone(p: string) {
  let d = p.replace(/[^\d+]/g, "");
  if (d.startsWith("+61")) d = "0" + d.slice(3);
  else if (d.startsWith("61") && d.length === 11) d = "0" + d.slice(2);
  else if (/^4\d{8}$/.test(d)) d = "0" + d;
  return d;
}

export function parseGuardRows(
  raw: Record<string, unknown>[],
  contractors: { id: string; name: string }[],
  existing: { employee_id: string; phone: string }[],
  defaultContractorId: string | null,
): GuardImportRow[] {
  const byName = new Map(contractors.map((c) => [c.name.trim().toLowerCase(), c.id]));
  const seenIds = new Set(existing.map((g) => g.employee_id.trim().toLowerCase()).filter(Boolean));
  const seenPhones = new Set(existing.map((g) => normalisePhone(g.phone)).filter(Boolean));
  return raw.map((r, i) => {
    const v: Record<string, string> = {};
    for (const [k, val] of Object.entries(r)) {
      const key = ALIASES[k.toLowerCase().replace(/[^a-z]/g, "")];
      if (key && !v[key]) v[key] = String(val ?? "").trim();
    }
    const errors: string[] = [];
    const phone = normalisePhone(v.phone ?? "");
    if (!v.name) errors.push("Name missing");
    if (!v.employee_id) errors.push("Employee ID missing");
    if (!phone) errors.push("Mobile missing");
    else if (!/^0\d{9}$/.test(phone)) errors.push("Mobile not a valid AU number");
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errors.push("Email invalid");
    let contractor_id = defaultContractorId;
    if (v.contractor) {
      contractor_id = byName.get(v.contractor.toLowerCase()) ?? null;
      if (!contractor_id) errors.push(`Unknown provider "${v.contractor}"`);
    }
    const idKey = (v.employee_id ?? "").toLowerCase();
    if (idKey && seenIds.has(idKey)) errors.push("Employee ID already exists");
    if (phone && seenPhones.has(phone)) errors.push("Mobile already exists");
    if (errors.length === 0) { seenIds.add(idKey); seenPhones.add(phone); }
    return {
      line: i + 2, name: v.name ?? "", employee_id: v.employee_id ?? "", phone, email: v.email ?? "",
      licence_number: v.licence_number ?? "", emergency_contact: v.emergency_contact ?? "", contractor_id, errors,
    };
  });
}
