/**
 * ============================================================
 *  TRAINER RATING → GOOGLE SHEET  (Google Apps Script)
 * ============================================================
 *  സെറ്റപ്പ്:
 *   1. Google Sheet ഉണ്ടാക്കുക → Extensions ▸ Apps Script
 *   2. ഈ കോഡ് മുഴുവൻ പേസ്റ്റ് ചെയ്യുക (Code.gs) → Save
 *   3. Deploy ▸ New deployment ▸ Type: Web app
 *        Execute as        : Me
 *        Who has access    : Anyone            ⬅️ വളരെ പ്രധാനം
 *   4. കിട്ടുന്ന Web App URL index.html-ലെ SCRIPT_URL-ൽ ഒട്ടിക്കുക
 *
 *  കോഡ് മാറ്റിയാൽ എപ്പോഴും: Deploy ▸ Manage deployments ▸ ✏️ ▸ Version: New ▸ Deploy
 * ============================================================
 */

/** ഏത് ഷീറ്റിൽ എഴുതണം */
var SHEET_NAME   = 'Responses';
var SUMMARY_NAME = 'Summary';

/** ചോദ്യങ്ങൾ — index.html-ലെ QUESTIONS-ന്റെ അതേ key/ക്രമം */
var QUESTIONS = [
  { key: 'q1', text: 'എളുപ്പത്തിൽ സമീപിക്കാനാകുന്ന ട്രെയിനർ' },
  { key: 'q2', text: 'വ്യക്തമായി വിശദീകരിക്കുന്ന ട്രെയിനർ' },
  { key: 'q3', text: 'ക്ഷമയോടെ സംശയം പരിഹരിക്കുന്ന ട്രെയിനർ' },
  { key: 'q4', text: 'മുന്നോട്ട് പോകാൻ പ്രോത്സാഹിപ്പിക്കുന്ന ട്രെയിനർ' }
];


/* ============================================================
   POST — ഫോമിൽ നിന്ന് വരുന്ന ഡാറ്റ സേവ് ചെയ്യുന്നു
============================================================ */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);                       // ഒരേ സമയം വരുന്ന റിക്വസ്റ്റുകൾ കൂടിക്കുഴയാതിരിക്കാൻ

    var body = (e && e.postData && e.postData.contents) || '{}';
    var data = JSON.parse(body);

    var sheet = getSheet_();
    var ans   = data.answers || {};

    // Timestamp + Batch + Space (പേര് ശേഖരിക്കുന്നില്ല — അജ്ഞാതം)
    var row = [ new Date(), String(data.batch || ''), String(data.space || '') ];
    for (var i = 0; i < QUESTIONS.length; i++) {
      row.push(String(ans[QUESTIONS[i].key] || ''));
    }
    row.push(String(data.userAgent || ''));

    sheet.appendRow(row);

    return json_({ ok: true, row: sheet.getLastRow() });

  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}


/* ============================================================
   GET — ബ്രൗസറിൽ URL തുറന്നാൽ ലൈവ് ലീഡർബോർഡ് JSON കിട്ടും
          ?action=leaderboard   (default)
============================================================ */
function doGet(e) {
  try {
    return json_({ ok: true, leaderboard: buildTally_() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}


/* ============================================================
   HELPERS
============================================================ */

/** ഷീറ്റ് ഉണ്ടാക്കുക / ഹെഡ്ഡർ ഉറപ്പാക്കുക */
function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);

  if (sh.getLastRow() === 0) {
    var head = ['Timestamp', 'Batch', 'Space'];
    for (var i = 0; i < QUESTIONS.length; i++) {
      head.push((i + 1) + '. ' + QUESTIONS[i].text);
    }
    head.push('User Agent');

    sh.appendRow(head);
    sh.getRange(1, 1, 1, head.length)
      .setFontWeight('bold')
      .setBackground('#ffc400')
      .setFontColor('#141318')
      .setVerticalAlignment('middle')
      .setWrap(true);
    sh.setRowHeight(1, 56);
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 160);
    sh.setColumnWidth(2, 120);
    sh.setColumnWidth(3, 90);
  }
  return sh;
}

/** ഓരോ ചോദ്യത്തിനും ആർക്കാണ് കൂടുതൽ വോട്ട് എന്ന് എണ്ണുന്നു */
function buildTally_() {
  var sh = getSheet_();
  var out = { totalResponses: 0, questions: [], overall: [] };
  if (sh.getLastRow() < 2) return out;

  var values = sh.getRange(2, 1, sh.getLastRow() - 1, 3 + QUESTIONS.length).getValues();
  out.totalResponses = values.length;

  var overall = {};

  for (var q = 0; q < QUESTIONS.length; q++) {
    var counts = {};
    for (var r = 0; r < values.length; r++) {
      var name = String(values[r][3 + q] || '').trim();   // 0=Timestamp 1=Batch 2=Space
      if (!name) continue;
      counts[name]  = (counts[name]  || 0) + 1;
      overall[name] = (overall[name] || 0) + 1;
    }
    out.questions.push({
      key: QUESTIONS[q].key,
      text: QUESTIONS[q].text,
      results: sortCounts_(counts)
    });
  }
  out.overall = sortCounts_(overall);
  return out;
}

function sortCounts_(obj) {
  return Object.keys(obj)
    .map(function (k) { return { trainer: k, votes: obj[k] }; })
    .sort(function (a, b) { return b.votes - a.votes; });
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


/* ============================================================
   📊  Summary ഷീറ്റ് ഉണ്ടാക്കാൻ — Apps Script എഡിറ്ററിൽ നിന്ന്
        buildSummarySheet എന്ന ഫംഗ്ഷൻ ▶️ Run ചെയ്യുക
============================================================ */
function buildSummarySheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SUMMARY_NAME) || ss.insertSheet(SUMMARY_NAME);
  sh.clear();

  var tally = buildTally_();
  var rows  = [['ചോദ്യം', 'ട്രെയിനർ', 'വോട്ട്']];

  rows.push(['— ആകെ റെസ്പോൺസ് —', tally.totalResponses, '']);
  rows.push(['', '', '']);

  rows.push(['★ OVERALL (എല്ലാ ചോദ്യങ്ങളും ചേർത്ത്)', '', '']);
  tally.overall.forEach(function (o) { rows.push(['', o.trainer, o.votes]); });
  rows.push(['', '', '']);

  tally.questions.forEach(function (q) {
    rows.push([q.text, '', '']);
    q.results.forEach(function (r) { rows.push(['', r.trainer, r.votes]); });
    rows.push(['', '', '']);
  });

  sh.getRange(1, 1, rows.length, 3).setValues(rows);
  sh.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#ffc400').setFontColor('#141318');
  sh.setColumnWidth(1, 420);
  sh.setColumnWidth(2, 200);
  sh.setFrozenRows(1);
  SpreadsheetApp.getUi().alert('Summary ഷീറ്റ് അപ്ഡേറ്റ് ചെയ്തു ✅');
}

/** ഷീറ്റിൽ ഒരു മെനു — Trainer Rating ▸ Refresh Summary */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Trainer Rating')
    .addItem('📊 Refresh Summary', 'buildSummarySheet')
    .addToUi();
}
