"use client";

import { motion } from "motion/react";
import { Terminal } from "lucide-react";

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5, ease: "easeOut" },
} as const;

// The spans below map 1:1 to the span() calls in the code on the left.
// Offsets/widths are % of the request duration.
const SPANS = [
  { label: "GET /users", ms: "142ms", left: 0, width: 100, depth: 0 },
  { label: "db.select", ms: "38ms", left: 8, width: 27, depth: 1 },
  { label: "enrich.profiles", ms: "54ms", left: 36, width: 38, depth: 1 },
];

export function Showcase() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <motion.div {...reveal} className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Add a span. Watch it appear.
        </h2>
        <p className="mt-4 text-fd-muted-foreground text-pretty">
          Every request is traced automatically. Drop <code>span()</code>,
          context and logs where you want more detail — and see exactly what
          ran, in order, with timings.
        </p>
      </motion.div>

      <div className="mt-14 grid items-center gap-6 lg:grid-cols-2">
        {/* Code card */}
        <motion.div {...reveal} className="beam-border rounded-xl">
          <div className="overflow-hidden rounded-xl border border-fd-border bg-fd-card/80 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="flex items-center gap-2 border-b border-fd-border px-4 py-3">
              <span className="size-3 rounded-full bg-red-400/80" />
              <span className="size-3 rounded-full bg-amber-400/80" />
              <span className="size-3 rounded-full bg-green-400/80" />
              <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-fd-muted-foreground">
                <Terminal className="size-3.5" />
                users.module.ts
              </span>
            </div>
            <pre className="overflow-x-auto p-5 text-[13px] leading-relaxed">
              <code className="font-mono">
                <span className="text-sky-400">import</span>
                <span className="text-fd-foreground">
                  {" { createModule } "}
                </span>
                <span className="text-sky-400">from</span>
                <span className="text-emerald-400">
                  {" '@getvision/server'"}
                </span>
                {"\n\n"}
                <span className="text-sky-400">export const</span>
                <span className="text-fd-foreground">{" users = "}</span>
                <span className="text-teal-300">createModule</span>
                <span className="text-fd-foreground">({"{ "}</span>
                <span className="text-cyan-400">prefix</span>
                <span className="text-fd-foreground">: </span>
                <span className="text-emerald-400">{"'/users'"}</span>
                <span className="text-fd-foreground">{" })"}</span>
                {"\n"}
                <span className="text-fd-foreground">{"  ."}</span>
                <span className="text-teal-300">get</span>
                <span className="text-fd-foreground">
                  {"('/', ({ span, addContext, logger }) => {"}
                </span>
                {"\n"}
                <span className="text-fd-foreground">{"    "}</span>
                <span className="text-teal-300">addContext</span>
                <span className="text-fd-foreground">({"{ "}</span>
                <span className="text-emerald-400">{"'user.plan'"}</span>
                <span className="text-fd-foreground">: </span>
                <span className="text-emerald-400">{"'pro'"}</span>
                <span className="text-fd-foreground">{" })"}</span>
                {"\n\n"}
                <span className="text-fd-foreground">{"    "}</span>
                <span className="text-sky-400">const</span>
                <span className="text-fd-foreground">{" rows = "}</span>
                <span className="text-teal-300">span</span>
                <span className="text-fd-foreground">(</span>
                <span className="text-emerald-400">{"'db.select'"}</span>
                <span className="text-fd-foreground">, {"{ "}</span>
                <span className="text-emerald-400">{"'db.table'"}</span>
                <span className="text-fd-foreground">: </span>
                <span className="text-emerald-400">{"'users'"}</span>
                <span className="text-fd-foreground">{" }, () =>"}</span>
                {"\n"}
                <span className="text-fd-foreground">
                  {"      db.select().from(users).all()"}
                </span>
                {"\n"}
                <span className="text-fd-foreground">{"    )"}</span>
                {"\n"}
                <span className="text-fd-foreground">{"    "}</span>
                <span className="text-sky-400">const</span>
                <span className="text-fd-foreground">{" data = "}</span>
                <span className="text-teal-300">span</span>
                <span className="text-fd-foreground">(</span>
                <span className="text-emerald-400">{"'enrich.profiles'"}</span>
                <span className="text-fd-foreground">
                  {", {}, () => enrich(rows))"}
                </span>
                {"\n\n"}
                <span className="text-fd-foreground">{"    "}</span>
                <span className="text-teal-300">logger</span>
                <span className="text-fd-foreground">.</span>
                <span className="text-teal-300">info</span>
                <span className="text-fd-foreground">(</span>
                <span className="text-emerald-400">{"'loaded users'"}</span>
                <span className="text-fd-foreground">, {"{ "}</span>
                <span className="text-cyan-400">count</span>
                <span className="text-fd-foreground">: rows.length {"}"})</span>
                {"\n"}
                <span className="text-fd-foreground">{"    "}</span>
                <span className="text-sky-400">return</span>
                <span className="text-fd-foreground">{" data"}</span>
                {"\n"}
                <span className="text-fd-foreground">{"  })"}</span>
              </code>
            </pre>
          </div>
        </motion.div>

        {/* Dashboard mock */}
        <motion.div
          {...reveal}
          transition={{ ...reveal.transition, delay: 0.1 }}
          className="overflow-hidden rounded-xl border border-fd-border bg-fd-card/70 shadow-2xl shadow-black/20 backdrop-blur"
        >
          {/* window bar */}
          <div className="flex items-center gap-2 border-b border-fd-border px-4 py-3">
            <span className="size-3 rounded-full bg-red-400/80" />
            <span className="size-3 rounded-full bg-amber-400/80" />
            <span className="size-3 rounded-full bg-green-400/80" />
            <span className="ml-2 text-xs text-fd-muted-foreground">
              Vision · localhost:9500
            </span>
          </div>

          {/* tabs */}
          <div className="flex gap-1 border-b border-fd-border px-3 pt-2 text-xs">
            <span className="rounded-t-md border-b-2 border-emerald-400 px-3 py-2 font-medium text-fd-foreground">
              Traces
            </span>
            <span className="px-3 py-2 text-fd-muted-foreground">Logs</span>
            <span className="px-3 py-2 text-fd-muted-foreground">
              Playground
            </span>
          </div>

          {/* request header row */}
          <div className="flex items-center justify-between border-b border-fd-border px-4 py-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-semibold text-emerald-400">
                GET
              </span>
              <span className="font-mono text-fd-foreground">/users</span>
            </div>
            <div className="flex items-center gap-3 text-fd-muted-foreground">
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-medium text-emerald-400">
                200
              </span>
              <span className="font-mono">142&nbsp;ms</span>
            </div>
          </div>

          {/* waterfall */}
          <div className="space-y-2.5 px-4 py-4">
            {SPANS.map((s) => (
              <div key={s.label} className="flex items-center gap-3 text-xs">
                <span
                  className="w-32 shrink-0 truncate font-mono text-fd-muted-foreground"
                  style={{ paddingLeft: s.depth * 12 }}
                >
                  {s.label}
                </span>
                <div className="relative h-2.5 flex-1 rounded bg-fd-border/40">
                  <div
                    className="absolute h-2.5 rounded bg-gradient-to-r from-emerald-400 to-teal-400"
                    style={{ left: `${s.left}%`, width: `${s.width}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right font-mono text-fd-muted-foreground">
                  {s.ms}
                </span>
              </div>
            ))}
          </div>

          {/* log line carrying wide-event context */}
          <div className="border-t border-fd-border bg-fd-background/40 px-4 py-3 font-mono text-xs">
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-semibold text-emerald-400">
              INFO
            </span>{" "}
            <span className="text-fd-foreground">loaded users</span>{" "}
            <span className="text-fd-muted-foreground">
              count=<span className="text-fd-foreground">12</span> user.plan=
              <span className="text-fd-foreground">pro</span>
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
