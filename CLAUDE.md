# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start        # Launch the Electron app
```

No build step, linter, or test suite is configured.

## Architecture

This is a single-window Electron app with no bundler. The two processes communicate via a single IPC channel (`notify`).

**Main process** (`main.js`): Creates the `BrowserWindow` with `nodeIntegration: true` / `contextIsolation: false`. Listens for `notify` IPC events and fires macOS native `Notification`s. Notification support is checked once at startup and cached.

**Renderer process** (`renderer.js`): All timer logic, state, and DOM manipulation live here. Key design points:
- Timer state is two variables: `timerId` (non-null iff running) and `timeLeft`. There is no separate `running` flag — use `timerId !== null` to check.
- Mode durations live in the `MODES` constant; there is no `totalTime` variable — the full duration is always read from `MODES[currentMode].duration`.
- `stopTimer()` is the single place that clears the interval, nulls `timerId`, and removes the `ticking` CSS class. `pause()`, `reset()`, and `onTimerEnd()` all delegate to it.
- Stats (today's count, total count) persist in `localStorage`. `increment(key)` is the shared helper; its return value is used directly in `onTimerEnd()` to avoid re-reading storage.
- Old daily keys (`pomodoro_YYYY-MM-DD`) are pruned at startup via `pruneOldKeys()` (keeps last 7 days).

**Styling** (`styles.css`): Uses CSS custom properties (`--accent`, `--bg`, `--surface`) on `:root`. Mode color changes are applied by setting `document.body.className` to `mode-short` or `mode-long`, which overrides `--accent` via body-scoped custom properties.
