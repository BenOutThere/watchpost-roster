import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Printer, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSecurityView } from "./OpsContext";
import { Page, Tabs } from "./ui";
import { adminGuide } from "./guides/adminGuide";
import { securityManagerGuide } from "./guides/securityManagerGuide";
import { queryWords, searchGuide } from "./guides/search";
import type { Guide, GuideBlock } from "./guides/types";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Renders **bold** markup and highlights search words. */
function Inline({ text, words }: { text: string; words: string[] }) {
  const re = words.length ? new RegExp(`(${words.map(escapeRe).join("|")})`, "gi") : null;
  const mark = (s: string, k: string) => {
    if (!re) return s;
    return s.split(re).map((part, i) => (i % 2 === 1 ? <mark key={`${k}-${i}`} className="rounded-sm bg-primary/40 px-0.5 text-foreground">{part}</mark> : <Fragment key={`${k}-${i}`}>{part}</Fragment>));
  };
  return <>{text.split("**").map((seg, i) => (i % 2 === 1 ? <strong key={i} className="font-semibold text-foreground">{mark(seg, `b${i}`)}</strong> : <Fragment key={i}>{mark(seg, `t${i}`)}</Fragment>))}</>;
}

const noteStyle = {
  tip: { label: "Tip", cls: "border-primary/50 bg-primary/10" },
  info: { label: "Good to know", cls: "border-border bg-secondary/60" },
  important: { label: "Important", cls: "border-warning/60 bg-warning/10" },
} as const;

function Block({ b, words }: { b: GuideBlock; words: string[] }) {
  switch (b.t) {
    case "p":
      return <p className="leading-relaxed text-muted-foreground"><Inline text={b.text} words={words} /></p>;
    case "list":
      return <ul className="list-disc space-y-1.5 pl-5 leading-relaxed text-muted-foreground">{b.items.map((it, i) => <li key={i}><Inline text={it} words={words} /></li>)}</ul>;
    case "steps":
      return (
        <ol className="space-y-2.5">
          {b.items.map((it, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
              <span className="pt-0.5 leading-relaxed text-muted-foreground"><Inline text={it} words={words} /></span>
            </li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/70">
              <tr>{b.head.map((h, i) => <th key={i} className="px-3 py-2 font-semibold text-foreground">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {b.rows.map((r, i) => (
                <tr key={i} className="align-top">
                  {r.map((c, j) => <td key={j} className={cn("px-3 py-2 text-muted-foreground", j === 0 && "text-foreground", b.head.length > 4 && j > 0 && "text-center")}><Inline text={c} words={words} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "note":
      if (b.tone === "new") return <p><span className="inline-flex items-center rounded bg-primary px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-primary-foreground">New</span> <span className="text-sm text-muted-foreground"><Inline text={b.text} words={words} /></span></p>;
      return (
        <div className={cn("rounded-md border-l-4 border p-3 text-sm leading-relaxed", noteStyle[b.tone].cls)}>
          <span className="font-bold text-foreground">{noteStyle[b.tone].label}. </span>
          <span className="text-muted-foreground"><Inline text={b.text} words={words} /></span>
        </div>
      );
  }
}

const countTopics = (secs: { topics: unknown[] }[]) => secs.reduce((n, s) => n + s.topics.length, 0);

/** Searchable in-app Admin and Security Manager guides. */
export function GuidesPage() {
  // Security Manager view (security provider users, or an admin previewing it) sees only the Security Manager guide.
  const securityView = useSecurityView();
  const guides: Guide[] = securityView ? [securityManagerGuide] : [adminGuide, securityManagerGuide];
  const [guideId, setGuideId] = useState<Guide["id"]>(guides[0].id);
  const guide = guides.find((g) => g.id === guideId) ?? guides[0];
  const [q, setQ] = useState("");
  const words = useMemo(() => queryWords(q), [q]);
  const sections = useMemo(() => searchGuide(guide, q), [guide, q]);
  const other = guides.find((g) => g.id !== guide.id);
  const otherCount = useMemo(() => (other && words.length ? countTopics(searchGuide(other, q)) : 0), [other, q, words.length]);
  const anchor = (id: string) => `guide-${guide.id}-${id}`;
  const jump = (id: string) => document.getElementById(anchor(id))?.scrollIntoView({ behavior: "smooth", block: "start" });
  const print = () => { setQ(""); setTimeout(() => window.print(), 150); };

  return (
    <Page>
      <section className="panel p-5 print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground"><BookOpen className="h-6 w-6" /></span>
            <div>
              <h2 className="text-lg font-bold">User guides</h2>
              <p className="text-sm text-muted-foreground">How each part of the app works, how to set it up and how to use it on the day.</p>
            </div>
          </div>
          <button className="secondary-button h-10 px-3" onClick={print}><Printer className="mr-2 h-4 w-4" />Print / save as PDF</button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {guides.length > 1 && <Tabs tabs={guides.map((g) => ({ id: g.id, label: g.title }))} value={guide.id} onChange={setGuideId} />}
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input className="control-input h-11 w-full pl-9 pr-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the guide — e.g. QR pass, auto sign-off, invite, export" aria-label="Search the guide" />
            {q && <button className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground" onClick={() => setQ("")} aria-label="Clear search"><X className="h-4 w-4" /></button>}
          </div>
        </div>
        {words.length > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            {countTopics(sections)} {countTopics(sections) === 1 ? "topic matches" : "topics match"} in the {guide.title}.
            {other && otherCount > 0 && <> <button className="font-semibold text-primary underline-offset-2 hover:underline" onClick={() => setGuideId(other.id)}>{otherCount} more in the {other.title} →</button></>}
          </p>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav className="print:hidden lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto" aria-label="Guide contents">
          <div className="panel p-3">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Contents</p>
            {sections.length === 0 ? <p className="px-2 text-sm text-muted-foreground">No matches.</p> : (
              <ul className="space-y-0.5">
                {sections.map((s) => (
                  <li key={s.id}>
                    <button onClick={() => jump(s.id)} className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-secondary">
                      <span className={cn(s.id === "whats-new" && "font-semibold text-primary")}>{s.title}</span>
                      {words.length > 0 && <span className="text-xs tabular-nums text-muted-foreground">{s.topics.length}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </nav>

        <article id="guide-print" className="min-w-0 space-y-5">
          <header className="panel p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Out There Group · User guide · Updated {guide.updated}</p>
            <h1 className="mt-1 text-2xl font-bold">{guide.title}</h1>
            <p className="mt-1 text-sm font-semibold text-foreground">For {guide.audience}.</p>
            <p className="mt-2 leading-relaxed text-muted-foreground">{guide.intro}</p>
          </header>

          {sections.length === 0 && (
            <div className="panel p-6 text-center">
              <p className="font-semibold">Nothing matches “{q}”.</p>
              <p className="mt-1 text-sm text-muted-foreground">Try fewer or different words.</p>
              <button className="secondary-button mt-3 h-10 px-4" onClick={() => setQ("")}>Clear search</button>
            </div>
          )}

          {sections.map((s) => (
            <section key={s.id} id={anchor(s.id)} className={cn("panel scroll-mt-24 p-5", s.id === "whats-new" && "border-primary/60")}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{s.title}</h2>
                  {s.intro && <p className="mt-1 max-w-3xl leading-relaxed text-muted-foreground"><Inline text={s.intro} words={words} /></p>}
                </div>
                {s.link && <Link to={s.link.to} className="secondary-button h-9 shrink-0 px-3 text-sm print:hidden">{s.link.label}<ArrowRight className="ml-2 h-4 w-4" /></Link>}
              </div>
              <div className="space-y-6">
                {s.topics.map((t) => (
                  <div key={t.id} className="space-y-3">
                    <h3 className="text-base font-bold text-foreground"><Inline text={t.title} words={words} /></h3>
                    {t.blocks.map((b, i) => <Block key={i} b={b} words={words} />)}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </article>
      </div>
    </Page>
  );
}
