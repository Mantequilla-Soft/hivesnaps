# Adding a native (non-Expo-Go) library to hivesnaps

hivesnaps runs on a **custom Expo dev client** (`expo-dev-client`), not Expo Go, and
commits its native `ios/` and `android/` folders. That means any React Native library
with native (Swift/ObjC/Kotlin/Java) code can be added — it isn't restricted to Expo's
Expo-Go-compatible module list. The tradeoff: adding or changing a native library always
requires a full native rebuild of the dev client, not just a JS reload.

This doc walks through the steps using the real example of adding
[`@mantequilla-soft/cuarenta`](https://github.com/Mantequilla-Soft/cuarenta), a native
Fabric view (SpriteKit-backed on iOS) — plus the gotchas hit along the way.

## 1. Install the package

Same as any npm dependency:

```
npm install <package-name>
```

If the library is published to a **scoped registry** other than the default npm registry
(e.g. GitHub Packages, as with `@mantequilla-soft/*`), the project needs a `.npmrc`
mapping that scope to the right registry, plus an auth token — GitHub Packages requires
authentication to install even for public packages:

```ini
# .npmrc (safe to commit — no secret in it)
@mantequilla-soft:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Each developer (and CI) needs a `GITHUB_TOKEN` env var set locally with at least
`read:packages` scope on a GitHub PAT. **Never commit the literal token** — only the
`${GITHUB_TOKEN}` placeholder belongs in the repo.

## 2. Link the native code

```
cd ios && pod install
```

Autolinking (via `expo-modules-autolinking`, which wraps standard RN community
autolinking) picks up any package with a valid podspec/`build.gradle` automatically —
no manual registration needed for either platform.

## 3. Rebuild the dev client

Native code changes are invisible to Fast Refresh. After installing or updating a native
dependency, do a full rebuild:

```
npx expo run:ios
npx expo run:android
```

## 4. Use it

Import and render like any other component:

```tsx
import { CuarentaView } from '@mantequilla-soft/cuarenta';

<CuarentaView color="#32a852" style={{ width: 200, height: 200 }} />
```

## Developing against an unpublished library (local `file:` dependency)

While a native library is still under active development and not yet published, you can
link it locally instead:

```
npm install ../path-to-library
```

This works, but Metro needs extra configuration because the linked package lives
**outside** the project root:

```js
// metro.config.js
const path = require('path');
const libRoot = path.resolve(__dirname, '../path-to-library');

config.watchFolders = [...(config.watchFolders || []), libRoot];

// The linked library ships its own node_modules (react/react-native, for its own
// example app) — without blocking these, Metro tries to bundle a second copy of
// react-native and gets confused running RN's own codegen against it.
config.resolver.blockList = [
  ...existingBlockList,
  new RegExp(`${libRoot}/node_modules/.*`),
  new RegExp(`${libRoot}/example/.*`), // or wherever its own example app lives
];

config.resolver.extraNodeModules = {
  react: path.resolve(__dirname, 'node_modules/react'),
  'react-native': path.resolve(__dirname, 'node_modules/react-native'),
};
```

**Remove all of this once the library is published for real** and installed as a normal
registry dependency — none of it is needed at that point, and leaving it in is just
confusing dead weight.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Unable to resolve module <lib> ... could not be found within the project or in these directories: node_modules` | Metro doesn't know about a locally-symlinked package outside the project root | Add its path to `config.watchFolders` |
| `Unable to determine event arguments for "..."` (codegen babel error, pointing into `<lib>/node_modules/react-native/...`) | Metro is bundling the linked library's own (differently-versioned) copy of react-native | Add `<lib>/node_modules/.*` to `config.resolver.blockList` and set `extraNodeModules` to force resolution to the host app's react/react-native |
| `401 Unauthorized ... unauthenticated: User cannot be authenticated` on install | Missing/invalid GitHub Packages auth token | Confirm `GITHUB_TOKEN` is set and has `read:packages`; `npm whoami --registry=<registry>` to verify |
| Stale/wrong bundle after switching a dependency between local `file:` and a published version | Metro cache | Restart Metro with `--clear` |
| Native code change has no effect | Fast Refresh doesn't reload native code | Full rebuild: `npx expo run:ios` / `npx expo run:android` |
