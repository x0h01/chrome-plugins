# Changelog

## [1.1.1] - 2026-10-21

### Updated
- Stopped modules moved from their own tab to the top of the **Upgrade** tab.
- **⤴ 1-click upgrade** now starts stopped modules first, then updates, starts new versions and removes old ones.

### Fixed
- Updates for a stopped module show the newest installed version (e.g. `2.4.0 stopped → 2.6.0`) instead of `? → 2.6.0`.
- With two copies of the extension installed, only one runs on the page, so confirmations are no longer shown twice.

## [1.1] - 2026-10-21

### Added
- **Stopped** tab: lists stopped modules (no version running) that can be started and starts their newest startable version in bulk. Blocked modules whose dependencies get started along the way are started too.
- **Blocked** tab: lists modules that can't start because of missing dependencies, with the dependencies they need (red = not installed at all). Hovering an entry highlights its row in the modules table.

### Updated
- Panel title counter now shows **actionable / total** modules (upgrade or start stopped; blocked modules are not counted).

## [1.0] - 2026-10-21

- Initial release
