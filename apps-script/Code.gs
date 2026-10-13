/**
 * NEID Global Retreat site, version 2: Google Sheets backend.
 *
 * Bound to the retreat Google Sheet (Extensions > Apps Script).
 * Deploy as: Web app, Execute as "Me", Who has access "Anyone".
 * After any code change: Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy.
 *
 * Two codes, both set in Project Settings > Script Properties:
 *   ATTENDEE_CODE   one word shared with attendees. Lets them view the agenda and
 *                   breakout sessions (names, titles, organizations). Not case-sensitive.
 *   ADMIN_PASSWORD  for the planning team. Lets them edit the board and see bios,
 *                   focus areas, and interview details.
 * Nothing is sent to anyone without one of these codes, and only admins can save.
 *
 * Tabs: Settings, Days, Agenda, Slots, Sessions, People, Assignments, Profiles.
 * The site never edits Days, Agenda, or Settings; change those in the Sheet.
 * Settings holds only the revision number, which the script manages.
 */

const TABS = {
  Settings:    ['key', 'value'],
  Days:        ['day_id', 'label', 'short_label', 'guiding_question'],
  Agenda:      ['day_id', 'item_id', 'start', 'end', 'title', 'description', 'room', 'led_by', 'kind', 'breakout_slot'],
  Slots:       ['slot_id'],
  Sessions:    ['slot_id', 'session_id', 'title', 'description'],
  People:      ['person_id', 'name', 'title', 'organization', 'bio', 'focus_areas'],
  Assignments: ['slot_id', 'person_id', 'person_name', 'session_id', 'facilitator'],
  Profiles:    ['person_id', 'person_name', 'interviewee_characteristics', 'focus_1', 'focus_2', 'focus_3', 'strong_view', 'issue_tags']
};

/* ---------- Web app entry points ---------- */

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return respond({ ok: false, error: 'bad_request' }); }

  const codes = configuredCodes();
  if (!codes.attendee && !codes.admin) return respond({ ok: false, error: 'no_password_set' });
  const role = roleFor(body.code, codes);
  if (!role) {
    Utilities.sleep(1500);   // slows down anyone trying to guess the code
    return respond({ ok: false, error: 'bad_code' });
  }
  const admin = role === 'admin';

  // Everyone with a valid code: the agenda and the board. Admins also get bios and focus areas.
  if (body.action === 'login' || body.action === 'load') {
    return respond({ ok: true, role: role, state: admin ? cachedState() : publicState(cachedState()) });
  }

  // Everything below is admin-only.
  if (!admin) return respond({ ok: false, error: 'admin_only' });

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

  if (body.action === 'profiles') return respond({ ok: true, profiles: cachedProfiles() });

  if (body.action === 'saveProfile') {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) return respond({ ok: false, error: 'busy' });
    try {
      writeProfile(String(body.person_id || ''), String(body.person_name || ''), body.profile || {});
      CacheService.getScriptCache().remove('profiles');
      return respond({ ok: true });
    } finally {
      lock.releaseLock();
    }
  }

  return respond({ ok: false, error: 'unknown_action' });
}

// Opening the web app URL in a browser shows this: a quick check that the deployment works.
// It never returns any retreat data.
function doGet() {
  return respond({ ok: true, message: 'The retreat site backend is running.' });
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
  const codes = configuredCodes();
  Logger.log('People: %s. Breakout slots: %s. Agenda days: %s. Interview profiles matched: %s.',
    s.people.length, s.rounds.length, s.agenda.length, Object.keys(readProfiles()).length);
  Logger.log('Attendee code set: %s. Admin password set: %s.', !!codes.attendee, !!codes.admin);
  if (codes.attendee && codes.admin && codes.attendee.toLowerCase() === codes.admin.toLowerCase())
    Logger.log('WARNING: the attendee code and admin password are the same. Change one of them.');
}

/* ---------- Codes ---------- */

function configuredCodes() {
  const props = PropertiesService.getScriptProperties();
  return {
    attendee: String(props.getProperty('ATTENDEE_CODE') || '').trim(),
    admin: String(props.getProperty('ADMIN_PASSWORD') || props.getProperty('PLANNER_PASSWORD') || '').trim()
  };
}

function roleFor(given, codes) {
  const c = String(given || '').trim();
  if (!c) return '';
  if (codes.admin && c === codes.admin) return 'admin';
  if (codes.attendee && c.toLowerCase() === codes.attendee.toLowerCase()) return 'attendee';
  return '';
}

/* ---------- Cache: makes loading fast ---------- */

const CACHE_KEY = 'state';
function cachedState() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get(CACHE_KEY);
  if (hit) return JSON.parse(hit);
  const s = readState();
  const json = JSON.stringify(s);
  if (json.length < 90000) cache.put(CACHE_KEY, json, 600);
  return s;
}
function cachedProfiles() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('profiles');
  if (hit) return JSON.parse(hit);
  const p = readProfiles();
  const json = JSON.stringify(p);
  if (json.length < 90000) cache.put('profiles', json, 600);
  return p;
}
function clearCache() { CacheService.getScriptCache().removeAll([CACHE_KEY, 'profiles']); }

// What attendees receive: no bios or focus areas.
function publicState(s) {
  return Object.assign({}, s, {
    people: s.people.map(p => ({ id: p.id, name: p.name, title: p.title, org: p.org }))
  });
}

/* ---------- Reading and writing the Sheet ---------- */

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
  const set = settingsMap();
  const people = table('People', 'person_id', 'p').map(r => ({
    id: r.person_id, name: r.name, title: r.title, org: r.organization, bio: r.bio, focus: r.focus_areas || '' }));
  const sessions = table('Sessions', 'session_id', 's');
  const rounds = table('Slots', 'slot_id', 'r').map(sl => ({
    id: sl.slot_id,
    sessions: sessions.filter(x => x.slot_id === sl.slot_id).map(x => ({ id: x.session_id, title: x.title, desc: x.description }))
  }));
  const assign = {};
  rounds.forEach(r => { assign[r.id] = {}; });
  table('Assignments').forEach(a => {
    if (!a.slot_id || !a.person_id || !a.session_id || !assign[a.slot_id]) return;
    assign[a.slot_id][a.person_id] = { s: a.session_id, f: /^(true|yes|1|x)$/i.test(a.facilitator) };
  });
  const items = table('Agenda', 'item_id', 'i');
  const agenda = table('Days', 'day_id', 'd').map(d => ({
    id: d.day_id, label: d.label, short: d.short_label, theme: d.guiding_question,
    items: items.filter(x => x.day_id === d.day_id).map(x => ({
      id: x.item_id, start: x.start, end: x.end, title: x.title, desc: x.description,
      room: x.room || '', lead: x.led_by, kind: x.kind, round: x.breakout_slot || '' }))
  }));
  return {
    people, rounds, assign, agenda,
    rev: Number(set.revision || 0)
  };
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

// Saves the board. Days, Agenda, Settings and Profiles are never rewritten here.
function writeState(s) {
  const names = {};
  (s.people || []).forEach(p => { names[p.id] = p.name; });
  writeTable('Slots', (s.rounds || []).map(r => ({ slot_id: r.id })));
  writeTable('Sessions', [].concat(...(s.rounds || []).map(r => (r.sessions || []).map(x => ({
    slot_id: r.id, session_id: x.id, title: x.title, description: x.desc })))));
  writeTable('People', (s.people || []).map(p => ({
    person_id: p.id, name: p.name, title: p.title, organization: p.org, bio: p.bio || '', focus_areas: p.focus || '' })));
  const rows = [];
  Object.keys(s.assign || {}).forEach(slot => Object.keys(s.assign[slot]).forEach(pid => {
    const a = s.assign[slot][pid];
    rows.push({ slot_id: slot, person_id: pid, person_name: names[pid] || '', session_id: a.s, facilitator: a.f ? 'TRUE' : '' });
  }));
  writeTable('Assignments', rows);
}

// Profiles keyed by person_id. Rows without a matching id are matched by name.
function readProfiles() {
  const people = table('People');
  const byName = {};
  people.forEach(p => { byName[String(p.name).toLowerCase()] = p.person_id; });
  const ids = new Set(people.map(p => p.person_id));
  const out = {};
  table('Profiles').forEach(r => {
    const id = ids.has(r.person_id) ? r.person_id : byName[String(r.person_name).toLowerCase()];
    if (!id) return;
    out[id] = {
      chars: r.interviewee_characteristics, f1: r.focus_1, f2: r.focus_2, f3: r.focus_3, view: r.strong_view,
      tags: String(r.issue_tags || '').split(/[;\n]/).map(t => t.trim()).filter(Boolean)
    };
  });
  return out;
}

// Updates one person's row in the Profiles tab (matched by id, then name), or adds a row.
function writeProfile(id, name, p) {
  const sh = sheet('Profiles');
  const values = sh.getDataRange().getDisplayValues();
  const head = values[0].map(h => String(h).trim());
  const col = h => head.indexOf(h);
  let row = -1;
  for (let i = 1; i < values.length; i++) {
    if (id && String(values[i][col('person_id')]).trim() === id) { row = i; break; }
  }
  if (row < 0 && name) for (let i = 1; i < values.length; i++) {
    if (String(values[i][col('person_name')]).trim().toLowerCase() === name.toLowerCase()) { row = i; break; }
  }
  const rec = {
    person_id: id, person_name: name, interviewee_characteristics: p.chars || '',
    focus_1: p.f1 || '', focus_2: p.f2 || '', focus_3: p.f3 || '',
    strong_view: p.view || '', issue_tags: (p.tags || []).join('; ')
  };
  const line = head.map((h, j) => (h in rec ? rec[h] : (row >= 0 ? values[row][j] : '')));
  const target = row >= 0 ? row + 1 : Math.max(sh.getLastRow(), 1) + 1;
  sh.getRange(target, 1, 1, head.length).setNumberFormat('@').setValues([line]);
}
