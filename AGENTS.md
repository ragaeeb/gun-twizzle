# AGENTS.md

## Purpose

This repository is a browser FPS built with Bun, Vite, React, React Three Fiber, Rapier, TypeScript, Biome, and Vitest. Keep changes pragmatic, composable, and easy to extend.

## Package Manager

- Bun is the preferred package manager.
- Use `bun install`, `bun run`, and `bunx` by default.
- In `package.json` scripts, use `bunx` instead of `npx` for executing package binaries.
- Only use `npm` or `npx` if a dependency or tool is genuinely blocked on Bun.

## Code Conventions

- Prefer arrow functions over classic function declarations.
  - Exception: use a classic class/component form only when the API requires it, such as React error boundaries or declaration patterns that cannot be expressed cleanly otherwise.
- Prefer `type` over `interface`.
  - Exception: use `interface` only when declaration merging or a class contract is genuinely required.
- Maximum cognitive complexity per function: `15`.
  - If a function exceeds that, decompose it immediately.
- Avoid large files.
  - Any file approaching `500` LOC should be split before it grows further.
- Prefer small, explicit modules over catch-all utility files.
- Prefer type-only imports where possible.
- Avoid `any`. If you must use it temporarily, isolate it and leave a clear follow-up note.

## Architecture Rules

- Keep `src/sim/**` headless and framework-free.
  - No React, no Three.js scene objects, no DOM access.
- Keep runtime orchestration in `src/runtime/**` (engine, player, input, physics wrappers, combat helpers).
- Keep rendering concerns in `src/render/**` and UI concerns in `src/ui/**`.
- Keep the UI bridge narrow.
  - Do not mirror the whole simulation state into React state stores.
- Do not call React `setState` inside `useFrame`.
- Keep visual-only effects out of the authoritative simulation.
- Prefer data-driven definitions for weapons, levels, enemies, pickups, and status effects.

## Repo Map (Quick Orientation)

- `src/app` — app shell and lifecycle wiring (Canvas, runtime init, overlays).
- `src/runtime` — gameplay runtime (engine, player, weapons, input, physics wrappers).
- `src/render` — Three.js/R3F rendering (scene, effects, entities, debug overlays).
- `src/ui` — DOM HUD and overlays.
- `src/sim` — headless sim (ECS-like data, systems, events).
- `src/assets` — asset registry, loaders, and runtime asset managers.
- `src/content` — data-driven definitions (levels, enemies, weapons, pickups).
- `src/net` + `server` — multiplayer protocol/session + Bun server (optional).

## Debugging Tips

- `?perf=1` enables the `r3f-perf` overlay (dev only).
- `?e2e` (or `import.meta.env.DEV`) exposes `window.__gtDebug` helpers from the runtime.
- Pointer lock issues usually live in `src/app/PointerLockOverlay.tsx` or `src/runtime/input.ts`.
- Asset loading and decoder setup live in `src/assets/loaders.ts` and `src/assets/registry.ts`.

## Performance Rules

- Measure before optimizing deep internals.
- Optimize the obvious hotspots first:
  - render-loop re-renders
  - draw calls
  - texture memory
  - physics/query costs
  - asset loading and decode paths
- Reuse Three.js resources when identity matters.
- Avoid per-frame allocations in hot paths when a simple non-allocating alternative is available.

## Testing

- Add or update tests when changing pure logic, math, clocks, event flow, collision rules, or content validation.
- Prefer small, high-value tests over broad snapshot coverage.
- Test the contract, not incidental implementation details.
- E2E tests are split into two tiers:
  - **`test:e2e`** — lightweight smoke tests that run quickly and are safe for regular development.
  - **`test:e2e:full`** (or `test:memory`, `test:soak`) — expensive performance/memory regression tests. Reserve these for major milestone releases. They spawn a headless browser for extended periods and are CPU-intensive.

## Assets

- Treat runtime asset paths as part of the build pipeline, not ad hoc strings scattered through the codebase.
- Keep fixed-path files in `public/` only when they truly need stable names.
- Prefer clearly licensed asset sources with low legal ambiguity.
- Use `src/assets/registry.ts` as the canonical source for runtime asset URLs.
- Weapon marker JSON files must be wired via `WeaponDefinition.markerPath` (typically from `AssetRegistry.weapons.*.markers`).
  - Do not derive marker JSON paths by replacing `.glb` extensions at runtime; hashed build outputs will not match.

## Tooling

- Keep Biome focused on correctness and maintainability, not stylistic ideology.
- Keep TypeScript strict.
- Prefer current stable versions of core tooling unless there is a demonstrated compatibility issue.

## Build Budgets

- `bun run build` runs `scripts/check-budgets.ts`.
- Current limits: max single asset 21 MB, total `dist/assets` 100 MB.
- If a new asset exceeds limits, optimize the asset first, then adjust budgets only if necessary.

## Multiplayer Architecture

- The game supports an **offline** (single-player) and **online** (multiplayer) mode.
- Mode is determined by the `VITE_MULTIPLAYER_URL` environment variable:
  - **Not set** → pure offline. No WebSocket code is executed. Safe for serverless (Vercel).
  - **Set** (e.g. `ws://localhost:3001`) → online. Client connects to the Bun WS server.
- The dedicated game server lives in `server/` and runs with `bun run server/main.ts`.
  - It is a standalone Bun process, never bundled with the Vite client build.
  - It imports headless sim modules from `src/sim/` and content from `src/content/`.
- Network code lives in `src/net/`. The `NetSession` is the sole integration point with `GameEngine`.
- In online mode the server is authoritative for combat (hits, damage, kills).
  Client-side prediction handles local movement; reconciliation corrects drift.
- Keep `server/` and `src/net/` independent from React and Three.js rendering.
- Serialization is JSON for now. Only switch to binary if profiling shows JSON as a bottleneck.

## Change Discipline

- Preserve existing architecture boundaries unless there is a clear reason to change them.
- Avoid feature creep in foundational milestones.
- If a proposed change increases scope significantly, note the tradeoff explicitly before doing it.
