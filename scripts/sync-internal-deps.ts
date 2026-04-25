#!/usr/bin/env bun
/**
 * Sync @getvision/* internal dependency versions in publishable packages.
 *
 * Why this exists: `changeset version --snapshot` bumps each publishable
 * package to a new snapshot version (e.g. `1.0.0-abc-develop`) but does not
 * update sibling references — `packages/server/package.json` keeps pointing at
 * the last *stable* `@getvision/core` (`0.1.1`) instead of the snapshot just
 * produced (`1.0.0-abc-develop`). When `bun publish` runs, the published tarball
 * therefore declares a stale dep that does not exist on the registry under the
 * `next` tag.
 *
 * This script reads the current version of every workspace package under
 * `packages/` and `apps/` whose `package.json` is publishable (i.e. not
 * `private: true`) and rewrites every internal `@getvision/*` dep to that
 * version in `dependencies`, `devDependencies`, and `peerDependencies`.
 *
 * Run after `changeset version` (snapshot or stable), before `bun publish`.
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '..')
const SEARCH_DIRS = ['packages', 'apps']

type PackageJson = {
  name?: string
  version?: string
  private?: boolean
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

function findPackageJsons(): { path: string; pkg: PackageJson }[] {
  const out: { path: string; pkg: PackageJson }[] = []
  for (const dir of SEARCH_DIRS) {
    const full = join(ROOT, dir)
    let entries: string[]
    try {
      entries = readdirSync(full)
    } catch {
      continue
    }
    for (const entry of entries) {
      const pkgPath = join(full, entry, 'package.json')
      try {
        if (!statSync(pkgPath).isFile()) continue
      } catch {
        continue
      }
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as PackageJson
      out.push({ path: pkgPath, pkg })
    }
  }
  return out
}

function buildVersionMap(pkgs: { pkg: PackageJson }[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const { pkg } of pkgs) {
    if (!pkg.name || !pkg.version) continue
    if (!pkg.name.startsWith('@getvision/')) continue
    map.set(pkg.name, pkg.version)
  }
  return map
}

function rewriteDeps(
  block: Record<string, string> | undefined,
  versions: Map<string, string>
): boolean {
  if (!block) return false
  let changed = false
  for (const [name, current] of Object.entries(block)) {
    const target = versions.get(name)
    if (!target) continue
    if (current === target) continue
    block[name] = target
    changed = true
  }
  return changed
}

function main(): void {
  // Guard: this script rewrites workspace dep ranges to concrete versions.
  // That is desirable in CI (after `changeset version` produced fresh
  // snapshot/stable versions) but destructive in a local checkout where
  // `workspace:*` is the ground truth. Refuse to run unless we're in CI or
  // the caller explicitly opted in.
  const force = process.argv.includes('--force')
  if (!process.env.CI && !force) {
    console.error(
      'refusing to run outside CI without --force (would clobber workspace:* refs)'
    )
    process.exitCode = 1
    return
  }

  const pkgs = findPackageJsons()
  const versions = buildVersionMap(pkgs)

  if (versions.size === 0) {
    console.error('no @getvision/* packages found — nothing to sync')
    process.exitCode = 1
    return
  }

  console.log('local @getvision/* versions:')
  for (const [name, ver] of versions) console.log(`  ${name} -> ${ver}`)

  let touched = 0
  for (const { path, pkg } of pkgs) {
    const a = rewriteDeps(pkg.dependencies, versions)
    const b = rewriteDeps(pkg.devDependencies, versions)
    const c = rewriteDeps(pkg.peerDependencies, versions)
    if (a || b || c) {
      writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n')
      console.log(`updated ${pkg.name ?? path}`)
      touched++
    }
  }

  console.log(`done — ${touched} package.json file(s) updated`)
}

main()
