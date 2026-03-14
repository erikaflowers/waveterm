# Building Terminus

Instructions for building Terminus from source on macOS. Linux and Windows builds are possible but untested.

## Prerequisites

- [Go](https://golang.org/) 1.22+
- [Node.js](https://nodejs.org/) 22+
- [go-task](https://taskfile.dev/) (`brew install go-task`)
- [npm](https://www.npmjs.com/) (comes with Node.js)

macOS has no additional platform-specific dependencies. Linux requires `zip` and the [Zig](https://ziglang.org/) compiler for CGO cross-compilation.

## Clone and Install

```bash
git clone https://github.com/erikaflowers/terminus.git
cd terminus
npm install
```

## Development

Run the dev server with hot module reloading:

```bash
task dev
```

This builds the Go backend, Electron preload scripts, and launches the frontend via Vite's dev server. The dev build uses separate data/config directories (`terminus-dev`) so it can run alongside the production app.

**Note:** If the production Terminus.app is running, kill it first — they share the Electron single-instance lock in dev mode.

## Production Build

The full build has three steps:

### 1. Build the Go backend

```bash
task build:backend --force
```

This compiles `wavesrv` (the Go backend) and `wsh` (the CLI tool) for all target platforms. The `--force` flag is important — Task's source fingerprinting can skip the build if it thinks nothing changed.

### 2. Build the frontend

```bash
npm run build:prod
```

Compiles the React frontend with Vite in production mode.

### 3. Package the app

```bash
rm -rf make/
npm exec electron-builder -- -c electron-builder.config.cjs -p never
```

Generates DMGs and zip archives for both ARM64 and x64:

```
make/Terminus-darwin-arm64-0.14.1.dmg
make/Terminus-darwin-x64-0.14.1.dmg
make/Terminus-darwin-arm64-0.14.1.zip
make/Terminus-darwin-x64-0.14.1.zip
```

### Important: Do NOT use `task package`

`task package` has a race condition where `clean` deletes `dist/`, then `build:backend` thinks wavesrv is up-to-date and skips it. The result is a broken app that launches but shows no window. Always use the three-step process above.

## Debugging

### Frontend

Open Chrome DevTools with `Cmd+Option+I`. Console logs from React, panel data fetching, and IPC calls appear here.

### Backend

Backend logs are at:
- **Dev:** `~/Library/Application Support/terminus-dev/waveapp.log`
- **Prod:** `~/Library/Application Support/Terminus/waveapp.log`

### Config directories

- **Dev:** `~/.config/terminus-dev/`
- **Prod:** `~/.config/terminus/`

Agent preferences, settings, widgets, and connection configs are stored here as JSON files.

## Icons

App icons live in `build/`. To regenerate from a new source image:

```bash
cd build
cp your-new-icon.png cube-1024.png
cp cube-1024.png icon.png

# Generate sized PNGs
for size in 16 32 48 64 128 256 512; do
  sips -z $size $size cube-1024.png --out icons/${size}x${size}.png
done

# Generate .icns for macOS
mkdir -p /tmp/icon.iconset
sips -z 16 16 cube-1024.png --out /tmp/icon.iconset/icon_16x16.png
sips -z 32 32 cube-1024.png --out /tmp/icon.iconset/icon_16x16@2x.png
sips -z 32 32 cube-1024.png --out /tmp/icon.iconset/icon_32x32.png
sips -z 64 64 cube-1024.png --out /tmp/icon.iconset/icon_32x32@2x.png
sips -z 128 128 cube-1024.png --out /tmp/icon.iconset/icon_128x128.png
sips -z 256 256 cube-1024.png --out /tmp/icon.iconset/icon_128x128@2x.png
sips -z 256 256 cube-1024.png --out /tmp/icon.iconset/icon_256x256.png
sips -z 512 512 cube-1024.png --out /tmp/icon.iconset/icon_256x256@2x.png
sips -z 512 512 cube-1024.png --out /tmp/icon.iconset/icon_512x512.png
cp cube-1024.png /tmp/icon.iconset/icon_512x512@2x.png
iconutil -c icns /tmp/icon.iconset -o icon.icns
rm -rf /tmp/icon.iconset
```

Then rebuild the packaged app for the icons to take effect.
