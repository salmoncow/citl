# Asset Reusability & Resource Management Principles

## Universal Patterns for Reusable Resources

When building applications, apply these technology-agnostic principles for managing static assets, resources, and reusable content. These patterns ensure maintainability, reduce duplication, and improve scalability across any platform.

## Core Reusability Principles

### 1. DRY (Don't Repeat Yourself) for Resources
Resources, like code, should have a single source of truth:

```
❌ Anti-Pattern: Duplicate Resources
- default-user-icon embedded in UserProfile.js
- default-user-icon embedded in CommentSection.js
- default-user-icon embedded in UserList.js

✅ Pattern: Single Source of Truth
- /assets/images/placeholders/default-avatar.svg
- Referenced by UserProfile, CommentSection, UserList
```

### 2. Separation of Concerns
Separate presentation resources from business logic:

```
❌ Mixed Concerns:
class UIModule {
    constructor() {
        this.icon = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0i...' // 500 chars
    }
}

✅ Separated Concerns:
class UIModule {
    constructor() {
        this.icon = AssetManager.get('defaultAvatar')
    }
}
```

### 3. Semantic Resource Naming
Name resources based on meaning, not appearance:

```
✅ Good: default-avatar.svg, error-state.svg, loading-spinner.svg
❌ Avoid: gray-circle-person.svg, red-x.svg, spinning-thing.svg
```

## Decision Framework: Embedded vs. External Assets

### When to Extract Resources

Extract a resource to an external asset file when **2 or more** of these conditions are true:

**Reusability Indicators:**
- [ ] Resource could be used in 2+ locations (now or future)
- [ ] Resource represents a semantic concept (logo, icon, placeholder, error state)
- [ ] Resource is >100 lines or >2KB in size
- [ ] Resource may need independent updates without code changes
- [ ] Resource could be A/B tested or feature-toggled
- [ ] Resource should be cacheable by browsers independently
- [ ] Resource is part of a family (icons, placeholders, logos)

**Embedding Indicators:**
- [ ] Resource is <50 lines and truly unique to one component
- [ ] Resource is dynamically generated (requires computation)
- [ ] Resource is configuration-specific (environment-dependent data URIs)
- [ ] Performance requires inline embedding (critical path CSS/SVG)
- [ ] External file would add unnecessary HTTP requests (HTTP/1.1)

### Decision Matrix

| Size | Reusable? | Semantic? | Decision |
|------|-----------|-----------|----------|
| <50 lines | No | No | Keep Embedded |
| <50 lines | Yes | Yes | Extract to Asset |
| 50-100 lines | Maybe | Yes | Extract to Asset |
| >100 lines | - | - | Extract to Asset |

## Asset Organization Patterns

### 1. Directory Structure
Organize assets by purpose, not type:

```
/src
├── assets/
│   ├── images/
│   │   ├── placeholders/       # Fallback images
│   │   │   ├── default-avatar.svg
│   │   │   ├── default-thumbnail.svg
│   │   │   ├── image-not-found.svg
│   │   │   └── README.md       # Document placeholder usage
│   │   ├── icons/              # Reusable icons
│   │   │   ├── user.svg
│   │   │   ├── settings.svg
│   │   │   ├── error.svg
│   │   │   └── success.svg
│   │   ├── branding/           # Logos, brand assets
│   │   │   ├── logo.svg
│   │   │   ├── logo-dark.svg
│   │   │   └── favicon.ico
│   │   └── illustrations/      # Decorative images
│   ├── fonts/                  # Custom fonts
│   ├── data/                   # Static JSON, config files
│   └── styles/                 # Shared CSS/SCSS
│
/public (or /dist)
└── assets/                     # Built/deployed assets
    ├── images/
    ├── fonts/
    └── manifest.json           # Asset inventory
```

### 2. Asset Naming Conventions

**Placeholders & Fallbacks:**
```
default-{entity}.svg          → default-avatar.svg, default-banner.svg
{entity}-not-found.svg        → image-not-found.svg, video-not-found.svg
{entity}-{state}.svg          → avatar-loading.svg, image-error.svg
```

**Icons:**
```
icon-{name}.svg               → icon-user.svg, icon-search.svg
{category}-{name}.svg         → social-twitter.svg, payment-visa.svg
```

**States:**
```
{entity}-{state}.svg          → button-disabled.svg, input-error.svg
state-{name}.svg              → state-success.svg, state-warning.svg
```

**Responsive Assets:**
```
{name}-{size}.{ext}           → hero-small.jpg, hero-large.jpg
{name}@{density}x.{ext}       → logo@2x.png, icon@3x.png
```

## Asset Management Patterns

### 1. Centralized Asset Manager
Create a single source for asset paths:

```javascript
/**
 * Centralized asset management for application resources
 * Provides type-safe access to all static assets
 */
class AssetManager {
    // Asset categories
    static PLACEHOLDERS = {
        defaultAvatar: '/assets/images/placeholders/default-avatar.svg',
        defaultThumbnail: '/assets/images/placeholders/default-thumbnail.svg',
        imageNotFound: '/assets/images/placeholders/image-not-found.svg',
        videoNotFound: '/assets/images/placeholders/video-not-found.svg'
    }

    static ICONS = {
        user: '/assets/images/icons/user.svg',
        settings: '/assets/images/icons/settings.svg',
        error: '/assets/images/icons/error.svg',
        success: '/assets/images/icons/success.svg'
    }

    static BRANDING = {
        logo: '/assets/images/branding/logo.svg',
        logoDark: '/assets/images/branding/logo-dark.svg',
        favicon: '/assets/images/branding/favicon.ico'
    }

    /**
     * Get asset URL by category and name
     * @param {string} category - Asset category (placeholders, icons, branding)
     * @param {string} name - Asset name
     * @returns {string} Asset URL
     */
    static get(category, name) {
        const categoryMap = {
            placeholders: this.PLACEHOLDERS,
            icons: this.ICONS,
            branding: this.BRANDING
        }

        const assets = categoryMap[category]
        if (!assets || !assets[name]) {
            console.warn(`Asset not found: ${category}.${name}`)
            return this.PLACEHOLDERS.imageNotFound
        }

        return assets[name]
    }

    /**
     * Preload critical assets for better performance
     * @param {string[]} assetUrls - Array of asset URLs to preload
     */
    static preload(assetUrls) {
        assetUrls.forEach(url => {
            const link = document.createElement('link')
            link.rel = 'preload'
            link.as = this.getAssetType(url)
            link.href = url
            document.head.appendChild(link)
        })
    }

    /**
     * Determine asset type from URL
     * @private
     */
    static getAssetType(url) {
        if (url.endsWith('.svg') || url.endsWith('.png') || url.endsWith('.jpg')) {
            return 'image'
        }
        if (url.endsWith('.woff') || url.endsWith('.woff2')) {
            return 'font'
        }
        return 'fetch'
    }
}

// Usage examples
const avatarUrl = AssetManager.get('placeholders', 'defaultAvatar')
const userIcon = AssetManager.get('icons', 'user')

// Preload critical assets
AssetManager.preload([
    AssetManager.PLACEHOLDERS.defaultAvatar,
    AssetManager.BRANDING.logo
])
```

### 2. Asset Loading with Fallbacks
Implement robust error handling for asset loading:

```javascript
/**
 * Load image with fallback support
 * @param {string} primaryUrl - Primary image URL to attempt
 * @param {string} fallbackUrl - Fallback URL if primary fails
 * @returns {Promise<string>} Resolved URL (primary or fallback)
 */
async function loadImageWithFallback(primaryUrl, fallbackUrl) {
    return new Promise((resolve) => {
        if (!primaryUrl) {
            resolve(fallbackUrl)
            return
        }

        const img = new Image()

        img.onload = () => {
            resolve(primaryUrl)
        }

        img.onerror = () => {
            console.warn(`Failed to load image: ${primaryUrl}, using fallback`)
            resolve(fallbackUrl)
        }

        img.src = primaryUrl
    })
}

// Usage in components
class UserProfile {
    async loadAvatar(user) {
        const avatarUrl = await loadImageWithFallback(
            user.photoURL,
            AssetManager.get('placeholders', 'defaultAvatar')
        )

        this.avatarElement.src = avatarUrl
    }
}
```

### 3. Cascading Fallback Pattern
Implement multi-level fallbacks for resilience:

```javascript
/**
 * Load asset with multiple fallback options
 * @param {string[]} urls - Array of URLs to try in order
 * @returns {Promise<string>} First successful URL
 */
async function loadWithCascadingFallbacks(urls) {
    for (const url of urls) {
        try {
            const success = await testAssetLoad(url)
            if (success) return url
        } catch (error) {
            continue
        }
    }

    // Return last URL as final fallback
    return urls[urls.length - 1]
}

// Usage
const imageUrl = await loadWithCascadingFallbacks([
    user.photoURL,                                    // Primary: User's photo
    user.defaultPhotoURL,                             // Secondary: User's default
    AssetManager.get('placeholders', 'defaultAvatar') // Tertiary: System default
])
```

## Build Process Integration

### 1. Asset Pipeline Script
Automate asset management in build process:

```javascript
// scripts/build-assets.js
const fs = require('fs')
const path = require('path')

class AssetPipeline {
    constructor(config) {
        this.sourceDir = config.sourceDir || './src/assets'
        this.destDir = config.destDir || './public/assets'
    }

    /**
     * Copy assets from source to destination
     */
    async copyAssets() {
        console.log('📦 Copying assets...')

        // Ensure destination directory exists
        if (!fs.existsSync(this.destDir)) {
            fs.mkdirSync(this.destDir, { recursive: true })
        }

        // Copy all assets
        this.copyRecursive(this.sourceDir, this.destDir)

        console.log('✅ Assets copied successfully')
    }

    /**
     * Optimize SVG assets
     */
    async optimizeSVGs() {
        console.log('🎨 Optimizing SVGs...')
        // Use SVGO or similar tool
        // Remove unnecessary metadata, comments, etc.
    }

    /**
     * Generate asset manifest for cache busting
     */
    generateManifest() {
        const manifest = {}
        // Walk through assets and create hash-based manifest
        // { "default-avatar.svg": "default-avatar.abc123.svg" }

        fs.writeFileSync(
            path.join(this.destDir, 'manifest.json'),
            JSON.stringify(manifest, null, 2)
        )
    }

    copyRecursive(src, dest) {
        const entries = fs.readdirSync(src, { withFileTypes: true })

        for (const entry of entries) {
            const srcPath = path.join(src, entry.name)
            const destPath = path.join(dest, entry.name)

            if (entry.isDirectory()) {
                if (!fs.existsSync(destPath)) {
                    fs.mkdirSync(destPath, { recursive: true })
                }
                this.copyRecursive(srcPath, destPath)
            } else {
                fs.copyFileSync(srcPath, destPath)
            }
        }
    }
}

// Run pipeline
const pipeline = new AssetPipeline({
    sourceDir: './src/assets',
    destDir: './public/assets'
})

pipeline.copyAssets()
pipeline.optimizeSVGs()
pipeline.generateManifest()
```

### 2. Update package.json Scripts
```json
{
  "scripts": {
    "build:assets": "node scripts/build-assets.js",
    "build": "npm run build:assets && node scripts/inject-env.js",
    "dev": "npm run build && npx http-server public -p 3000",
    "watch:assets": "nodemon --watch src/assets --exec npm run build:assets"
  }
}
```

## Asset Documentation Pattern

### Create Asset README
Document asset usage in the asset directory:

```markdown
# Placeholder Images

This directory contains fallback images used throughout the application when primary assets fail to load or are unavailable.

## Available Placeholders

### default-avatar.svg
- **Purpose**: Fallback for user profile pictures
- **Used by**: UserProfile, CommentSection, UserList, AuthorCard
- **Dimensions**: 24x24 viewBox, scales to any size
- **Colors**: Neutral gray (#f3f4f6, #9ca3af, #6b7280)

### default-thumbnail.svg
- **Purpose**: Fallback for article/video thumbnails
- **Used by**: ArticleCard, VideoPlayer, MediaGallery
- **Dimensions**: 16x9 aspect ratio
- **Colors**: Neutral gray

### image-not-found.svg
- **Purpose**: Generic image load error state
- **Used by**: ImageComponent (error boundary)
- **Dimensions**: 1x1 aspect ratio
- **Colors**: Neutral gray with error icon

## Usage Guidelines

1. **Import via AssetManager**: Always use `AssetManager.get('placeholders', 'name')`
2. **Do not embed**: Never copy these SVGs into component code
3. **Maintain consistency**: Use existing placeholders before creating new ones
4. **Update documentation**: Add new placeholders to this README

## Modifying Placeholders

When updating placeholder assets:
1. Maintain semantic meaning (don't change purpose)
2. Keep neutral colors for broad applicability
3. Ensure accessibility (sufficient contrast)
4. Test across all usage locations
5. Update this README with changes
```

## Reusability Checklist

### Before Creating a New Asset
- [ ] Search codebase for similar existing assets
- [ ] Check if existing placeholder can serve the purpose
- [ ] Verify asset follows naming conventions
- [ ] Ensure asset is truly reusable (not one-off)
- [ ] Document asset purpose and usage

### Before Embedding a Resource
- [ ] Resource is <50 lines and unique to component
- [ ] No other component could use this resource
- [ ] Performance requires inline embedding
- [ ] Added comment explaining why it's embedded

### After Extracting an Asset
- [ ] Asset placed in appropriate category directory
- [ ] Asset added to AssetManager (if using)
- [ ] All usage locations updated to reference asset
- [ ] Asset documented in directory README
- [ ] Build process copies asset to public directory

## Common Anti-Patterns

### 1. Premature Extraction
Don't extract assets that are truly unique:

```javascript
// ❌ Over-engineering: Unique component-specific SVG
/assets/images/special-snowflake-button-arrow-only-for-checkout.svg

// ✅ Better: Keep unique assets inline if they won't be reused
class CheckoutButton {
    constructor() {
        this.uniqueArrow = '<svg>...</svg>' // Unique to this component
    }
}
```

### 2. Duplicate Assets
Multiple assets serving the same purpose:

```
❌ Anti-Pattern:
/assets/images/user-default.svg
/assets/images/avatar-placeholder.svg
/assets/images/default-user-icon.svg
↑ All serving the same purpose!

✅ Pattern:
/assets/images/placeholders/default-avatar.svg
↑ Single source of truth
```

### 3. Hardcoded Asset Paths
Scattered asset references across codebase:

```javascript
// ❌ Hardcoded paths (fragile, hard to refactor)
this.avatar.src = '/assets/images/default-avatar.svg'
this.icon.src = '/assets/images/default-avatar.svg'

// ✅ Centralized via AssetManager (refactor-safe)
this.avatar.src = AssetManager.get('placeholders', 'defaultAvatar')
this.icon.src = AssetManager.get('placeholders', 'defaultAvatar')
```

### 4. No Fallback Strategy
Assets without error handling:

```javascript
// ❌ No fallback (shows broken image on failure)
this.image.src = user.photoURL

// ✅ With fallback (graceful degradation)
this.image.src = user.photoURL || AssetManager.get('placeholders', 'defaultAvatar')
this.image.onerror = () => {
    this.image.src = AssetManager.get('placeholders', 'defaultAvatar')
}
```

## Performance Considerations

### 1. Asset Preloading
Preload critical assets for faster initial render:

```html
<head>
    <!-- Preload critical images -->
    <link rel="preload" as="image" href="/assets/images/branding/logo.svg">
    <link rel="preload" as="image" href="/assets/images/placeholders/default-avatar.svg">
</head>
```

### 2. Lazy Loading
Load non-critical assets on demand:

```javascript
// Lazy load placeholder only when needed
async function getPlaceholder(type) {
    const placeholderModule = await import('./asset-manager.js')
    return placeholderModule.AssetManager.get('placeholders', type)
}
```

### 3. SVG Sprites
Combine frequently-used icons into sprites:

```xml
<!-- sprite.svg -->
<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
    <symbol id="icon-user" viewBox="0 0 24 24">
        <!-- SVG path data -->
    </symbol>
    <symbol id="icon-settings" viewBox="0 0 24 24">
        <!-- SVG path data -->
    </symbol>
</svg>

<!-- Usage -->
<svg><use href="/assets/sprite.svg#icon-user"></use></svg>
```

## Testing Asset Integration

### 1. Asset Existence Tests
Verify all referenced assets exist:

```javascript
describe('Asset Integrity', () => {
    it('should have all placeholder assets', async () => {
        const placeholders = Object.values(AssetManager.PLACEHOLDERS)

        for (const url of placeholders) {
            const response = await fetch(url)
            expect(response.status).toBe(200)
        }
    })

    it('should have all icon assets', async () => {
        const icons = Object.values(AssetManager.ICONS)

        for (const url of icons) {
            const response = await fetch(url)
            expect(response.status).toBe(200)
        }
    })
})
```

### 2. Fallback Behavior Tests
Test error handling and fallbacks:

```javascript
describe('Image Fallback Behavior', () => {
    it('should use fallback when primary image fails', async () => {
        const url = await loadImageWithFallback(
            'https://invalid-url.com/image.jpg',
            AssetManager.get('placeholders', 'defaultAvatar')
        )

        expect(url).toBe(AssetManager.get('placeholders', 'defaultAvatar'))
    })
})
```

## Migration Strategy

### Extracting Embedded Assets

**Step 1: Identify Candidates**
```bash
# Search for embedded data URIs
grep -r "data:image" src/

# Search for large embedded SVGs
grep -r "<svg" src/ | awk 'length > 200'
```

**Step 2: Extract to Files**
1. Create appropriate asset directory
2. Save resource as standalone file
3. Add to AssetManager (if using)
4. Document in asset directory README

**Step 3: Update References**
1. Replace embedded resource with asset reference
2. Add error handling/fallbacks
3. Test all usage locations

**Step 4: Clean Up**
1. Remove old embedded resources
2. Update documentation
3. Run tests to verify

## Summary

**Key Principles:**
- DRY applies to resources, not just code
- Extract assets when reusable (2+ locations) or semantic
- Use centralized AssetManager for maintainability
- Always provide fallbacks for external resources
- Document asset purpose and usage
- Integrate asset management into build process

These patterns ensure your application's assets are maintainable, performant, and reusable across any technology stack.
