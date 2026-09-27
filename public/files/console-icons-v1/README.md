# Optional console icons

Original, dependency-free runtime assets for the management console. No external
icon service, service worker, tracking, or scheduled requests are involved.
These files are optional; upstream defaults and appearance settings are unchanged.

Set the native appearance favicon to `/files/console-icons-v1/favicon.ico` and
append this to the native custom head setting:

```html
<link rel="icon" type="image/svg+xml" href="/files/console-icons-v1/icon.svg">
<link rel="apple-touch-icon" sizes="180x180" href="/files/console-icons-v1/icon-180.png">
<link rel="manifest" href="/files/console-icons-v1/manifest.webmanifest">
<meta name="theme-color" content="#087f72">
```

The manifest uses browser display mode and adds no offline behavior. Mobile
launches use the existing login session and authentication rules. Regenerate
assets with `python3 scripts/generate-console-icons.py` (Pillow required only for
regeneration). Use a new version directory for future visual changes so cached
icons can update without replacing upstream assets.
