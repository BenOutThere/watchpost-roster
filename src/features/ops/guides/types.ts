/** In-app user guide content. Text may use **bold** inline markup. */
export type GuideBlock =
  | { t: "p"; text: string }
  | { t: "steps"; items: string[] }
  | { t: "list"; items: string[] }
  | { t: "table"; head: string[]; rows: string[][] }
  | { t: "note"; tone: "tip" | "info" | "important" | "new"; text: string };

export type GuideTopic = { id: string; title: string; blocks: GuideBlock[] };

export type GuideSection = {
  id: string;
  title: string;
  intro?: string;
  /** Quick link to the matching screen in the app. */
  link?: { to: string; label: string };
  topics: GuideTopic[];
};

export type Guide = {
  id: "admin" | "security";
  title: string;
  audience: string;
  updated: string;
  intro: string;
  sections: GuideSection[];
};
