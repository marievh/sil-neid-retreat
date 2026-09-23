/**
 * NEID Global Retreat breakout planning: Google Sheets backend.
 *
 * Bound to the retreat Google Sheet (Extensions > Apps Script).
 * There is no password for now: anyone with the site link can view and edit.
 * Google Sheets version history (File > Version history) can undo unwanted changes.
 * Deploy as: Web app, Execute as "Me", Who has access "Anyone".
 * After any code change: Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy.
 *
 * Uses these tabs: Settings, Slots, Sessions, People, Assignments.
 * Any other tabs in the Sheet (such as Days and Agenda) are left alone.
 */

// (Unused: the site names slots Breakout Session 1, 2, ... by their order.)
const DEFAULT_LABELS = {};

const TABS = {
  Settings:    ['key', 'value'],
  Slots:       ['slot_id', 'label', 'note'],
  Sessions:    ['slot_id', 'session_id', 'title', 'description'],
  People:      ['person_id', 'name', 'title', 'organization', 'bio', 'focus_areas'],
  Assignments: ['slot_id', 'person_id', 'person_name', 'session_id', 'facilitator']
};

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return respond({ ok: false, error: 'bad_request' }); }

  if (body.action === 'load') return respond({ ok: true, state: cachedState() });

  if (body.action === 'save') {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) return respond({ ok: false, error: 'busy' });
    try {
      const rev = getRev();
      if (Number(body.rev) !== rev) return respond({ ok: false, conflict: true, state: cachedState() });
      writeState(body.state);
      setRev(rev + 1);
      clearCache();
      return respond({ ok: true, rev: rev + 1 });
    } finally {
      lock.releaseLock();
    }
  }
  return respond({ ok: false, error: 'unknown_action' });
}

// Opening the web app URL in a browser shows this, which is a quick way to
// confirm the deployment is reachable.
function doGet() {
  return respond({ ok: true, message: 'The breakout planning backend is running.' });
}

// Edits made directly in the Sheet bump the revision, so open pages refresh.
function onEdit(e) {
  const sh = e.range.getSheet();
  if (!TABS[sh.getName()]) return;
  if (sh.getName() === 'Settings' && String(sh.getRange(e.range.getRow(), 1).getValue()) === 'revision') return;
  setRev(getRev() + 1);
  clearCache();
}

// Run once from the editor to grant permissions and check the setup.
function testSetup() {
  const s = readState();
  Logger.log('People: %s. Breakout slots: %s (%s).',
    s.people.length, s.rounds.length, s.rounds.map(r => r.label).join(', '));
}

/* ---------- Cache: makes sign-in and refreshes fast ---------- */
// Reading five tabs takes a second or two; the cached copy comes back almost instantly.
// It's cleared whenever anything changes, and expires after 10 minutes regardless.
const CACHE_KEY = 'state';
function cachedState() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get(CACHE_KEY);
  if (hit) return JSON.parse(hit);
  const s = readState();
  const json = JSON.stringify(s);
  if (json.length < 95000) cache.put(CACHE_KEY, json, 600);
  return s;
}
function clearCache() { CacheService.getScriptCache().remove(CACHE_KEY); }

/* ---------- Helpers ---------- */

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, TABS[name].length).setValues([TABS[name]]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

// A tab as a list of objects keyed by header. Fills in blank ids for rows added by hand.
function table(name, idCol, prefix) {
  const sh = sheet(name);
  const values = sh.getDataRange().getDisplayValues();
  const head = values.shift().map(h => String(h).trim());
  const rows = [];
  values.forEach((r, i) => {
    if (!r.some(c => String(c).trim() !== '')) return;
    const o = {};
    head.forEach((h, j) => { o[h] = String(r[j] == null ? '' : r[j]).trim(); });
    if (idCol && !o[idCol] && head.indexOf(idCol) >= 0) {
      o[idCol] = prefix + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
      sh.getRange(i + 2, head.indexOf(idCol) + 1).setValue(o[idCol]);
    }
    rows.push(o);
  });
  return rows;
}

function settingsMap() {
  const m = {};
  table('Settings').forEach(r => { m[r.key] = r.value; });
  return m;
}
function getRev() { return Number(settingsMap().revision || 0); }
function setRev(n) {
  const sh = sheet('Settings');
  const keys = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues().map(r => String(r[0]));
  const i = keys.indexOf('revision');
  if (i >= 0) sh.getRange(i + 1, 2).setValue(String(n));
  else sh.appendRow(['revision', String(n)]);
}

function readState() {
  const people = table('People', 'person_id', 'p').map(r => ({
    id: r.person_id, name: r.name, title: r.title, org: r.organization, bio: r.bio, focus: r.focus_areas || '' }));
  const sessions = table('Sessions', 'session_id', 's');
  const rounds = table('Slots', 'slot_id', 'r').map(sl => ({
    id: sl.slot_id, label: sl.label || DEFAULT_LABELS[sl.slot_id] || sl.slot_id, note: sl.note || '',
    sessions: sessions.filter(x => x.slot_id === sl.slot_id).map(x => ({ id: x.session_id, title: x.title, desc: x.description }))
  }));
  const assign = {};
  rounds.forEach(r => { assign[r.id] = {}; });
  table('Assignments').forEach(a => {
    if (!a.slot_id || !a.person_id || !a.session_id || !assign[a.slot_id]) return;
    assign[a.slot_id][a.person_id] = { s: a.session_id, f: /^(true|yes|1|x)$/i.test(a.facilitator) };
  });
  return { people, rounds, assign, rev: getRev() };
}

function writeTable(name, rows) {
  const sh = sheet(name);
  const head = TABS[name];
  sh.clearContents();
  const data = [head].concat(rows.map(r => head.map(h => (r[h] == null ? '' : String(r[h])))));
  const range = sh.getRange(1, 1, data.length, head.length);
  range.setNumberFormat('@');
  range.setValues(data);
  sh.getRange(1, 1, 1, head.length).setFontWeight('bold');
}

function writeState(s) {
  const names = {};
  (s.people || []).forEach(p => { names[p.id] = p.name; });
  writeTable('Slots', (s.rounds || []).map(r => ({ slot_id: r.id, label: r.label, note: r.note })));
  writeTable('Sessions', [].concat(...(s.rounds || []).map(r => (r.sessions || []).map(x => ({
    slot_id: r.id, session_id: x.id, title: x.title, description: x.desc })))));
  writeTable('People', (s.people || []).map(p => ({
    person_id: p.id, name: p.name, title: p.title, organization: p.org, bio: p.bio, focus_areas: p.focus || '' })));
  const rows = [];
  Object.keys(s.assign || {}).forEach(slot => Object.keys(s.assign[slot]).forEach(pid => {
    const a = s.assign[slot][pid];
    rows.push({ slot_id: slot, person_id: pid, person_name: names[pid] || '', session_id: a.s, facilitator: a.f ? 'TRUE' : '' });
  }));
  writeTable('Assignments', rows);
}
