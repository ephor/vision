"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Star } from "lucide-react";
import { BeamsBg } from "./beams-bg";

const FRAMEWORKS = ["Express", "Fastify", "Hono", "Elysia", "Next.js"];

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden px-4 pt-24 pb-20 sm:pt-32">
      {/* Animated WebGL beams */}
      <BeamsBg />

      {/* Static background (shown when beams are off, e.g. reduced motion) */}
      <div className="pointer-events-none absolute inset-0 -z-20">
        <div className="grid-fade-mask absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,var(--color-fd-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-fd-border)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="absolute -top-40 left-1/2 h-[460px] w-[860px] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-[130px]" />
        <div className="absolute top-40 -right-24 h-[320px] w-[320px] rounded-full bg-teal-500/10 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mx-auto max-w-3xl text-center"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-card/60 px-3 py-1 text-xs font-medium text-fd-muted-foreground backdrop-blur">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Open source · Self-hosted · MIT
        </span>

        <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-6xl">
          Drop-in{" "}
          <span className="animate-aurora bg-clip-text text-transparent [background-image:linear-gradient(90deg,#6ee7b7,#2dd4bf,#34d399,#6ee7b7)]">
            observability
          </span>{" "}
          for your TypeScript API
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg text-fd-muted-foreground text-pretty">
          Vision auto-generates a full dashboard for the Express, Fastify, Hono
          or Elysia app you already have — routes, traces, logs and an API
          playground. Two lines of code, zero config.
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
            className="inline-flex items-center gap-2 rounded-lg border border-fd-border bg-fd-card/60 px-6 py-3 font-semibold backdrop-blur transition hover:bg-fd-accent"
          >
            <Star className="size-4 text-amber-400" />
            Star on GitHub
          </Link>
        </div>

        <p className="mt-6 text-sm text-fd-muted-foreground">
          <span className="font-mono text-emerald-400">{">"}</span> Develop
          locally, then ship the same traces to any{" "}
          <span className="font-medium text-fd-foreground">OpenTelemetry</span>{" "}
          backend.
        </p>
      </motion.div>

      {/* Supported frameworks */}
      <div className="mx-auto mt-16 max-w-3xl">
        <p className="mb-5 text-center text-xs font-medium tracking-widest text-fd-muted-foreground uppercase">
          Works with the stack you already run
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {FRAMEWORKS.map((name) => (
            <span
              key={name}
              className="rounded-lg border border-fd-border bg-fd-card/60 px-5 py-2 text-sm font-medium text-fd-muted-foreground backdrop-blur"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
