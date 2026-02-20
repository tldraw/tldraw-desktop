# tldraw desktop

This repository hosts releases for the tldraw desktop app. Source code and development happen in the internal monorepo (`tldraw-internal`).

## How releases work

1. The desktop app source lives in `tldraw-internal/apps/public/desktop/`
2. Builds are triggered via the `release` workflow in this repo (manually or via `repository_dispatch`)
3. `electron-builder` builds the app and publishes artifacts as GitHub Releases here
4. `electron-updater` in the app checks this repo's releases for auto-updates

## Triggering a release

### From GitHub Actions UI

Go to **Actions > Release > Run workflow** and select a version bump type (patch, minor, major).

### From the internal repo

```bash
# Trigger a release from tldraw-internal
gh workflow run release.yml --repo tldraw/tldraw-desktop -f version_type=patch
```

### Locally (from tldraw-internal)

```bash
yarn desktop publish
```
