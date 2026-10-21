/*
 * Jahia Modules Helper
 * Runs inside the Modules admin iframe (settings.manageModules.html).
 *
 * Every Jahia action (update / start / undeploy) is a form POST that reloads
 * this page, so bulk runs are a small state machine persisted in
 * chrome.storage.local: on each page load we do the next pending action.
 */
(() => {
  'use strict';
  if (window.__jmhLoaded) return;
  window.__jmhLoaded = true;

  const STORE_KEY = 'jmh_run_' + location.host;
  const PREF_KEY = 'jmh_prefs';
  const MAX_STEPS = 300;
  const STALE_MS = 5 * 60 * 1000;
  const DRY = !!window.__JMH_DRY; // testing aid: plan only, never submit

  /**
   * Bulk-run state persisted in storage between page reloads.
   * @typedef {Object} RunState
   * @property {'all'|'update'|'start'|'remove'} mode Which phases to run (see PHASES).
   * @property {Object<string, boolean>} attempted Keys (see {@link keyOf}) of actions already tried, so failures are not retried forever.
   * @property {{msg: string, ok: boolean, err: string}[]} log Outcome of each finished action.
   * @property {number} steps Number of actions submitted so far (capped by MAX_STEPS).
   * @property {number} startedAt Epoch ms when the run began.
   * @property {number} lastStepAt Epoch ms of the last submitted action (used for STALE_MS).
   * @property {Object|null} current Serializable copy of the action submitted before the reload, or null.
   * @property {boolean} [stopped] Set by "Stop after current action"; the run ends at the next step.
   */

  // ---------- storage (falls back to memory when not running as an extension) ----------
  const mem = {};
  const hasChrome = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

  // After the extension is reloaded/updated, this script stays orphaned in open tabs and every
  // chrome.* call throws "Extension context invalidated". Detach the UI and park the caller.
  let orphaned = false;
  /**
   * Handle a dead extension context: remove the panel and click listener (once) and show a
   * sticky "reload the page" notice.
   * @returns {Promise<never>} A promise that never settles, so awaiting callers just stop.
   */
  function onOrphaned() {
    if (!orphaned) {
      orphaned = true;
      document.removeEventListener('click', onClick, true);
      const panel = document.getElementById('jmh-panel');
      if (panel) panel.remove();
      // Sticky notice (not a toast) so it isn't missed; this script can no longer do anything else.
      const n = document.createElement('div');
      n.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:100000;display:flex;align-items:center;gap:10px;' +
        'background:#333;color:#fff;padding:8px 12px;border-radius:6px;font:13px sans-serif';
      n.textContent = 'Modules Helper was updated. Reload the page to use it.';
      const b = document.createElement('button');
      b.textContent = 'Reload page';
      b.style.cssText = 'all:unset;cursor:pointer;padding:4px 8px;border-radius:4px;background:#00a0e3;color:#fff;font-weight:600;white-space:nowrap';
      b.addEventListener('click', () => location.reload());
      n.appendChild(b);
      document.body.appendChild(n);
    }
    return new Promise(() => {}); // never settles: stops the flow without unhandled rejections
  }
  /**
   * Wrap a callback-style chrome.* call in a promise, switching to orphaned mode instead of
   * throwing when the extension context has been invalidated.
   * @template T
   * @param {(resolve: (value: T) => void) => void} fn Performs the chrome call and passes `resolve` as its callback.
   * @returns {Promise<T>}
   */
  const chromeCall = (fn) => {
    if (!chrome.runtime || !chrome.runtime.id) return onOrphaned();
    return new Promise((resolve, reject) => {
      try {
        fn(resolve);
      } catch (e) {
        if (/context invalidated/i.test(e.message)) onOrphaned(); // leaves this promise pending
        else reject(e);
      }
    });
  };

  /**
   * Minimal async key/value store backed by chrome.storage.local, or by the in-memory `mem`
   * object when the script is loaded outside the extension (e.g. pasted into the console).
   */
  const store = {
    /** @param {string} k @returns {Promise<*>} Stored value, or undefined. */
    get: (k) => hasChrome
      ? chromeCall((r) => chrome.storage.local.get(k, (o) => r(o && o[k])))
      : Promise.resolve(mem[k]),
    /** @param {string} k @param {*} v Must be JSON-serializable. @returns {Promise<void>} */
    set: (k, v) => hasChrome
      ? chromeCall((r) => chrome.storage.local.set({ [k]: v }, r))
      : Promise.resolve((mem[k] = v)),
    /** @param {string} k @returns {Promise<void>} */
    del: (k) => hasChrome
      ? chromeCall((r) => chrome.storage.local.remove(k, r))
      : Promise.resolve(delete mem[k]),
  };

  /** @param {number} ms @returns {Promise<void>} Resolves after `ms` milliseconds. */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  /**
   * @param {Element|null} el
   * @returns {string} The element's text with whitespace collapsed, or '' when `el` is null.
   */
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

  // ---------- version comparison (1.10.0 > 1.9.0, 2.0.0 > 2.0.0-SNAPSHOT) ----------
  /**
   * Compare two versions: numeric parts numerically, then a release beats any qualifier
   * ("-SNAPSHOT", "-RC1"…), and two qualifiers compare as plain strings.
   * @param {string} a
   * @param {string} b
   * @returns {-1|0|1} 1 if a > b, -1 if a < b, 0 if equal.
   */
  function cmpVersion(a, b) {
    const parse = (v) => {
      const [main, ...q] = String(v).trim().split('-');
      return { nums: main.split('.').map((n) => parseInt(n, 10) || 0), qual: q.join('-') };
    };
    const pa = parse(a), pb = parse(b);
    const len = Math.max(pa.nums.length, pb.nums.length);
    for (let i = 0; i < len; i++) {
      const d = (pa.nums[i] || 0) - (pb.nums[i] || 0);
      if (d) return d > 0 ? 1 : -1;
    }
    if (pa.qual === pb.qual) return 0;
    if (!pa.qual) return 1;   // release beats qualifier
    if (!pb.qual) return -1;
    return pa.qual > pb.qual ? 1 : -1;
  }

  // ---------- page reading ----------
  /** @returns {HTMLTableElement|null} The DataTables modules table. */
  const getTable = () => document.querySelector('table.dataTable');
  /** @returns {HTMLSelectElement|null} The DataTables "Show N entries" select. */
  const getLengthSelect = () => document.querySelector('.dataTables_length select');

  /**
   * Poll until the modules table and its page-length select are rendered.
   * @param {number} [timeout=20000] Max wait in ms.
   * @returns {Promise<boolean>} true if found, false on timeout.
   */
  async function waitForTable(timeout = 20000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (getTable() && getLengthSelect()) return true;
      await sleep(200);
    }
    return false;
  }

  /**
   * Show every row (DataTables only keeps the current page in the DOM).
   * Adds an "All" (-1) option to the page-length select if missing and selects it.
   * @param {boolean} [clearFilter] Also clear the search box, so filtered-out rows are included.
   */
  function showAllRows(clearFilter) {
    const sel = getLengthSelect();
    if (!sel) return;
    if (!sel.querySelector('option[value="-1"]')) {
      const o = document.createElement('option');
      o.value = '-1';
      o.textContent = 'All';
      sel.appendChild(o);
    }
    if (sel.value !== '-1') {
      sel.value = '-1';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (clearFilter) {
      const f = document.querySelector('.dataTables_filter input');
      if (f && f.value) {
        f.value = '';
        f.dispatchEvent(new Event('input', { bubbles: true }));
        f.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      }
    }
  }

  /**
   * Parse the visible table rows into modules and their version chips
   * (active / inactive / available update). Rows without version chips are skipped.
   * @returns {Object[]} `{name, id, active, inactive, updates}`; each chip is `{ver}` plus its
   *   start / undeploy / install button where the page has one.
   */
  function readModules() {
    const rows = [...document.querySelectorAll('table.dataTable tbody tr')];
    const mods = [];
    for (const tr of rows) {
      const cells = tr.children;
      if (cells.length < 2) continue;
      const name = txt(cells[0]);
      const idMatch = name.match(/\(([^()]+)\)\s*$/);
      const chips = [...cells[1].querySelectorAll('.chip')];
      const m = { name, id: idMatch ? idMatch[1] : name, active: [], inactive: [], updates: [] };
      for (const c of chips) {
        const ver = (c.querySelector('input[name=version]') || {}).value || txt(c.querySelector('small'));
        if (!ver) continue;
        if (c.classList.contains('active-version')) {
          m.active.push({ ver });
        } else if (c.classList.contains('inactive-version')) {
          m.inactive.push({
            ver,
            startBtn: c.querySelector('button[name=_eventId_startModule]'),
            undeployBtn: c.querySelector('button[name=_eventId_undeployModule]'),
          });
        } else if (c.classList.contains('updateNotif')) {
          const btn = c.querySelector('button[name=_eventId_installModuleOnly]');
          if (btn) m.updates.push({ ver, btn });
        }
      }
      if (chips.length) mods.push(m);
    }
    return mods;
  }

  /**
   * @param {{ver: string}[]} list Version chips from {@link readModules}.
   * @returns {Object|null} The chip with the highest version, or null for an empty list.
   */
  const maxVer = (list) => list.reduce((best, v) => (!best || cmpVersion(v.ver, best.ver) > 0 ? v : best), null);

  /**
   * Build the list of actions per phase from what is currently on the page.
   * - updates: every available update chip;
   * - starts: the newest inactive version, if newer than the running one;
   * - removals: inactive versions older than the running one.
   * Modules with no running version get no start/remove actions.
   * Each action is `{type, module, label, ver, from|active, btn}`, where `btn` is the page button
   * that performs it.
   * @returns {{updates: Object[], starts: Object[], removals: Object[], total: number}}
   */
  function plan() {
    const mods = readModules();
    const updates = [], starts = [], removals = [];
    for (const m of mods) {
      const active = maxVer(m.active);
      for (const u of m.updates) {
        updates.push({ type: 'update', module: m.id, label: m.name, ver: u.ver, from: active && active.ver, btn: u.btn });
      }
      // Several versions installed and a newer one is not running -> start the newest.
      if (active) {
        const newest = maxVer(m.inactive.filter((i) => i.startBtn));
        if (newest && cmpVersion(newest.ver, active.ver) > 0) {
          starts.push({ type: 'start', module: m.id, label: m.name, ver: newest.ver, from: active.ver, btn: newest.startBtn });
        }
        // Inactive versions older than the running one -> remove.
        for (const i of m.inactive) {
          if (i.undeployBtn && cmpVersion(i.ver, active.ver) < 0) {
            removals.push({ type: 'remove', module: m.id, label: m.name, ver: i.ver, active: active.ver, btn: i.undeployBtn });
          }
        }
      }
    }
    return { updates, starts, removals, total: mods.length };
  }

  /**
   * @param {Object} a Action from {@link plan}.
   * @returns {string} Stable id of the action ("type:module:ver"), stable across page reloads.
   */
  const keyOf = (a) => `${a.type}:${a.module}:${a.ver}`;
  /**
   * @param {Object} a Action from {@link plan}, or the serialized `run.current`.
   * @returns {string} Human-readable summary for confirm dialogs, status and log.
   */
  const describe = (a) =>
    a.type === 'update' ? `Update ${a.module} ${a.from || '?'} → ${a.ver}`
    : a.type === 'start' ? `Start ${a.module} ${a.ver} (was ${a.from})`
    : `Remove ${a.module} ${a.ver} (running ${a.active})`;

  /** Run mode → ordered list of {@link plan} phases to execute. */
  const PHASES = {
    all: ['updates', 'starts', 'removals'],
    update: ['updates'],
    start: ['starts'],
    remove: ['removals'],
  };

  /**
   * Re-plan from the current page and pick the first not-yet-attempted action, in phase order.
   * Re-planning on every step lets later phases see the result of earlier ones
   * (e.g. a freshly installed update becomes a "start" candidate).
   * @param {RunState['mode']} mode
   * @param {Object<string, boolean>} attempted Keys of actions already tried.
   * @returns {Object|null} Action from {@link plan}, or null when there is nothing left to do.
   */
  function nextAction(mode, attempted) {
    const p = plan();
    for (const phase of PHASES[mode]) {
      const a = p[phase].find((x) => !attempted[keyOf(x)]);
      if (a) return a;
    }
    return null;
  }

  /**
   * Submit the form with the given button as submitter (skips the button's confirm() popup).
   * This triggers a page reload; in DRY mode it only logs.
   * @param {Object} a Action from {@link plan}.
   */
  function submitAction(a) {
    const form = a.btn.form || a.btn.closest('form');
    if (DRY) { console.log('[JMH dry-run] would submit', describe(a)); return; }
    if (form.requestSubmit) form.requestSubmit(a.btn);
    else a.btn.click();
  }

  /**
   * Read Jahia error messages shown on the page, used to judge whether the last action failed.
   * @returns {string[]} Up to 3 error texts; empty when the page shows none.
   */
  function pageMessages() {
    return [...document.querySelectorAll('.alert-danger, .alert-error, .text-danger.validationError')]
      .map(txt).filter(Boolean).slice(0, 3);
  }

  // ---------- run loop ----------
  /**
   * Start a bulk run: show the planned actions in a confirm() dialog, then persist a fresh
   * {@link RunState} and perform the first step.
   * @param {RunState['mode']} mode
   * @returns {Promise<void>}
   */
  async function startRun(mode) {
    const p = plan();
    const actions = PHASES[mode].flatMap((ph) => p[ph]);
    if (!actions.length) { toast('Nothing to do for this action.'); return; }
    let msg = (mode === 'all' ? 'Upgrade: ' : '') +
      `${actions.length} action(s) planned now:\n\n` + actions.map(describe).join('\n');
    if (mode === 'all') msg += '\n\nNew versions will then be started and old versions removed.';
    msg += '\n\nThe page will reload after each action. Continue?';
    if (!confirm(msg)) return;
    const run = { mode, attempted: {}, log: [], steps: 0, startedAt: Date.now(), lastStepAt: Date.now(), current: null };
    await store.set(STORE_KEY, run);
    await step(run);
  }

  /**
   * One iteration of the run state machine, called once per page load while a run is active:
   * log the outcome of the previous action, honour stop / step limit, then submit the next
   * action (which reloads the page and calls this again from {@link boot}).
   * @param {RunState} run
   * @returns {Promise<void>}
   */
  async function step(run) {
    // Record the outcome of the action submitted before the reload.
    if (run.current) {
      const errs = pageMessages();
      run.log.push({ msg: describe(run.current), ok: !errs.length, err: errs.join(' | ') });
      run.current = null;
    }
    if (run.stopped) return finish(run, 'Stopped.');
    if (run.steps >= MAX_STEPS) return finish(run, 'Stopped: step limit reached.');

    const a = nextAction(run.mode, run.attempted);
    if (!a) return finish(run, 'Done.');

    run.attempted[keyOf(a)] = true;
    run.current = { type: a.type, module: a.module, ver: a.ver, from: a.from, active: a.active };
    run.steps++;
    run.lastStepAt = Date.now();
    await store.set(STORE_KEY, run);
    renderPanel(run, `Running: ${describe(a)}…`);
    await sleep(400);
    submitAction(a);
    if (DRY) { await sleep(200); return step(run); }
  }

  /**
   * End a run: clear its stored state and show a summary with the full log.
   * @param {RunState} run
   * @param {string} status Prefix of the summary line, e.g. "Done." or "Stopped.".
   * @returns {Promise<void>}
   */
  async function finish(run, status) {
    await store.del(STORE_KEY);
    const ok = run.log.filter((l) => l.ok).length;
    const bad = run.log.length - ok;
    renderPanel(null, `${status} ${ok} succeeded${bad ? `, ${bad} failed` : ''}.`, run.log);
  }

  // ---------- UI ----------
  const CSS = `
  #jmh-panel{position:fixed;right:16px;bottom:16px;z-index:99999;width:300px;background:#fff;color:#222;
    font:13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.25);overflow:hidden}
  #jmh-panel header{background:#00a0e3;color:#fff;padding:8px 12px;font-weight:600;display:flex;justify-content:space-between;align-items:center;cursor:pointer}
  #jmh-panel .jmh-body{padding:10px 12px;display:flex;flex-direction:column;gap:6px}
  #jmh-panel.jmh-idle header{background:#8a939b}
  #jmh-panel.jmh-collapsed .jmh-body{display:none}
  #jmh-panel button.jmh-b{all:unset;box-sizing:border-box;padding:6px 10px;border-radius:4px;background:#f1f3f5;cursor:pointer;display:flex;justify-content:space-between}
  #jmh-panel button.jmh-b:hover{background:#e2e6ea}
  #jmh-panel button.jmh-b[disabled]{opacity:.45;cursor:default}
  #jmh-panel button.jmh-primary{background:#00a0e3;color:#fff;font-weight:600}
  #jmh-panel button.jmh-primary:hover{background:#008ac4}
  #jmh-panel button.jmh-stop{background:#d9534f;color:#fff;font-weight:600}
  #jmh-panel .jmh-n{font-weight:600}
  #jmh-panel .jmh-status{font-size:12px;color:#555}
  #jmh-panel .jmh-log{max-height:160px;overflow:auto;font-size:11px;border-top:1px solid #eee;padding-top:4px}
  #jmh-panel .jmh-log div.bad{color:#c0392b}
  #jmh-panel .jmh-list{max-height:120px;overflow:auto;font-size:11px;color:#555;padding:0 10px 2px}
  #jmh-panel .jmh-list div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #jmh-panel .jmh-count{font-weight:400;opacity:.85;margin-left:6px}
  #jmh-toast{position:fixed;right:16px;bottom:16px;z-index:100000;background:#333;color:#fff;padding:8px 12px;border-radius:6px;font:13px sans-serif}
  `;

  /**
   * Show a short-lived (2.5 s) notification in the bottom-right corner.
   * @param {string} msg
   */
  function toast(msg) {
    const t = document.createElement('div');
    t.id = 'jmh-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }

  /** UI preferences, persisted under PREF_KEY. */
  let prefs = { collapsed: false };

  /** Inject the panel stylesheet into the page once. */
  function ensureStyle() {
    if (document.getElementById('jmh-style')) return;
    const style = document.createElement('style');
    style.id = 'jmh-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  /**
   * Create or re-render the floating panel from a fresh {@link plan}.
   * While a run is active, action buttons are disabled and "Stop after current action" replaces
   * the 1-click upgrade button. User-facing strings are set via textContent, not innerHTML.
   * @param {RunState|null} run Active run, or null when idle.
   * @param {string} [status] Status line to show.
   * @param {RunState['log']} [log] Log entries to list (✓ / ✗).
   */
  function renderPanel(run, status, log) {
    let panel = document.getElementById('jmh-panel');
    if (!panel) {
      ensureStyle();
      panel = document.createElement('div');
      panel.id = 'jmh-panel';
      document.body.appendChild(panel);
    }
    panel.classList.toggle('jmh-collapsed', !!prefs.collapsed && !run);
    const p = plan();
    const busy = !!run;
    const listBox = (phase) => (p[phase].length ? `<div class="jmh-list" data-list="${phase}"></div>` : '');
    const upMods = new Set([...p.updates, ...p.starts, ...p.removals].map((a) => a.module)).size;
    // Gray header when there is nothing to update, start or remove.
    panel.classList.toggle('jmh-idle', !upMods && !busy);
    panel.innerHTML = `
      <header><span>Modules Helper: <span class="jmh-count" title="Upgradable out of total modules">${upMods} / ${p.total}</span></span><span>${prefs.collapsed && !run ? '▴' : '▾'}</span></header>
      <div class="jmh-body">
        <button class="jmh-b" data-a="update" ${busy || !p.updates.length ? 'disabled' : ''}>Update modules <span class="jmh-n">${p.updates.length}</span></button>
        ${listBox('updates')}
        <button class="jmh-b" data-a="start" ${busy || !p.starts.length ? 'disabled' : ''}>Start newest versions <span class="jmh-n">${p.starts.length}</span></button>
        ${listBox('starts')}
        <button class="jmh-b" data-a="remove" ${busy || !p.removals.length ? 'disabled' : ''}>Remove older versions <span class="jmh-n">${p.removals.length}</span></button>
        ${listBox('removals')}
        ${busy
          ? '<button class="jmh-b jmh-stop" data-a="stop">Stop after current action</button>'
          : `<button class="jmh-b jmh-primary" data-a="all" title="Update modules, start new versions, remove old versions" ${upMods ? '' : 'disabled'}>⤴ 1-click upgrade <span class="jmh-n">${upMods}</span></button>`}
        ${status ? `<div class="jmh-status"></div>` : ''}
        ${log && log.length ? `<div class="jmh-log"></div>` : ''}
      </div>`;
    for (const list of panel.querySelectorAll('.jmh-list')) {
      for (const a of p[list.dataset.list]) {
        const d = document.createElement('div');
        d.textContent = a.type === 'update' ? `${a.module} ${a.from || '?'} → ${a.ver}`
          : a.type === 'start' ? `${a.module} ${a.ver} (was ${a.from})`
          : `${a.module} ${a.ver} (running ${a.active})`;
        d.title = a.label;
        list.appendChild(d);
      }
    }
    if (status) panel.querySelector('.jmh-status').textContent = status;
    if (log && log.length) {
      const box = panel.querySelector('.jmh-log');
      for (const l of log) {
        const d = document.createElement('div');
        d.className = l.ok ? '' : 'bad';
        d.textContent = (l.ok ? '✓ ' : '✗ ') + l.msg + (l.err ? ' — ' + l.err : '');
        box.appendChild(d);
      }
    }
  }

  /**
   * Document-level (capture) click handler for the panel: the header toggles collapse,
   * "stop" flags the active run, and any other `data-a` button starts a run in that mode.
   * @param {MouseEvent} e
   * @returns {Promise<void>}
   */
  async function onClick(e) {
    const panel = document.getElementById('jmh-panel');
    if (!panel || !panel.contains(e.target)) return;
    if (e.target.closest('header')) {
      prefs.collapsed = !prefs.collapsed;
      await store.set(PREF_KEY, prefs);
      return renderPanel(await store.get(STORE_KEY));
    }
    const el = e.target.closest('[data-a]');
    if (!el || el.disabled) return;
    const a = el.dataset.a;
    if (a === 'stop') {
      const run = await store.get(STORE_KEY);
      if (run) { run.stopped = true; await store.set(STORE_KEY, run); }
      return renderPanel(run, 'Will stop after the current action finishes.');
    }
    // Bulk actions need every row in the DOM.
    showAllRows(true);
    await sleep(300);
    startRun(a);
  }

  // ---------- boot ----------
  /**
   * Entry point on every page load: wait for the table, load prefs, then either resume an
   * active run (discarding one idle longer than STALE_MS) or render the idle panel.
   * @returns {Promise<void>}
   */
  async function boot() {
    if (!(await waitForTable())) return;
    prefs = Object.assign(prefs, (await store.get(PREF_KEY)) || {});
    let run = await store.get(STORE_KEY);
    if (run && Date.now() - run.lastStepAt > STALE_MS) {
      // Left over from an interrupted session — don't silently resume.
      await store.del(STORE_KEY);
      renderPanel(null, 'A previous run was interrupted and has been cleared.', run.log);
      run = null;
    }
    showAllRows(!!run);
    await sleep(500);
    document.addEventListener('click', onClick, true);
    if (run) {
      renderPanel(run, 'Continuing…', run.log);
      await step(run);
    } else if (!document.getElementById('jmh-panel')) {
      renderPanel(null);
    }
  }

  /** Debug hooks for the DevTools console. */
  window.__jmh = { plan, cmpVersion, readModules };
  boot();
})();
