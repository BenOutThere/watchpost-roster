import type { Guide, GuideBlock, GuideSection, GuideTopic } from "./types";

const blockText = (b: GuideBlock): string => {
  switch (b.t) {
    case "p": case "note": return b.text;
    case "steps": case "list": return b.items.join(" ");
    case "table": return [...b.head, ...b.rows.flat()].join(" ");
  }
};

const norm = (s: string) => s.toLowerCase().replace(/\*\*/g, "");

/** Light stemming so "invite" finds "invitation" and "approves" finds "approval". */
const stem = (w: string) => (w.length > 4 ? w.replace(/(ing|ed|es|e|s|al)$/, "") : w);

/** Lower-cased, lightly stemmed search words from a query (duplicates removed). */
export const queryWords = (q: string) => [...new Set(norm(q).split(/\s+/).filter(Boolean).map(stem))];

/** All of the words must appear somewhere in the topic (its section title, topic title or text). */
export function topicMatches(section: GuideSection, topic: GuideTopic, words: string[]) {
  if (!words.length) return true;
  const hay = norm([section.title, section.intro ?? "", topic.title, ...topic.blocks.map(blockText)].join(" "));
  return words.every((w) => hay.includes(w));
}

/** Sections with only their matching topics; sections with none are dropped. */
export function searchGuide(guide: Guide, q: string): GuideSection[] {
  const words = queryWords(q);
  if (!words.length) return guide.sections;
  return guide.sections
    .map((s) => ({ ...s, topics: s.topics.filter((t) => topicMatches(s, t, words)) }))
    .filter((s) => s.topics.length > 0);
}
