# WoW Compendium Helper

A Windows tray application that keeps the add-on installed and uploads what the
game recorded, in the background (docs/04 "The helper"). It hosts
`@compendium/sync-core` over a Tauri file adapter; the native side is tiny
(tray menu, "is the game running", install folder detection).

Built by GitHub Actions on Windows (`.github/workflows/helper.yml`) into an
unsigned NSIS installer (D-0025) attached to a GitHub release. The site's Add-on
page links to the latest release.

Local work: `pnpm --filter helper tauri dev` on a Windows machine with the Rust
toolchain. On Linux, `cargo check --target x86_64-pc-windows-msvc` in `src-tauri`
type-checks the native side without building.
