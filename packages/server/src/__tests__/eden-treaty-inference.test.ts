/**
 * Regression test pinning down the Eden Treaty inference contract for
 * `createModule`-based Vision apps.
 *
 * Background — verified empirically against `@getvision/server@1.0.1` consumed
 * by the kodjin-analytics codebase (Elysia 1.4.28, @elysia/eden 1.4.10, TS
 * 5.9.3):
 *
 * The 1.0.1 `createModule` signature was non-generic:
 *
 *     export function createModule(opts?: { prefix?: string }) {
 *       return new Elysia({ prefix: opts?.prefix }).decorate(...)...
 *     }
 *
 * Because `prefix` was widened to `string`, every module's `Elysia` static
 * type was `Elysia<string, ...>` — Eden Treaty had no way to discriminate
 * which module owned which path, and the body / query schemas of same-depth
 * routes (e.g. all `.post('/')` calls) collapsed: `apiClient.queries.post`,
 * `apiClient.dashboards.post`, `apiClient.folders.post` all resolved to a
 * single shared body type instead of each route's own schema.
 *
 * The fix (commit 002b468) turned the prefix into a const generic:
 *
 *     export function createModule<const Prefix extends string = ''>(
 *       opts?: { prefix?: Prefix }
 *     ) {
 *       return new Elysia<Prefix>({ prefix: opts?.prefix }).decorate(...)...
 *     }
 *
 * The `.decorate()` chain was preserved — the original ADR theory that the
 * function-body wrapper itself caused widening turned out to be incomplete:
 * the widened `prefix: string` was the actual culprit. After the fix, prefix
 * literals (`/foos`, `/bars`) propagate into the Elysia type and Eden Treaty
 * disambiguates per-route schemas correctly.
 *
 * What this test enforces:
 *   1. Each route's body type EQUALS its own schema (no widening).
 *   2. Distinct same-depth routes have DISTINCT body types — protects against
 *      the exact "stomp" mode observed pre-fix where all routes ended up with
 *      one shared body shape.
 *
 * If a future change to `createModule` (or an upstream Elysia / Eden version
 * bump) regresses either property, `bun run typecheck:test` fails at CI.
 */

import { describe, expect, test } from 'bun:test'
import { treaty } from '@elysia/eden'
import Elysia from 'elysia'
import { z } from 'zod'

import { createModule } from '../vision-app'

// ---------------------------------------------------------------------------
// Type-level helpers (compile-time assertions)
// ---------------------------------------------------------------------------

type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false

type Expect<T extends true> = T

// `true` if `Body` equals `Expected` exactly. `false` if it widened (e.g. into
// an intersection with sibling-route bodies).
type BodyMatches<Body, Expected> = Equal<Body, Expected>

// ---------------------------------------------------------------------------
// Fixture: two modules with DISTINCT body schemas at the same depth
// ---------------------------------------------------------------------------

const FoosBody = z.object({
  fooName: z.string(),
  fooCount: z.number(),
})
type FoosBody = z.infer<typeof FoosBody>

const BarsBody = z.object({
  barLabel: z.string(),
  barEnabled: z.boolean(),
})
type BarsBody = z.infer<typeof BarsBody>

const foosModule = createModule({ prefix: '/foos' }).post(
  '/',
  ({ body }) => ({ created: body.fooName }),
  { body: FoosBody }
)

const barsModule = createModule({ prefix: '/bars' }).post(
  '/',
  ({ body }) => ({ created: body.barLabel }),
  { body: BarsBody }
)

// Compose at root (mimicking real consumer: createVision().use(...).use(...))
// We use a bare `new Elysia()` here instead of `createVision` to keep the test
// dependency-free and focused on the createModule boundary.
const app = new Elysia().use(foosModule).use(barsModule)

type AppType = typeof app

// ---------------------------------------------------------------------------
// Type-level assertions (these MUST compile)
// ---------------------------------------------------------------------------

const apiClient = treaty<AppType>('http://localhost')

// Extract the body input parameter of each .post() on the Eden client.
//
// Eden Treaty signature: `post(body, options?) => Promise<...>`. The first
// parameter is the body. If the createModule bug is present, this type
// becomes `FoosBody & BarsBody` for BOTH calls.
type FoosPostBody = Parameters<typeof apiClient.foos.post>[0]
type BarsPostBody = Parameters<typeof apiClient.bars.post>[0]

// THE assertion. If these flip to `false`, Eden inference is broken.
//
// Note: Eden may decorate the body with a few internal fields (e.g. a
// `$` symbol or formdata helpers). We only care that the user-facing fields
// of the body match the route's schema — so we check key compatibility via
// assignability rather than strict equality.

// 1. `FoosBody` must be assignable to `FoosPostBody` (route accepts its own body).
const _foosAcceptsOwnBody: FoosBody = {} as FoosPostBody
void _foosAcceptsOwnBody

const _barsAcceptsOwnBody: BarsBody = {} as BarsPostBody
void _barsAcceptsOwnBody

// 2. The CRITICAL one: `FoosBody` alone (without bar fields) must be a valid
// input for the foos endpoint. If types merged into intersection, you'd be
// forced to also supply `barLabel` + `barEnabled`, and this assignment would
// fail to compile.
const _foosBodyIsSufficient: FoosPostBody = {
  fooName: 'x',
  fooCount: 1,
} as FoosBody
void _foosBodyIsSufficient

const _barsBodyIsSufficient: BarsPostBody = {
  barLabel: 'y',
  barEnabled: true,
} as BarsBody
void _barsBodyIsSufficient

// 3. Negative check: `FoosBody` must NOT require `barLabel`. Construct a body
// with only foo fields — no `as` cast. If intersection-merge regression
// happens, TS will reject this literal because `barLabel` and `barEnabled`
// are missing.
const _foosLiteralWithoutBarFields: FoosPostBody = {
  fooName: 'x',
  fooCount: 1,
}
void _foosLiteralWithoutBarFields

const _barsLiteralWithoutFooFields: BarsPostBody = {
  barLabel: 'y',
  barEnabled: true,
}
void _barsLiteralWithoutFooFields

// 4. Positive equality probe (paranoia): under healthy inference, both checks
// below are `true`. They're declared as type aliases so any regression shows
// up as a "Type 'false' is not assignable to type 'true'" error on the
// `Expect<...>` line.
type _FoosBodyShape = Expect<BodyMatches<FoosPostBody, FoosBody>>
type _BarsBodyShape = Expect<BodyMatches<BarsPostBody, BarsBody>>

// 5. Cross-route distinctness: this is the assertion that catches the
// pre-fix "stomp" mode (every depth-1 POST resolved to a single shared
// body shape). If the prefix generic is ever removed, FoosPostBody and
// BarsPostBody collapse to the same type and `Equal<...>` flips to `true`,
// so we assert it must be `false`.
type Not<T extends boolean> = T extends true ? false : true
type _DistinctBodies = Expect<Not<Equal<FoosPostBody, BarsPostBody>>>

// Reference the aliases so unused-locals rules don't strip them.
type _Probes = [_FoosBodyShape, _BarsBodyShape, _DistinctBodies]
const _probes = null as unknown as _Probes
void _probes

// ---------------------------------------------------------------------------
// Runtime smoke test
// ---------------------------------------------------------------------------

describe('createModule + Eden Treaty inference', () => {
  test('foos route accepts its own body shape at runtime', async () => {
    const res = await app.handle(
      new Request('http://localhost/foos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fooName: 'a', fooCount: 1 }),
      })
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ created: 'a' })
  })

  test('bars route accepts its own body shape at runtime', async () => {
    const res = await app.handle(
      new Request('http://localhost/bars', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ barLabel: 'b', barEnabled: true }),
      })
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ created: 'b' })
  })
})
