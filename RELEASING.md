# Releasing tldraw-desktop

This document describes how to create a new release of tldraw-desktop.

## Prerequisites

Before releasing, ensure the following GitHub repository secrets are configured:

### macOS Code Signing & Notarization

| Secret                        | Description                                          |
| ----------------------------- | ---------------------------------------------------- |
| `CSC_LINK`                    | Base64-encoded .p12 certificate (export from Keychain) |
| `CSC_KEY_PASSWORD`            | Password for the .p12 certificate                    |
| `APPLE_ID`                    | Apple Developer account email                        |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password (not your account password)    |
| `APPLE_TEAM_ID`               | Apple Developer Team ID                              |

To generate an app-specific password:
1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Navigate to Security > App-Specific Passwords
3. Generate a new password for "tldraw-desktop notarization"

To export your certificate as base64:
```bash
base64 -i path/to/certificate.p12 | pbcopy
```

### Windows Code Signing (Optional)

| Secret                 | Description                  |
| ---------------------- | ---------------------------- |
| `WIN_CSC_LINK`         | Base64-encoded .pfx certificate |
| `WIN_CSC_KEY_PASSWORD` | Password for the certificate |

## Release Process

### 1. Update the Version

Use npm's built-in version command which automatically creates a git tag:

```bash
# For a patch release (1.0.0 -> 1.0.1)
npm version patch

# For a minor release (1.0.0 -> 1.1.0)
npm version minor

# For a major release (1.0.0 -> 2.0.0)
npm version major
```

This command:
- Updates `package.json`
- Creates a git commit with the message `v{version}`
- Creates a git tag `v{version}`

### 2. Push the Tag

Push the commit and tag to trigger the release workflow:

```bash
git push origin main --follow-tags
```

### 3. Monitor the Build

1. Go to [Actions](../../actions) in GitHub
2. Watch the "Release" workflow
3. Builds run in parallel for macOS, Windows, and Linux
4. Total build time is approximately 30-45 minutes

### 4. Publish the Release

Once all builds complete:

1. Go to [Releases](../../releases)
2. Find the draft release created by the workflow
3. Review the auto-generated release notes
4. Edit if necessary (add highlights, breaking changes, etc.)
5. Click "Publish release"

## Release Artifacts

Each release includes:

### macOS
- `tldraw-{version}-arm64.dmg` - Apple Silicon
- `tldraw-{version}-x64.dmg` - Intel
- `tldraw-{version}-arm64-mac.zip` - Apple Silicon (for auto-update)
- `tldraw-{version}-x64-mac.zip` - Intel (for auto-update)
- `latest-mac.yml` - Auto-updater manifest

### Windows
- `tldraw-{version}-win-x64.exe` - 64-bit installer
- `tldraw-{version}-win-arm64.exe` - ARM64 installer
- `latest.yml` - Auto-updater manifest

### Linux
- `tldraw-{version}-linux-x64.AppImage` - Portable x64
- `tldraw-{version}-linux-arm64.AppImage` - Portable ARM64
- `tldraw-{version}-linux-x64.deb` - Debian/Ubuntu x64
- `latest-linux.yml` - Auto-updater manifest

## Auto-Updates

The app uses `electron-updater` to check for and download updates automatically. After publishing a release:

1. Users will see an update notification when they open the app
2. They can download and install the update from within the app
3. The update manifest files (`latest-mac.yml`, `latest.yml`, `latest-linux.yml`) are used by electron-updater to determine if updates are available

## Manual/Local Builds

To test the build process locally without publishing:

```bash
# Build without publishing
npm run publish:test

# Or build for a specific platform
npm run build:mac
npm run build:win
npm run build:linux
```

## Troubleshooting

### macOS notarization fails
- Verify `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` are correct
- Check that the app-specific password hasn't expired
- Notarization can take several minutes; the workflow has a 60-minute timeout

### Windows signing fails
- Verify `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` are correct
- Check certificate expiration date
- Windows builds still work without signing, but users will see a warning

### Build succeeds but release isn't created
- Check that the tag follows the `v*.*.*` pattern (e.g., `v1.0.0`)
- Verify `GITHUB_TOKEN` has write permissions for releases
- Check the "publish" job in the workflow logs

### electron-updater doesn't find updates
- Ensure the release is published (not draft)
- Check that `latest-*.yml` files are included in the release assets
- Verify the `publish` configuration in `electron-builder.yml` matches your repo
