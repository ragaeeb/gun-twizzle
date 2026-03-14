# Gun Twizzle

![Bun](https://img.shields.io/badge/bun-1.3.10-14151A?logo=bun&logoColor=white) ![Vite](https://img.shields.io/badge/vite-7.x-646CFF?logo=vite&logoColor=white) ![React](https://img.shields.io/badge/react-19-61DAFB?logo=react&logoColor=black) ![Three.js](https://img.shields.io/badge/three.js-0.183-000000?logo=three.js&logoColor=white) ![TypeScript](https://img.shields.io/badge/typescript-5.9-3178C6?logo=typescript&logoColor=white) ![License](https://img.shields.io/badge/license-MIT-2F8132)

Gun Twizzle is a browser FPS prototype built with Bun, Vite, React Three Fiber, Rapier, and TypeScript. The architecture keeps simulation headless, rendering isolated, and UI decoupled so new features can be layered on without breaking core systems.

## Quickstart
1. `bun install`
2. `bun dev`

## Scripts
- `bun run build` — typecheck, build, and enforce asset budgets.
- `bun run build:prod` — run asset optimizer, typecheck, and build.
- `bun run lint` — run Biome checks.
- `bun run test` — run Vitest.
- `bun run test:e2e` — Playwright smoke suite.
- `bun run test:e2e:full` — full Playwright suite (slow).

## Repo Structure
- `src/app` — app shell, session lifecycle, runtime wiring.
- `src/runtime` — gameplay runtime (engine, player, input, physics wrappers, combat helpers).
- `src/render` — R3F rendering (scene, effects, entities, debug overlays).
- `src/ui` — DOM HUD and overlays.
- `src/sim` — headless sim systems and data structures.
- `src/assets` — asset registry, loader setup, runtime asset managers.
- `src/content` — data-driven content (levels, enemies, weapons, pickups).
- `src/net` — multiplayer protocol and client session.
- `server` — Bun multiplayer server (optional, not bundled with client).
- `e2e` — Playwright test suites.
- `docs` — plans, reviews, baselines, and milestones.

## Architecture Notes
- Keep `src/sim/**` framework-free and deterministic.
- Rendering lives in `src/render/**`, UI in `src/ui/**`, runtime orchestration in `src/runtime/**`.
- Avoid React `setState` inside `useFrame`.
- Use `src/assets/registry.ts` as the single source of runtime asset URLs.

## Multiplayer Mode
- Offline by default.
- Set `VITE_MULTIPLAYER_URL` to enable online mode. Use `/server` with `bun run server/main.ts`.

## Assets
- `public/` only for fixed-path assets (favicon, decoders if required).
- Budget checks run during `bun run build` (`scripts/check-budgets.ts`).

## Testing
- Unit tests live under `src/**/__tests__` and `tests/`.
- E2E tests live under `e2e/`.

## Debugging
- `?perf=1` enables `r3f-perf` overlay (dev only).
- `?e2e` exposes `window.__gtDebug` helpers.
- Pointer lock issues usually involve `src/app/PointerLockOverlay.tsx` and `src/runtime/input.ts`.
