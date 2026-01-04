# Host release artifacts on Cloudflare R2 for public auto-updates

**Status:** `open`
**Priority:** `medium`
**Type:** `feature`

## Description

Configure the auto-update system to serve release artifacts from Cloudflare R2 instead of GitHub Releases. This allows public users to receive auto-updates without requiring a GitHub authentication token, since the current setup uses a private GitHub repository.

## Context

Currently, the auto-update system in `UpdateManager.ts` is configured to use GitHub as the release provider with `private: true`. This requires users to have a `GH_TOKEN` environment variable set to authenticate and download updates. For a publicly distributed desktop application, this creates a poor user experience since:

1. End users shouldn't need GitHub credentials to receive updates
2. The current system silently fails if `GH_TOKEN` is not set
3. Cloudflare R2 provides cost-effective, globally distributed storage for binary artifacts

## Acceptance Criteria

- [ ] Release artifacts (DMG, blockmap, latest-mac.yml) are uploaded to Cloudflare R2
- [ ] Auto-updater fetches from R2 without requiring authentication
- [ ] GitHub Actions workflow uploads artifacts to R2 during release process
- [ ] Existing GitHub Release workflow continues to work (for archival/manual downloads)
- [ ] R2 bucket configured with appropriate CORS and caching policies

## Technical Notes

**Affected files:**

- `src/main/UpdateManager.ts:15-23` - Feed URL configuration uses GitHub provider with private: true
- `electron-builder.yml:49-53` - publish config set to GitHub provider
- `.github/workflows/release.yml` - needs R2 upload step after artifact collection

**Current behavior:**
- `electron-builder.yml` sets `publish.provider: github` with `private: true`
- `UpdateManager.ts` calls `setFeedURL()` with GitHub provider only when `GH_TOKEN` is present
- Without `GH_TOKEN`, auto-updates silently don't work

**Expected behavior:**
- Auto-updater should always work for end users without any configuration
- Updates served from public R2 URL (e.g., `https://releases.tldraw.com/desktop/`)

## Related

- None

## Implementation Plan

### Phase 1: Cloudflare R2 Setup (Manual)

1. Create Cloudflare R2 bucket (e.g., `tldraw-releases`)
2. Enable public access for the bucket
3. Optionally configure custom domain (e.g., `releases.tldraw.com`)
4. Create R2 API token with read/write permissions
5. Add GitHub repository secrets:
   - `R2_BUCKET_NAME`
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`

### Phase 2: Update electron-builder Configuration

**File:** `electron-builder.yml:49-53`

Change the publish provider from GitHub to generic:

```yaml
publish:
  provider: generic
  url: https://releases.tldraw.com  # or R2 public URL
  useMultipleRangeRequest: false
```

This tells electron-builder to generate `latest-mac.yml` with relative URLs that work with the generic provider.

### Phase 3: Update UpdateManager.ts

**File:** `src/main/UpdateManager.ts:15-23`

Replace the GitHub-only configuration with a generic provider that always works:

```typescript
// Configure for public R2 hosting (no auth required)
autoUpdater.setFeedURL({
  provider: 'generic',
  url: 'https://releases.tldraw.com',  // or R2 public URL
  useMultipleRangeRequest: false,
})
```

Remove the `GH_TOKEN` conditional logic since R2 doesn't require authentication.

### Phase 4: Update dev-app-update.yml

**File:** `dev-app-update.yml`

Update for local development testing:

```yaml
provider: generic
url: https://releases.tldraw.com
updaterCacheDirName: tldraw-ev-updater
```

### Phase 5: Add R2 Upload to Release Workflow

**File:** `.github/workflows/release.yml`

Add a new step after the "Create GitHub Release" step to upload artifacts to R2:

```yaml
- name: Upload to Cloudflare R2
  env:
    AWS_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
    R2_ENDPOINT: https://${{ secrets.R2_ACCOUNT_ID }}.r2.cloudflarestorage.com
  run: |
    pip install awscli
    aws s3 sync artifacts/release-macos/ \
      s3://${{ secrets.R2_BUCKET_NAME }}/ \
      --endpoint-url $R2_ENDPOINT \
      --region auto
```

### Phase 6: Testing

1. Run release workflow with `dry_run: true` to verify build
2. Manually upload test artifacts to R2 and verify public access
3. Test auto-updater can detect and download updates from R2 URL
4. Verify "Check for Updates" menu item works without `GH_TOKEN`
5. Test background update check on app startup

### Expected R2 Directory Structure

```
/
├── latest-mac.yml
├── tldraw-1.0.7-arm64.dmg
├── tldraw-1.0.7-arm64.dmg.blockmap
├── tldraw-1.0.7-arm64-mac.zip
├── tldraw-1.0.7-x64.dmg
├── tldraw-1.0.7-x64.dmg.blockmap
└── tldraw-1.0.7-x64-mac.zip
```

### Key Technical Details

- **electron-updater generic provider**: Uses simple HTTP(S) URLs, expects `latest-mac.yml` at the base URL
- **URL structure**: The `latest-mac.yml` file contains relative URLs (e.g., `tldraw-1.0.7-arm64.dmg`), and electron-updater constructs full URLs by appending to the base URL
- **R2 S3 compatibility**: Cloudflare R2 exposes an S3-compatible API, allowing use of AWS CLI for uploads
- **No authentication needed**: Unlike GitHub private repos, R2 public buckets serve files without auth

## Implementation Notes

- Keep GitHub Releases as a backup/archive for manual downloads
- Consider adding version-prefixed directories (e.g., `/v1.0.7/`) for artifact organization, but this requires URL changes in `latest-mac.yml`
- The `useMultipleRangeRequest: false` option is important for S3-compatible storage to avoid range request issues
- Windows and Linux artifacts will follow the same pattern once those builds are enabled
