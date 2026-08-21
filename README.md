# scrn.5how.me Recorder

Native screen recorder for [scrn.5how.me](https://scrn.5how.me).
Records your screen, webcam and audio, then hands the recording off to the scrn.5how.me web editor.

Based on [OpenScreen](https://github.com/getopenscreen/openscreen) by Siddharth Vaddem, continued by Etienne Lescot.

## Download

Installers are published on the [Releases](https://github.com/5howme/scrn.5how.me/releases) page.

## Build from source

Requires Node.js 22.

```
npm ci
npm run build:win
```

The installer is written to `release/`.
Optional native capture helper: `npm run build:native:win` (requires CMake and MSVC).

## License

MIT — see [LICENSE](LICENSE).
