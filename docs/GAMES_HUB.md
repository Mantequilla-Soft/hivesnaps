# Games Hub: design decision

## Context

PR #239 introduced a single entry point to one native game, Cuarenta (`40`), via
`@mantequilla-soft/cuarenta`: a gamepad icon in the feed header opened `GameScreen`, which
rendered the game view directly.

More games are planned for Snapie, so a one-icon-one-game entry doesn't scale.

## Decision

Introduce a **Games hub** and a **route per game**, driven by a small registry.

```
Feed header 🎮  ->  GamesHubScreen  ->  games/<Game>Screen
                        ^
                  config/games.ts (registry)
```

- `config/games.ts` — `GAMES` array of `{ id, title, description, icon, route, platforms }`.
- `app/screens/GamesHubScreen.tsx` — lists the registry; games not available on the current
  platform are greyed out and not tappable.
- `app/screens/games/CuarentaScreen.tsx` — the original `GameScreen`, moved. Each game owns
  its own screen, so game-specific UI and native views never leak into the hub.
- The header icon sits next to Search and is hidden when no game is available on the
  platform.

## Why

- **One entry, many games.** The header gets a single stable icon regardless of how many
  games ship. Adding a game is a registry entry plus a route, with no header changes.
- **Per-platform gating in one place.** Cuarenta's native view is a SpriteKit scene on iOS;
  the Android view is an empty stub and the JS fallback for other platforms throws. Rather
  than scattering `Platform.OS` checks through screens, each game declares `platforms` and
  the hub and header read it. Flip a game to Android by adding `'android'` once its native
  implementation is real.
- **Isolation.** Native game libraries differ in lifecycle, sizing and events. A route per
  game keeps that contained and lets games be removed or feature-flagged independently.
- **Keeps the original work.** The dependency, `.npmrc`, route registration and native-module
  doc from the original PR are unchanged; only the screen was moved and the entry re-pointed.

## Alternatives considered

- **Keep one `GameScreen` that switches on a game id.** Simple at first, but it grows into a
  large conditional screen and imports every game's native module in one place.
- **One header icon per game.** Doesn't scale, and clutters an already full header.
- **Close the PR and start fresh.** Most of the PR (dependency, registry setup, docs) was
  reusable; a refactor on top preserved history and review context.

## Adding a game

1. Create `app/screens/games/<Name>Screen.tsx`.
2. Register it in `app/_layout.tsx` as `screens/games/<Name>Screen`.
3. Add an entry to `GAMES` in `config/games.ts` with the route and supported `platforms`.

See also `docs/ADDING_NATIVE_MODULES.md` for installing the native library itself.

## Known limitations / follow-ups

- Cuarenta is currently a spinning-square scaffold, not a playable game, and iOS-only.
- Installing `@mantequilla-soft/cuarenta` needs `GITHUB_TOKEN` locally and as an EAS/CI secret.
- `ios/` isn't committed; it's generated with `npx expo prebuild --platform ios`.
- Expo Router's typed routes need regenerating (run `npx expo start` once) for new routes.
