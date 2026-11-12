import { describe, expect, it } from "vitest";
import { normalisePhone, parseGuardRows } from "./guardImport";

const cs = [{ id: "c1", name: "NSRG" }];

describe("guard bulk upload", () => {
  it("requires name, employee ID and mobile", () => {
    const [r] = parseGuardRows([{ Name: "", "Employee ID": "", Mobile: "" }], cs, [], null);
    expect(r.errors).toEqual(["Name missing", "Employee ID missing", "Mobile missing"]);
  });
  it("normalises +61 mobiles", () => expect(normalisePhone("+61 424 973 833")).toBe("0424973833"));
  it("rejects duplicates of existing guards and within the file", () => {
    const rows = parseGuardRows(
      [{ name: "A", employee_id: "E1", phone: "0400000001" }, { name: "B", employee_id: "E2", phone: "0400000002" }, { name: "C", employee_id: "e2", phone: "0400000003" }],
      cs, [{ employee_id: "E1", phone: "" }], null);
    expect(rows.map((r) => r.errors.length > 0)).toEqual([true, false, true]);
  });
  it("matches provider by name, else uses the chosen default", () => {
    const rows = parseGuardRows([{ name: "A", employee_id: "E1", phone: "0400000001", Provider: "nsrg" }, { name: "B", employee_id: "E2", phone: "0400000002" }], cs, [], "c9");
    expect(rows.map((r) => r.contractor_id)).toEqual(["c1", "c9"]);
  });
});
