"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Star, Terminal } from "lucide-react";

const FRAMEWORKS = ["Express", "Fastify", "Hono", "Elysia", "Next.js"];

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden px-4 pt-20 pb-16 sm:pt-28">
      {/* Background: grid + glow blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="grid-fade-mask absolute inset-0 opacity-60 [background-image:linear-gradient(to_right,var(--color-fd-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-fd-border)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="absolute -top-40 left-1/2 h-[460px] w-[860px] -translate-x-1/2 rounded-full bg-violet-500/20 blur-[130px]" />
        <div className="absolute top-24 -left-24 h-[300px] w-[300px] rounded-full bg-fuchsia-500/15 blur-[100px] [animation:float-slow_9s_ease-in-out_infinite]" />
        <div className="absolute top-40 -right-24 h-[320px] w-[320px] rounded-full bg-indigo-500/15 blur-[100px] [animation:float-slow_11s_ease-in-out_infinite]" />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
        {/* Left: copy */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center lg:text-left"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-card/60 px-3 py-1 text-xs font-medium text-fd-muted-foreground backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-500" />
            </span>
            Open source · Self-hosted · MIT
          </span>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-6xl">
            Drop-in{" "}
            <span className="animate-aurora bg-clip-text text-transparent [background-image:linear-gradient(90deg,#c4b5fd,#818cf8,#e879f9,#c4b5fd)]">
              observability
            </span>{" "}
            for your TypeScript API
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg text-fd-muted-foreground text-pretty lg:mx-0">
            Add live traces, logs, and an API playground to the Express,
            Fastify, Hono or Elysia app you already have. Two lines of code — no
            rewrite, no vendor lock-in.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
            <Link
              href="/docs/quickstart"
              className="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:shadow-violet-600/40"
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

          <p className="mt-6 text-sm text-fd-muted-foreground lg:text-left">
            <span className="font-mono text-violet-400">{">"}</span> Develop
            locally, then ship the same traces to any{" "}
            <span className="font-medium text-fd-foreground">
              OpenTelemetry
            </span>{" "}
            backend.
          </p>
        </motion.div>

        {/* Right: code card */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
          className="beam-border rounded-xl"
        >
          <div className="overflow-hidden rounded-xl border border-fd-border bg-fd-card/80 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="flex items-center gap-2 border-b border-fd-border px-4 py-3">
              <span className="size-3 rounded-full bg-red-400/80" />
              <span className="size-3 rounded-full bg-amber-400/80" />
              <span className="size-3 rounded-full bg-green-400/80" />
              <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-fd-muted-foreground">
                <Terminal className="size-3.5" />
                server.ts
              </span>
            </div>
            <pre className="overflow-x-auto p-5 text-sm leading-relaxed">
              <code className="font-mono">
                <span className="text-fd-muted-foreground">
                  {"// 1. add the adapter"}
                </span>
                {"\n"}
                <span className="text-fuchsia-400">import</span>
                <span className="text-fd-foreground">
                  {" { visionAdapter } "}
                </span>
                <span className="text-fuchsia-400">from</span>
                <span className="text-emerald-400">
                  {" '@getvision/adapter-express'"}
                </span>
                {"\n\n"}
                <span className="text-fd-muted-foreground">
                  {"// 2. mount it on the app you already have"}
                </span>
                {"\n"}
                <span className="text-fd-foreground">app.</span>
                <span className="text-violet-400">use</span>
                <span className="text-fd-foreground">(</span>
                <span className="text-violet-400">visionAdapter</span>
                <span className="text-fd-foreground">({"{ "}</span>
                <span className="text-sky-400">port</span>
                <span className="text-fd-foreground">: </span>
                <span className="text-amber-400">9500</span>
                <span className="text-fd-foreground">{" }))"}</span>
                {"\n\n"}
                <span className="text-violet-400">✦</span>
                <span className="text-fd-muted-foreground">
                  {" dashboard live at "}
                </span>
                <span className="text-emerald-400">localhost:9500</span>
              </code>
            </pre>
          </div>
        </motion.div>
      </div>

      {/* Supported frameworks */}
      <div className="mx-auto mt-16 max-w-3xl">
        <p className="mb-5 text-center text-xs font-medium tracking-widest text-fd-muted-foreground uppercase">
          Works with the stack you already run
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {FRAMEWORKS.map((name) => (
            <span
              key={name}
              className="rounded-lg border border-fd-border bg-fd-card/50 px-5 py-2 text-sm font-medium text-fd-muted-foreground"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
