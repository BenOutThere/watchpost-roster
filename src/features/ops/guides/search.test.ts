import { describe, expect, it } from "vitest";
import { adminGuide } from "./adminGuide";
import { securityManagerGuide } from "./securityManagerGuide";
import { queryWords, searchGuide } from "./search";

const topicIds = (q: string, g = adminGuide) => searchGuide(g, q).flatMap((s) => s.topics.map((t) => t.id));

describe("user guide search", () => {
  it("returns every section for an empty search", () => {
    expect(searchGuide(adminGuide, "  ").length).toBe(adminGuide.sections.length);
  });
  it("needs all words to match", () => {
    expect(topicIds("scan guard QR")).toContain("desk-sign-on");
    expect(topicIds("scan zzzz")).toEqual([]);
  });
  it("finds word variants like invite → invitation", () => {
    expect(queryWords("invite")).toEqual(["invit"]);
    expect(topicIds("invite")).toContain("add-user");
  });
  it("finds the new export topic in both guides", () => {
    expect(topicIds("export all")).toContain("export-variations");
    expect(topicIds("export all", securityManagerGuide)).toContain("register");
  });
  it("finds the desk scanner topic in both guides", () => {
    expect(topicIds("desk scanner")).toContain("desk-scanner");
    expect(topicIds("desk scanner", securityManagerGuide)).toContain("desk-scanner");
  });
});
