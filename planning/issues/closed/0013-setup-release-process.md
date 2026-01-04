# Set up npm publish / release process

**Status:** `closed`
**Priority:** `high`
**Type:** `feature`

## Description

Configure a CI/CD pipeline for automated releases, including building for all platforms (macOS, Windows, Linux) and publishing updates to GitHub Releases. The app already uses `electron-updater` for auto-updates, so the release process needs to produce properly signed artifacts with update manifests.

## Context

Currently the release process appears to be manual and incomplete:

- There's a commented-out `scripts/release.mts` file that shows an incomplete release workflow
- The `electron-builder.yml` is configured to publish to GitHub Releases (private repo)
- The `UpdateManager` is already set up to check for and download updates from GitHub Releases
- There are no GitHub Actions workflows in the repository
- The `package.json` has `publish` and `publish:test` scripts but no CI automation

A proper automated release process is needed to:

1. Build the app for all platforms consistently
2. Handle code signing and notarization (especially for macOS)
3. Publish release artifacts to GitHub Releases
4. Generate update manifests (`latest-mac.yml`, `latest.yml`, `latest-linux.yml`) for auto-updater
5. Ensure the release process is repeatable and documented

## Acceptance Criteria

- [x] GitHub Actions workflow for building on all platforms (macOS, Windows, Linux)
- [x] Automated code signing for macOS (with notarization)
- [x] Automated code signing for Windows
- [x] Release artifacts published to GitHub Releases on tag push
- [x] Update manifests generated for electron-updater compatibility
- [x] Version bumping process documented or automated
- [x] Release notes/changelog integration
- [x] Draft release support (manual publish step)

## Technical Notes

**Affected files:**

- `.github/workflows/` - New directory for CI/CD workflows (to be created)
- `scripts/release.mts` - Existing release script (currently commented out)
- `electron-builder.yml` - Already configured for GitHub publish
- `package.json:32-33` - Has `publish` and `publish:test` scripts

**Current configuration:**

`electron-builder.yml` publish config:

```yaml
publish:
  provider: github
  owner: tldraw
  repo: tldraw-desktop
  private: true
```

`package.json` scripts:

```json
"publish": "electron-builder -p always",
"publish:test": "electron-builder -p never --log-level debug"
```

**Required secrets for GitHub Actions:**

- `APPLE_ID` - Apple Developer account email
- `APPLE_ID_PASSWORD` - App-specific password for notarization
- `APPLE_TEAM_ID` - Apple Developer Team ID
- `CSC_LINK` - Base64 encoded .p12 certificate for macOS signing
- `CSC_KEY_PASSWORD` - Password for the .p12 certificate
- `WIN_CSC_LINK` - Windows code signing certificate (optional but recommended)
- `WIN_CSC_KEY_PASSWORD` - Windows certificate password
- `GH_TOKEN` - GitHub token for publishing releases (can use GITHUB_TOKEN)

**Implementation approach:**

1. Create GitHub Actions workflows for:
   - CI (lint, typecheck, test on PRs)
   - Release (build + publish on version tags)

2. Use matrix strategy to build on all platforms:
   - `macos-latest` for macOS builds (.dmg, .zip)
   - `windows-latest` for Windows builds (.exe, .nsis)
   - `ubuntu-latest` for Linux builds (.AppImage, .deb)

3. Configure environment variables for code signing

4. Set up release workflow triggered by:
   - Pushing a tag like `v1.0.0`
   - Or manual workflow dispatch

## Related

- Uses `electron-updater` (v6.6.2) for auto-updates
- Uses `electron-builder` (v26.0.0) for building/packaging

## Implementation Plan

### Phase 1: Create CI Workflow for PRs

1. **Create `.github/workflows/ci.yml`**
   - Trigger on pull requests and pushes to main
   - Install dependencies with npm
   - Run linting (`npm run lint`)
   - Run type checking (`npm run typecheck`)
   - Run e2e tests (`npm run e2e`)
   - Use Node.js 20+ for compatibility

```yaml
# Example structure for .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  e2e-tests:
    runs-on: macos-latest # E2E tests need a GUI
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run e2e
```

### Phase 2: Create Release Workflow

2. **Create `.github/workflows/release.yml`**
   - Trigger on version tags (`v*.*.*`) and manual workflow dispatch
   - Use matrix strategy for multi-platform builds
   - Upload artifacts to GitHub Releases as draft

```yaml
# Example structure for .github/workflows/release.yml
name: Release
on:
  push:
    tags:
      - 'v*.*.*'
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to release'
        required: true

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci

      # macOS build with signing and notarization
      - name: Build macOS
        if: matrix.os == 'macos-latest'
        run: npm run build:mac
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          CSC_LINK: ${{ secrets.CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}

      # Windows build with signing
      - name: Build Windows
        if: matrix.os == 'windows-latest'
        run: npm run build:win
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
          WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}

      # Linux build
      - name: Build Linux
        if: matrix.os == 'ubuntu-latest'
        run: npm run build:linux
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      # Upload artifacts
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: release-${{ matrix.os }}
          path: dist/

  publish:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Download all artifacts
        uses: actions/download-artifact@v4

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          draft: true
          files: |
            release-*/*
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Phase 3: Configure Repository Secrets

3. **Set up GitHub repository secrets:**
   - Navigate to Settings > Secrets and variables > Actions
   - Add the following secrets:

   | Secret                 | Description                                                      |
   | ---------------------- | ---------------------------------------------------------------- |
   | `CSC_LINK`             | Base64 encoded .p12 certificate for macOS (export from Keychain) |
   | `CSC_KEY_PASSWORD`     | Password for the .p12 certificate                                |
   | `APPLE_ID`             | Apple Developer account email                                    |
   | `APPLE_ID_PASSWORD`    | App-specific password (not account password)                     |
   | `APPLE_TEAM_ID`        | Apple Developer Team ID                                          |
   | `WIN_CSC_LINK`         | Windows code signing certificate (optional)                      |
   | `WIN_CSC_KEY_PASSWORD` | Windows certificate password (optional)                          |

   To generate app-specific password:
   - Go to appleid.apple.com > Security > App-Specific Passwords

### Phase 4: Update electron-builder Configuration

4. **Update `electron-builder.yml`** to support all platforms:

```yaml
# Add Windows and Linux configuration
win:
  target:
    - target: nsis
      arch: [x64, arm64]
  artifactName: ${productName}-${version}-${os}-${arch}.${ext}

linux:
  target:
    - target: AppImage
      arch: [x64, arm64]
    - target: deb
      arch: [x64]
  artifactName: ${productName}-${version}-${os}-${arch}.${ext}
```

### Phase 5: Version Management

5. **Create version bump script or use npm version:**
   - Option A: Use `npm version patch|minor|major` which auto-creates git tags
   - Option B: Create a GitHub Action for version bumping via workflow dispatch

6. **Update `scripts/release.mts`** or remove if using pure GitHub Actions

### Phase 6: Documentation

7. **Document the release process** in `RELEASING.md`:
   - How to create a new release
   - Version naming conventions
   - Changelog maintenance
   - Manual vs automated steps

### Testing Considerations

- Test workflow with `workflow_dispatch` before relying on tag triggers
- Use `publish:test` script locally to verify builds without publishing
- Test auto-updater functionality after first release
- Verify update manifests (`latest-mac.yml`, etc.) are correctly generated

### Risks and Edge Cases

- **macOS notarization timeout**: Can take several minutes; may need increased timeout
- **Private repo token**: Current config uses `private: true`; ensure `GH_TOKEN` has appropriate scopes
- **Artifact size limits**: GitHub has limits on artifact sizes (~2GB per file)
- **Concurrent builds**: Matrix builds may conflict when publishing; use separate publish job
- **Certificate expiration**: Code signing certificates expire; set calendar reminder

### Resources

- [electron-builder GitHub Action](https://github.com/samuelmeuli/action-electron-builder)
- [electron-builder publish docs](https://www.electron.build/publish.html)
- [Apple notarization guide](https://www.electron.build/code-signing-mac)
- [Multi-platform Electron builds with GitHub Actions](https://dev.to/erikhofer/build-and-publish-a-multi-platform-electron-app-on-github-3lnd)

## Implementation Notes

### Files Created/Modified

1. **`.github/workflows/ci.yml`** - New CI workflow for lint and typecheck on PRs/pushes to main
2. **`.github/workflows/release.yml`** - New release workflow for multi-platform builds with:
   - Separate build jobs for macOS (arm64 + x64), Windows, and Linux
   - Code signing and notarization support via environment secrets
   - Draft release creation with auto-generated release notes
   - Manual workflow dispatch option with dry-run support
3. **`electron-builder.yml`** - Updated with Windows and Linux build configurations:
   - Windows: NSIS installer for x64 and arm64
   - Linux: AppImage (x64/arm64) and deb (x64)
   - Consistent artifact naming across platforms
4. **`RELEASING.md`** - Comprehensive documentation covering:
   - Prerequisites and required secrets
   - Step-by-step release process using `npm version`
   - Artifact descriptions
   - Auto-update information
   - Troubleshooting guide

### Next Steps for Repository Owner

Before the release workflow can run successfully, the following secrets must be configured in GitHub repository settings:

| Secret                        | Required For          |
| ----------------------------- | --------------------- |
| `CSC_LINK`                    | macOS code signing    |
| `CSC_KEY_PASSWORD`            | macOS code signing    |
| `APPLE_ID`                    | macOS notarization    |
| `APPLE_APP_SPECIFIC_PASSWORD` | macOS notarization    |
| `APPLE_TEAM_ID`               | macOS notarization    |
| `WIN_CSC_LINK`                | Windows code signing  |
| `WIN_CSC_KEY_PASSWORD`        | Windows code signing  |

### Testing Recommendations

1. Run the workflow manually via `workflow_dispatch` with `dry_run: true` to verify builds complete
2. Test with a pre-release tag (e.g., `v1.0.0-beta.1`) before a production release
3. After first release, verify auto-updater works by checking the `latest-*.yml` manifests
