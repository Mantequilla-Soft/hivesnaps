# iOS Build Checklist

Use this checklist when preparing a new App Store or TestFlight build.

## Version Bump

1. Update `expo.version` in `app.json`.
2. Update `expo.ios.buildNumber` in `app.json`.
3. Keep `package.json`, `package-lock.json`, and the README version badge aligned with the release version.

For this project, `eas.json` uses `appVersionSource: "remote"` and production `autoIncrement: true`, so EAS may also increment remote store build metadata. The local `app.json` values should still be bumped for source control and native project regeneration.

## Regenerate Native iOS Project

```sh
npx expo prebuild --platform ios --clean
```

Run this after dependency or config changes that affect native iOS files.

## Validate Config

```sh
npx expo config --type public
npx tsc --noEmit
```

## Build iOS

For a production App Store/TestFlight IPA:

```sh
npx eas build --platform ios --profile production --local --non-interactive
```

If local signing or credentials are unavailable, run the cloud build instead:

```sh
npx eas build --platform ios --profile production --non-interactive
```

If the build reports that the provisioning profile has expired, repair iOS credentials interactively:

```sh
npx eas credentials -p ios
```

Then rerun the build. For non-interactive builds, Expo requires an App Store Connect API key to regenerate or repair expired provisioning profiles.

## Submit

```sh
npx eas submit --platform ios --profile production --latest --non-interactive
```
