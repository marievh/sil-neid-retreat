/**
 * NEID Global Retreat site: Google Sheets backend.
 *
 * This script is bound to the retreat Google Sheet (Extensions > Apps Script).
 * Before deploying, add a Script Property named EDITOR_PASSWORD
 * (Project Settings > Script Properties). The password never appears in the
 * website code; the site sends it here and this script checks it.
 *
 * Deploy as: Web app, Execute as "Me", Who has access "Anyone".
 * After changing this code: Deploy > Manage deployments > Edit > Version: New version.
 */

const TABS = {
  Settings:    ['key', 'value'],
  Days:        ['day_id', 'label', 'short_label', 'guiding_question'],
  Agenda:      ['day_id', 'item_id', 'start', 'end', 'title', 'description', 'led_by', 'kind', 'breakout_slot'],
  Slots:       ['slot_id', 'note'],
  Sessions:    ['slot_id', 'session_id', 'title', 'description'],
  People:      ['person_id', 'name', 'title', 'organization', 'bio'],
  Assignments: ['slot_id', 'person_id', 'person_name', 'session_id', 'facilitator']
};

/* ---------- Web app entry points ---------- */

// Public read. Returns nothing but {closed:true} while the public view is off.
function doGet() {
  const s = readState();
  if (!s.settings.publicView) return respond({ ok: true, closed: true });
  return respond({ ok: true, state: s });
}

// Editor actions: login, load, save. Every one requires the password.
function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return respond({ ok: false, error: 'bad_request' }); }

  if (!checkPassword(body.password)) return respond({ ok: false, error: 'bad_password' });

  if (body.action === 'login') return respond({ ok: true });
  if (body.action === 'load')  return respond({ ok: true, state: readState() });

  if (body.action === 'save') {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) return respond({ ok: false, error: 'busy' });
    try {
      const rev = getRev();
      // Someone else saved (or the Sheet was edited) since this editor last loaded.
      if (Number(body.rev) !== rev) return respond({ ok: false, conflict: true, state: readState() });
      writeState(body.state);
      setRev(rev + 1);
      return respond({ ok: true, rev: rev + 1 });
    } finally {
      lock.releaseLock();
    }
  }
  return respond({ ok: false, error: 'unknown_action' });
}

// Edits made directly in the Sheet bump the revision, so open editors refresh
// instead of overwriting them.
function onEdit(e) {
  const sh = e.range.getSheet();
  if (sh.getName() === 'Settings' && String(sh.getRange(e.range.getRow(), 1).getValue()) === 'revision') return;
  if (!TABS[sh.getName()]) return;
  setRev(getRev() + 1);
}

// Run this once from the editor to grant permissions and check the Sheet.
function testSetup() {
  const s = readState();
  Logger.log('People: %s, breakout slots: %s, agenda days: %s, public view: %s, password set: %s',
    s.people.length, s.rounds.length, s.agenda.length, s.settings.publicView,
    !!PropertiesService.getScriptProperties().getProperty('EDITOR_PASSWORD'));
}

/* ---------- Helpers ---------- */

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function checkPassword(given) {
  const real = PropertiesService.getScriptProperties().getProperty('EDITOR_PASSWORD');
  return !!real && typeof given === 'string' && given === real;
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

// Reads a tab as a list of objects keyed by header. Fills in any missing ids
// (for rows added by hand in the Sheet) and writes them back.
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

const truthy = v => /^(true|yes|on|1|x)$/i.test(String(v || '').trim());

function readState() {
  const set = settingsMap();
  const people = table('People', 'person_id', 'p').map(r => ({
    id: r.person_id, name: r.name, title: r.title, org: r.organization, bio: r.bio }));
  const sessions = table('Sessions', 'session_id', 's');
  const rounds = table('Slots', 'slot_id', 'r').map(sl => ({
    id: sl.slot_id, note: sl.note,
    sessions: sessions.filter(x => x.slot_id === sl.slot_id).map(x => ({ id: x.session_id, title: x.title, desc: x.description }))
  }));
  const items = table('Agenda', 'item_id', 'i');
  const agenda = table('Days', 'day_id', 'd').map(d => ({
    id: d.day_id, label: d.label, short: d.short_label, theme: d.guiding_question,
    items: items.filter(x => x.day_id === d.day_id).map(x => {
      const it = { id: x.item_id, start: x.start, end: x.end, title: x.title, desc: x.description, lead: x.led_by, kind: x.kind };
      if (x.breakout_slot) it.round = x.breakout_slot;
      return it;
    })
  }));
  const assign = {};
  rounds.forEach(r => { assign[r.id] = {}; });
  table('Assignments').forEach(a => {
    if (!a.slot_id || !a.person_id || !a.session_id) return;
    if (!assign[a.slot_id]) assign[a.slot_id] = {};
    assign[a.slot_id][a.person_id] = { s: a.session_id, f: truthy(a.facilitator) };
  });
  return {
    people, rounds, agenda, assign,
    settings: { publicView: truthy(set.public_view) },
    event: { name: set.event_name || '', subtitle: set.subtitle || '', dates: set.dates || '', place: set.place || '' },
    rev: Number(set.revision || 0)
  };
}

function writeTable(name, rows) {
  const sh = sheet(name);
  const head = TABS[name];
  sh.clearContents();
  const data = [head].concat(rows.map(r => head.map(h => (r[h] == null ? '' : String(r[h])))));
  const range = sh.getRange(1, 1, data.length, head.length);
  range.setNumberFormat('@');           // keep times like "9:30 am" as plain text
  range.setValues(data);
  sh.getRange(1, 1, 1, head.length).setFontWeight('bold');
}

function writeState(s) {
  const names = {};
  (s.people || []).forEach(p => { names[p.id] = p.name; });

  const set = settingsMap();
  set.public_view = s.settings && s.settings.publicView ? 'TRUE' : 'FALSE';
  const ev = s.event || {};
  set.event_name = ev.name || set.event_name || '';
  set.subtitle = ev.subtitle || set.subtitle || '';
  set.dates = ev.dates || set.dates || '';
  set.place = ev.place || set.place || '';
  writeTable('Settings', Object.keys(set).map(k => ({ key: k, value: set[k] })));

  writeTable('Days', (s.agenda || []).map(d => ({
    day_id: d.id, label: d.label, short_label: d.short, guiding_question: d.theme })));
  writeTable('Agenda', [].concat(...(s.agenda || []).map(d => (d.items || []).map(it => ({
    day_id: d.id, item_id: it.id, start: it.start, end: it.end, title: it.title, description: it.desc,
    led_by: it.lead, kind: it.kind, breakout_slot: it.round || '' })))));
  writeTable('Slots', (s.rounds || []).map(r => ({ slot_id: r.id, note: r.note })));
  writeTable('Sessions', [].concat(...(s.rounds || []).map(r => (r.sessions || []).map(x => ({
    slot_id: r.id, session_id: x.id, title: x.title, description: x.desc })))));
  writeTable('People', (s.people || []).map(p => ({
    person_id: p.id, name: p.name, title: p.title, organization: p.org, bio: p.bio })));
  const rows = [];
  Object.keys(s.assign || {}).forEach(slot => {
    Object.keys(s.assign[slot]).forEach(pid => {
      const a = s.assign[slot][pid];
      rows.push({ slot_id: slot, person_id: pid, person_name: names[pid] || '', session_id: a.s, facilitator: a.f ? 'TRUE' : '' });
    });
  });
  writeTable('Assignments', rows);
}
