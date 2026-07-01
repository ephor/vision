"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  Activity,
  ScrollText,
  FlaskConical,
  ShieldCheck,
  Share2,
  LayoutDashboard,
  Boxes,
  Cable,
  KeyRound,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5, ease: "easeOut" },
} as const;

const FEATURES: {
  icon: LucideIcon;
  title: string;
  body: string;
  badge?: string;
}[] = [
  {
    icon: LayoutDashboard,
    title: "Auto-generated dashboard",
    body: "Vision discovers your routes and services and builds the whole dashboard for you — no setup, no config, no schema files.",
  },
  {
    icon: Activity,
    title: "Real-time tracing",
    body: "A live waterfall of every request — spans, timings and parent/child relationships as they happen.",
  },
  {
    icon: ScrollText,
    title: "Wide-event logs",
    body: "Logs auto-linked to the active trace. Add context once and see it on every log in the request.",
  },
  {
    icon: FlaskConical,
    title: "API playground",
    body: "Fire requests at your own endpoints in a multi-tab client — no Postman, no context switch.",
  },
  {
    icon: ShieldCheck,
    title: "Schema-aware",
    body: "Request templates auto-generated from your Zod, Valibot or Standard Schema validators.",
  },
  {
    icon: Share2,
    title: "OpenTelemetry export",
    body: "Ship the same traces over OTLP/HTTP to Grafana, Honeycomb, Datadog or an OTel Collector.",
    badge: "new",
  },
];

const WITHOUT = [
  {
    icon: Boxes,
    title: "Without the rewrite",
    body: "Some tools give you a dashboard — but only if you rebuild your app on their framework. Vision is just middleware on the app you already have.",
  },
  {
    icon: Cable,
    title: "Without the wiring",
    body: "Raw OpenTelemetry means an SDK, a collector and a backend before you see a single span. Vision works the moment you add it.",
  },
  {
    icon: KeyRound,
    title: "Without the lock-in",
    body: "Self-hosted and MIT-licensed. Develop locally, then export to whatever production backend you already run.",
  },
];

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-400 uppercase">
      {children}
    </span>
  );
}

export function Below() {
  return (
    <>
      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <motion.div {...reveal} className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to see inside your API
          </h2>
          <p className="mt-4 text-fd-muted-foreground text-pretty">
            One dashboard for traces, logs and testing — wired into your
            framework, not bolted on.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              {...reveal}
              transition={{ ...reveal.transition, delay: i * 0.05 }}
              className="group relative rounded-xl border border-fd-border bg-fd-card/50 p-6 transition hover:border-emerald-500/40 hover:bg-fd-card"
            >
              <div className="mb-4 inline-flex rounded-lg border border-fd-border bg-fd-background p-2.5 text-emerald-400 transition group-hover:border-emerald-500/40">
                <f.icon className="size-5" />
              </div>
              <h3 className="flex items-center gap-2 font-semibold">
                {f.title}
                {f.badge && <Badge>{f.badge}</Badge>}
              </h3>
              <p className="mt-2 text-sm text-fd-muted-foreground text-pretty">
                {f.body}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Why / without */}
      <section className="relative mx-auto max-w-6xl px-4 py-20">
        <motion.div {...reveal} className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Observability without the tradeoff
          </h2>
          <p className="mt-4 text-fd-muted-foreground text-pretty">
            The usual options ask you to give something up. Vision doesn&apos;t.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {WITHOUT.map((w, i) => (
            <motion.div
              key={w.title}
              {...reveal}
              transition={{ ...reveal.transition, delay: i * 0.07 }}
              className="rounded-xl border border-fd-border bg-fd-card/50 p-6"
            >
              <w.icon className="size-6 text-emerald-400" />
              <h3 className="mt-4 font-semibold">{w.title}</h3>
              <p className="mt-2 text-sm text-fd-muted-foreground text-pretty">
                {w.body}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div {...reveal} className="mt-8 text-center">
          <Link
            href="/docs/why-vision"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400 hover:text-emerald-300"
          >
            See how Vision compares
            <ArrowRight className="size-4" />
          </Link>
        </motion.div>
      </section>

      {/* Final CTA */}
      <section className="px-4 pb-24">
        <motion.div
          {...reveal}
          className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl border border-fd-border bg-fd-card/50 px-6 py-16 text-center"
        >
          <div className="pointer-events-none absolute -top-24 left-1/2 h-[260px] w-[600px] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-[110px]" />
          <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Ready to see what your API is doing?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-fd-muted-foreground text-pretty">
            Add Vision in two lines and open the dashboard. No signup, no agent,
            no data leaving your machine.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/docs/quickstart"
              className="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:shadow-emerald-500/40"
            >
              Get started
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="https://github.com/ephor/vision"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-fd-border bg-fd-background px-6 py-3 font-semibold transition hover:bg-fd-accent"
            >
              View on GitHub
            </Link>
          </div>
        </motion.div>
      </section>
    </>
  );
}
