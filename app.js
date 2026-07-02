'use strict';

/* =================================================================
   مساعد سلمى الشخصي — كل المنطق في ملف واحد، يعمل دون إنترنت
   ================================================================= */

const AR = 'ar-EG-u-nu-latn';
const WEEK = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const TRACK_COLORS = ['#e11d48', '#ea580c', '#d97706', '#16a34a', '#0d9488', '#0284c7', '#4f46e5', '#7c3aed', '#c026d3', '#db2777', '#65a30d', '#0891b2', '#9333ea'];
const SEED_TRACKS = ['الرياضة', 'العلوم الشرعية', 'العلوم الطبيعية', 'الأدب', 'القرآن', 'المقرأة', 'مجلس التدبر', 'أعمال بحثية', 'الشغل', 'الدروس', 'المعارض', 'الترفيه', 'المشاريع الاستثمارية'];

const SVG = {
  check: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  clock: '<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  exam: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 2h9l5 5v15H6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M14 2v6h6M9 13l2 2 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  course: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M22 9 12 5 2 9l10 4 10-4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M6 11v5c0 1 2.7 2 6 2s6-1 6-2v-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  book: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 7C10.5 5.7 8 5.2 5 5.6v11.5c3-.4 5.5.1 7 1.4 1.5-1.3 4-1.8 7-1.4V5.6c-3-.4-5.5.1-7 1.4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 7v11.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'
};

/* ============ التخزين المحلي ============ */
const KEYS = ['tasks', 'appointments', 'courses', 'exams', 'tracks', 'results', 'books', 'reading', 'purchases', 'notified'];
// الأقسام التي تتزامن سحابيًا (كل شيء عدا notified الخاص بالجهاز)
const SYNC_KEYS = ['tasks', 'appointments', 'courses', 'exams', 'tracks', 'results', 'books', 'reading', 'purchases'];
const store = {};
KEYS.forEach((k) => {
  try { store[k] = JSON.parse(localStorage.getItem('salma.' + k)) || []; }
  catch (e) { store[k] = []; }
});
try { store._deleted = JSON.parse(localStorage.getItem('salma._deleted')) || []; } catch (e) { store._deleted = []; }
function persist(k) {
  if (k === 'notified' && store.notified.length > 300) store.notified = store.notified.slice(-200);
  localStorage.setItem('salma.' + k, JSON.stringify(store[k]));
  if (k !== 'notified' && typeof Sync !== 'undefined' && Sync.onLocalChange) Sync.onLocalChange();
}
// سجل المحذوفات (لتنتشر عمليات الحذف بين الأجهزة)
function tombstone(id) {
  if (!id) return;
  store._deleted = store._deleted.filter((t) => t.id !== id);
  store._deleted.push({ id, at: Date.now() });
  if (store._deleted.length > 600) store._deleted = store._deleted.slice(-500);
  persist('_deleted');
}
function upsert(coll, obj) {
  obj.updatedAt = Date.now();
  const arr = store[coll];
  const i = arr.findIndex((x) => x.id === obj.id);
  if (i >= 0) arr[i] = { ...arr[i], ...obj }; else arr.push(obj);
  persist(coll);
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ============ أدوات مساعدة ============ */
const $ = (s) => document.querySelector(s);
const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const firstChar = (s) => (String(s || '').trim()[0] || '•');
function stripTime(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(from, n) { const d = stripTime(from); d.setDate(d.getDate() + n); return d; }
function nextWeekday(from, target) { const d = stripTime(from); const diff = (target - d.getDay() + 7) % 7; d.setDate(d.getDate() + diff); return d; }
function dateToISO(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayISO() { return dateToISO(new Date()); }
function fmtDayMonth(iso) { try { return new Date(iso + 'T00:00').toLocaleDateString(AR, { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { return iso; } }
function fmtFull(iso) { try { return new Date(iso + 'T00:00').toLocaleDateString(AR, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return iso; } }
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const d = new Date(); d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString(AR, { hour: 'numeric', minute: '2-digit', hour12: true });
}
function relDate(iso) {
  const d = stripTime(new Date(iso + 'T00:00'));
  const diff = Math.round((d - stripTime(new Date())) / 86400000);
  let label = diff === 0 ? 'اليوم' : diff === 1 ? 'غدًا' : diff === -1 ? 'أمس' : fmtDayMonth(iso);
  let cls = diff < 0 ? 'over' : diff <= 2 ? 'soon' : '';
  return { label, cls, diff };
}
const catLabel = (c) => ({ daily: 'يومية', weekly: 'أسبوعية', yearly: 'سنوية', general: 'عامة' }[c] || 'يومية');
const typeLabel = (t) => ({ task: 'مهمة', appointment: 'موعد', exam: 'امتحان', course: 'كورس', track: 'مسار', result: 'نتيجة', book: 'كتاب', reading: 'تسجيل قراءة', purchase: 'مادة مشتريات' }[t] || '');

/* ============ بناء بطاقات العرض ============ */
const tag = (text, cls) => `<span class="tag ${cls || ''}">${esc(text)}</span>`;
const emptyHTML = (msg) => `<div class="empty">${esc(msg)}</div>`;

function taskCard(t) {
  const tags = [];
  if (t.date) { const r = relDate(t.date); tags.push(tag(r.label + (t.time ? ' • ' + fmtTime(t.time) : ''), r.cls || 'time')); }
  else if (t.time) tags.push(tag(fmtTime(t.time), 'time'));
  tags.push(tag(catLabel(t.category)));
  if (t.track) { const tr = store.tracks.find((x) => x.id === t.track); if (tr) tags.push(`<span class="tag" style="background:${tr.color}22;color:${tr.color}">${esc(tr.name)}</span>`); }
  if (t.remind && !t.done) tags.push(tag('تذكير', 'soon'));
  return `<div class="card ${t.done ? 'done' : ''}" data-type="task" data-id="${t.id}">
    <button class="check" aria-label="إكمال">${SVG.check}</button>
    <div class="body"><div class="title">${esc(t.title)}</div><div class="meta">${tags.join('')}</div></div>
    <button class="del" aria-label="حذف">${SVG.trash}</button></div>`;
}
function apptCard(a) {
  const r = relDate(a.date);
  const tags = [tag(r.label + (a.time ? ' • ' + fmtTime(a.time) : ''), r.cls || 'time')];
  if (a.note) tags.push(tag(a.note, 'place'));
  return `<div class="card" data-type="appointment" data-id="${a.id}">
    <div class="icon-chip">${SVG.clock}</div>
    <div class="body"><div class="title">${esc(a.title)}</div><div class="meta">${tags.join('')}</div></div>
    <button class="del" aria-label="حذف">${SVG.trash}</button></div>`;
}
function examCard(x) {
  const r = relDate(x.date);
  const tags = [tag(r.label + (x.time ? ' • ' + fmtTime(x.time) : ''), r.cls || 'soon')];
  if (x.place) tags.push(tag(x.place, 'place'));
  return `<div class="card" data-type="exam" data-id="${x.id}">
    <div class="icon-chip exam">${SVG.exam}</div>
    <div class="body"><div class="title">امتحان ${esc(x.subject)}</div><div class="meta">${tags.join('')}</div></div>
    <button class="del" aria-label="حذف">${SVG.trash}</button></div>`;
}
function courseCard(c) {
  const tags = [];
  if (c.day !== '' && c.day != null) tags.push(tag('كل ' + WEEK[+c.day], 'time'));
  if (c.time) tags.push(tag(fmtTime(c.time), 'time'));
  if (c.instructor) tags.push(tag(c.instructor, 'place'));
  return `<div class="card" data-type="course" data-id="${c.id}">
    <div class="icon-chip course">${SVG.course}</div>
    <div class="body"><div class="title">${esc(c.name)}</div><div class="meta">${tags.join('')}</div></div>
    <button class="del" aria-label="حذف">${SVG.trash}</button></div>`;
}

function gradeLabel(pct) {
  if (pct >= 90) return 'ممتاز';
  if (pct >= 80) return 'جيد جدًا';
  if (pct >= 70) return 'جيد';
  if (pct >= 60) return 'مقبول';
  return 'ضعيف';
}
function gradeClass(pct) {
  if (pct >= 90) return 'g-ex';
  if (pct >= 80) return 'g-vg';
  if (pct >= 70) return 'g-g';
  if (pct >= 60) return 'g-ok';
  return 'g-weak';
}
function computeResults(arr) {
  const anyCredit = arr.some((r) => parseFloat(r.credit) > 0);
  let totW = 0, sumW = 0;
  arr.forEach((r) => {
    const max = parseFloat(r.maxScore) || 100;
    const pct = (parseFloat(r.score) || 0) / max * 100;
    const w = anyCredit ? (parseFloat(r.credit) || 0) : 1;
    totW += w; sumW += pct * w;
  });
  return { avg: totW ? sumW / totW : 0, anyCredit };
}
function resultCard(r) {
  const max = parseFloat(r.maxScore) || 100;
  const pct = (parseFloat(r.score) || 0) / max * 100;
  const tags = [tag(`${r.score} / ${max}`, 'place'), tag(gradeLabel(pct))];
  if (parseFloat(r.credit) > 0) tags.push(tag(r.credit + ' ساعة', 'time'));
  return `<div class="card" data-type="result" data-id="${r.id}">
    <div class="icon-chip result ${gradeClass(pct)}">${Math.round(pct)}</div>
    <div class="body"><div class="title">${esc(r.subject)}</div><div class="meta">${tags.join('')}</div></div>
    <button class="del" aria-label="حذف">${SVG.trash}</button></div>`;
}

function bookPagesRead(id) { return store.reading.filter((e) => e.bookId === id).reduce((s, e) => s + (parseFloat(e.pages) || 0), 0); }
function bookStatusTag(b, read) {
  if (b.status === 'done' || (parseFloat(b.totalPages) > 0 && read >= parseFloat(b.totalPages))) return tag('انتهيت', 'time');
  if (b.status === 'reading' || read > 0) return tag('أقرؤه الآن', 'soon');
  return tag('للقراءة');
}
function bookCard(b) {
  const read = bookPagesRead(b.id);
  const total = parseFloat(b.totalPages) || 0;
  const pct = total ? Math.min(100, read / total * 100) : 0;
  let prog = '';
  if (total) prog = `<div class="book-prog"><div class="book-prog-bar" style="width:${pct}%"></div></div><div class="book-prog-text">${read} / ${total} صفحة (${Math.round(pct)}%)</div>`;
  else if (read) prog = `<div class="book-prog-text">${read} صفحة مقروءة</div>`;
  return `<div class="card book-card" data-type="book" data-id="${b.id}">
    <div class="icon-chip book">${SVG.book}</div>
    <div class="body"><div class="title">${esc(b.title)}</div>${b.author ? `<div class="muted" style="font-size:.78rem">${esc(b.author)}</div>` : ''}<div class="meta">${bookStatusTag(b, read)}</div>${prog}</div>
    <button class="log-btn" data-log-book="${b.id}" aria-label="تسجيل قراءة">+</button>
    <button class="del" aria-label="حذف">${SVG.trash}</button></div>`;
}
function purchaseCard(p) {
  const tags = [];
  if (p.qty) tags.push(tag(p.qty, 'time'));
  if (p.category) tags.push(tag(p.category, 'place'));
  return `<div class="card ${p.bought ? 'done' : ''}" data-type="purchase" data-id="${p.id}">
    <button class="check" aria-label="تعليم كمشتراة">${SVG.check}</button>
    <div class="body"><div class="title">${esc(p.name)}</div>${tags.length ? `<div class="meta">${tags.join('')}</div>` : ''}</div>
    <button class="del" aria-label="حذف">${SVG.trash}</button></div>`;
}

/* ============ العرض ============ */
let taskCat = 'daily';
let currentTrack = null;
let readingTab = 'books';
let shopFilter = 'todo';

function updateStats() {
  const today = todayISO();
  $('#stat-tasks').textContent = store.tasks.filter((t) => !t.done && ((t.category === 'daily' && !t.date) || t.date === today)).length;
  $('#stat-appts').textContent = store.appointments.filter((a) => a.date && a.date >= today).length;
  $('#stat-exams').textContent = store.exams.filter((x) => x.date && x.date >= today).length;
}

function renderHome() {
  $('#home-day-name').textContent = fmtDayMonth(todayISO());
  const today = todayISO();
  const dow = new Date().getDay();
  const items = [];
  store.appointments.filter((a) => a.date === today).forEach((a) => items.push({ s: a.time || '12:00', h: apptCard(a) }));
  store.exams.filter((x) => x.date === today).forEach((x) => items.push({ s: x.time || '12:00', h: examCard(x) }));
  store.tasks.filter((t) => t.date === today || (t.category === 'daily' && !t.date)).forEach((t) => items.push({ s: t.time || '99', h: taskCard(t) }));
  store.courses.filter((c) => String(c.day) === String(dow)).forEach((c) => items.push({ s: c.time || '50', h: courseCard(c) }));
  items.sort((a, b) => a.s.localeCompare(b.s));
  $('#home-today-list').innerHTML = items.length ? items.map((i) => i.h).join('') : emptyHTML('لا مهام أو مواعيد اليوم. أضيفي شيئاً من زر +');

  const up = [];
  store.appointments.filter((a) => a.date > today).forEach((a) => up.push({ d: a.date + (a.time || ''), h: apptCard(a) }));
  store.exams.filter((x) => x.date > today).forEach((x) => up.push({ d: x.date + (x.time || ''), h: examCard(x) }));
  store.tasks.filter((t) => t.date && t.date > today).forEach((t) => up.push({ d: t.date + (t.time || ''), h: taskCard(t) }));
  up.sort((a, b) => a.d.localeCompare(b.d));
  $('#home-upcoming-list').innerHTML = up.length ? up.slice(0, 10).map((i) => i.h).join('') : emptyHTML('لا يوجد شيء قادم. استمتعي بوقتك!');
}

function sortTasks(a, b) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  const ka = (a.date || '9999') + (a.time || '99');
  const kb = (b.date || '9999') + (b.time || '99');
  return ka.localeCompare(kb);
}
function renderTasks() {
  const arr = store.tasks.filter((t) => t.category === taskCat).sort(sortTasks);
  $('#tasks-list').innerHTML = arr.length ? arr.map(taskCard).join('') : emptyHTML('لا توجد مهام ' + catLabel(taskCat) + ' بعد. أضيفي واحدة من الزر بالأسفل.');
}
function renderStudy() {
  const exams = [...store.exams].sort((a, b) => (a.date || '9').localeCompare(b.date || '9'));
  $('#exams-list').innerHTML = exams.length ? exams.map(examCard).join('') : emptyHTML('لا امتحانات مسجّلة. أضيفي امتحاناتك ليذكّرك بها المساعد.');
  const courses = [...store.courses].sort((a, b) => String(a.day === '' ? 9 : a.day).localeCompare(String(b.day === '' ? 9 : b.day)));
  $('#courses-list').innerHTML = courses.length ? courses.map(courseCard).join('') : emptyHTML('لا كورسات مسجّلة بعد.');
  renderResults();
}
function renderResults() {
  const sum = $('#results-summary'), list = $('#results-list');
  if (!sum || !list) return;
  const arr = store.results;
  if (!arr.length) {
    sum.innerHTML = '';
    list.innerHTML = emptyHTML('لا نتائج مسجّلة بعد. أضيفي درجات موادّك لمتابعة معدّلك العام.');
    return;
  }
  const { avg, anyCredit } = computeResults(arr);
  sum.innerHTML = `<div class="result-summary">
    <div class="rs-grade-top">المعدل العام</div>
    <div class="rs-big">${avg.toFixed(1)}<span class="rs-pct">%</span></div>
    <div class="rs-grade">${gradeLabel(avg)}</div>
    <div class="rs-sub">${arr.length} مادة${anyCredit ? ' · موزون بالساعات' : ''}</div>
  </div>`;
  const terms = [], map = {};
  arr.forEach((r) => { const t = (r.term || '').trim() || 'غير محدّد'; if (!map[t]) { map[t] = []; terms.push(t); } map[t].push(r); });
  list.innerHTML = terms.map((t) => {
    const ta = computeResults(map[t]).avg;
    return `<div class="term-head"><span>${esc(t)}</span><span>${ta.toFixed(1)}%</span></div>` + map[t].map(resultCard).join('');
  }).join('');
}
function renderTracks() {
  const box = $('#tracks-view');
  if (!box) return;
  if (currentTrack) {
    const tr = store.tracks.find((t) => t.id === currentTrack);
    if (!tr) { currentTrack = null; return renderTracks(); }
    const items = store.tasks.filter((t) => t.track === currentTrack).sort(sortTasks);
    box.innerHTML = `<div class="track-detail-head">
        <button class="back-btn" data-track-back="1">‹ كل المسارات</button>
        <h2><span class="t-dot sm" style="background:${tr.color}">${esc(firstChar(tr.name))}</span>${esc(tr.name)}</h2>
      </div>
      <div class="list">${items.length ? items.map(taskCard).join('') : emptyHTML('لا مهام في هذا المسار بعد. أضيفي مهمة من الزر بالأسفل.')}</div>
      <button class="btn-add-inline" data-add-track="${tr.id}">+ إضافة مهمة في «${esc(tr.name)}»</button>`;
  } else {
    const cards = store.tracks.map((tr) => {
      const count = store.tasks.filter((t) => t.track === tr.id && !t.done).length;
      return `<div class="track-card" data-track-open="${tr.id}">
        <div class="t-top"><span class="t-dot" style="background:${tr.color}">${esc(firstChar(tr.name))}</span><button class="del" data-track-del="${tr.id}" aria-label="حذف">${SVG.trash}</button></div>
        <div class="t-name">${esc(tr.name)}</div>
        <div class="t-count">${count ? count + ' مهمة نشطة' : 'لا مهام نشطة'}</div>
      </div>`;
    }).join('');
    box.innerHTML = `<div class="tracks-grid">${cards}<button class="track-card add" data-add-newtrack="1"><span class="plus">+</span><div class="t-name">مسار جديد</div></button></div>`;
  }
}
function deleteTrack(id) {
  tombstone(id);
  store.tracks = store.tracks.filter((t) => t.id !== id);
  store.tasks.forEach((t) => { if (t.track === id) { t.track = ''; t.updatedAt = Date.now(); } });
  persist('tracks'); persist('tasks');
  if (currentTrack === id) currentTrack = null;
  refreshAll(); toast('تم حذف المسار');
}
function renderReading() {
  const bl = $('#books-list');
  if (bl) {
    const arr = store.books;
    bl.innerHTML = arr.length ? arr.map(bookCard).join('') : emptyHTML('لا كتب بعد. أضيفي كتبكِ المطلوب قراءتها.');
  }
  renderReadingLog();
}
function renderReadingLog() {
  const sum = $('#reading-summary'), list = $('#reading-log-list');
  if (!sum || !list) return;
  const entries = store.reading;
  if (!entries.length) { sum.innerHTML = ''; list.innerHTML = emptyHTML('لم تُسجّلي قراءة بعد. سجّلي كم صفحة قرأتِ ومن أي كتاب.'); return; }
  const today = todayISO();
  const ws = weekStartSat(new Date()), we = new Date(ws); we.setDate(we.getDate() + 6);
  const sumPages = (arr) => arr.reduce((s, e) => s + (parseFloat(e.pages) || 0), 0);
  const todayPages = sumPages(entries.filter((e) => e.date === today));
  const weekPages = sumPages(entries.filter((e) => { const d = new Date(e.date + 'T00:00'); return d >= ws && d <= we; }));
  sum.innerHTML = `<div class="reading-summary"><div class="rsum"><span class="rsum-n">${todayPages}</span><span class="rsum-l">صفحة اليوم</span></div><div class="rsum"><span class="rsum-n">${weekPages}</span><span class="rsum-l">صفحة هذا الأسبوع</span></div></div>`;
  const byDate = {}, dates = [];
  [...entries].sort((a, b) => b.date.localeCompare(a.date)).forEach((e) => { if (!byDate[e.date]) { byDate[e.date] = []; dates.push(e.date); } byDate[e.date].push(e); });
  list.innerHTML = dates.map((d) => {
    const day = byDate[d], total = sumPages(day);
    const items = day.map((e) => {
      const b = store.books.find((x) => x.id === e.bookId);
      return `<div class="rep-item"><span>${esc(b ? b.title : 'كتاب')}${e.note ? ' — ' + esc(e.note) : ''}</span><span class="rep-meta">${parseFloat(e.pages) || 0} صفحة <button class="del-mini" data-del-reading="${e.id}">حذف</button></span></div>`;
    }).join('');
    return `<div class="reading-day"><div class="term-head"><span>${relDate(d).label} · ${fmtDayMonth(d)}</span><span>${total} صفحة</span></div>${items}</div>`;
  }).join('');
}
function renderShopping() {
  const box = $('#shopping-list');
  if (!box) return;
  const arr = store.purchases || [];
  let filtered = arr;
  if (shopFilter === 'todo') filtered = arr.filter((p) => !p.bought);
  else if (shopFilter === 'done') filtered = arr.filter((p) => p.bought);
  filtered.sort((a, b) => (a.bought - b.bought) || ((a.createdAt || 0) - (b.createdAt || 0)));
  box.innerHTML = filtered.length ? filtered.map(purchaseCard).join('') : emptyHTML(arr.length ? 'لا مواد في هذا التصنيف.' : 'لا مواد في قائمة المشتريات بعد. أضيفي ما تحتاجين شراءه.');
}
function togglePurchase(id) {
  const p = (store.purchases || []).find((x) => x.id === id);
  if (!p) return;
  p.bought = !p.bought;
  p.boughtAt = p.bought ? Date.now() : null;
  p.updatedAt = Date.now();
  persist('purchases'); refreshAll();
}
function refreshAll() { updateStats(); renderHome(); renderTasks(); renderTracks(); renderStudy(); renderReading(); renderShopping(); }

/* ============ التنقل ============ */
function go(screen) {
  currentTrack = null;
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + screen));
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.screen === screen));
  refreshAll();
  window.scrollTo(0, 0);
}

/* ============ النافذة المنبثقة (إضافة/تعديل) ============ */
let currentModal = null;
const opt = (v, l, cur) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`;
const fieldText = (n, l, v, req, ph) => `<div class="field"><label>${l}</label><input type="text" name="${n}" value="${esc(v)}" ${req ? 'required' : ''} placeholder="${ph || ''}"></div>`;
const fieldDate = (n, l, v, req) => `<div class="field"><label>${l}</label><input type="date" name="${n}" value="${esc(v)}" ${req ? 'required' : ''}></div>`;
const fieldTime = (n, l, v) => `<div class="field"><label>${l}</label><input type="time" name="${n}" value="${esc(v)}"></div>`;
const fieldArea = (n, l, v) => `<div class="field"><label>${l}</label><textarea name="${n}" placeholder="">${esc(v)}</textarea></div>`;
const numberField = (n, l, v, ph) => `<div class="field"><label>${l}</label><input type="number" inputmode="decimal" step="any" name="${n}" value="${esc(v)}" placeholder="${ph || ''}"></div>`;
const switchRow = (n, l, on) => `<div class="switch-row"><label style="margin:0;font-weight:700">${l}</label><label class="switch"><input type="checkbox" name="${n}" ${on ? 'checked' : ''}><span class="slider"></span></label></div>`;
function daySelect(val) {
  let o = `<option value="">— اختاري اليوم —</option>`;
  for (let i = 0; i < 7; i++) o += `<option value="${i}" ${String(val) === String(i) ? 'selected' : ''}>${WEEK[i]}</option>`;
  return `<div class="field"><label>يوم المحاضرة</label><select name="day">${o}</select></div>`;
}

function buildForm(type, item, allowType) {
  item = item || {};
  let h = '';
  if (allowType) {
    h += `<div class="field"><label>النوع</label><select name="_type">${opt('task', 'مهمة', type)}${opt('appointment', 'موعد', type)}${opt('exam', 'امتحان', type)}${opt('course', 'كورس', type)}${opt('book', 'كتاب', type)}${opt('reading', 'تسجيل قراءة', type)}${opt('purchase', 'مشتريات', type)}</select></div>`;
  }
  if (type === 'track') {
    h += fieldText('name', 'اسم المسار', item.name, true, 'مثال: الرياضة');
    return h;
  }
  if (type === 'settings') {
    const host = location.hostname || 'localhost';
    h += `<div class="field"><label>نوع الخادم</label><select name="_preset">
      <option value="">— اختاري لتعبئة العنوان —</option>
      <option value="http://${host}:1234">LM Studio (المنفذ 1234)</option>
      <option value="http://${host}:11434">Ollama (المنفذ 11434)</option>
    </select></div>`;
    h += switchRow('auto', 'اكتشاف رابط الذكاء تلقائيًا (موصى به)', Sami.auto);
    h += fieldText('url', 'عنوان الخادم اليدوي (اختياري)', Sami.url, false, 'http://localhost:11434');
    h += fieldText('model', 'اسم النموذج (اتركيه فارغًا للاكتشاف التلقائي)', Sami.model, false, 'qwen2.5:3b');
    h += switchRow('enabled', 'تفعيل المحادثة الذكية', Sami.enabled);
    h += switchRow('speak', 'نطق ردود سامي صوتيًا', Sami.speakReplies);
    return h;
  }
  if (type === 'result') {
    h += fieldText('subject', 'المادة', item.subject, true, 'مثال: الفقه');
    h += fieldText('term', 'الفصل / السنة', item.term, false, 'مثال: الفصل الأول 2026');
    h += `<div class="field-row">${numberField('score', 'الدرجة', item.score, '85')}${numberField('maxScore', 'من', item.maxScore || 100, '100')}</div>`;
    h += numberField('credit', 'الساعات المعتمدة (اختياري)', item.credit, '3');
    h += fieldArea('note', 'ملاحظات (اختياري)', item.note);
    return h;
  }
  if (type === 'book') {
    h += fieldText('title', 'اسم الكتاب', item.title, true, 'مثال: إحياء علوم الدين');
    h += fieldText('author', 'المؤلف (اختياري)', item.author, false, '');
    h += numberField('totalPages', 'عدد الصفحات (اختياري)', item.totalPages, '300');
    h += `<div class="field"><label>الحالة</label><select name="status">${opt('toread', 'للقراءة', item.status || 'toread')}${opt('reading', 'أقرؤه الآن', item.status)}${opt('done', 'انتهيت', item.status)}</select></div>`;
    h += fieldArea('note', 'ملاحظات (اختياري)', item.note);
    return h;
  }
  if (type === 'reading') {
    const books = store.books;
    const bopts = books.length ? books.map((b) => opt(b.id, b.title, item.bookId)).join('') : '<option value="">— أضيفي كتابًا أولًا —</option>';
    h += `<div class="field"><label>الكتاب</label><select name="bookId">${bopts}</select></div>`;
    h += numberField('pages', 'عدد الصفحات المقروءة', item.pages, '20');
    h += fieldDate('date', 'التاريخ', item.date || todayISO());
    h += fieldText('note', 'ملاحظة (اختياري)', item.note, false, '');
    return h;
  }
  if (type === 'purchase') {
    h += fieldText('name', 'اسم المادة', item.name, true, 'مثال: زيت زيتون');
    h += `<div class="field-row">${fieldText('qty', 'الكمية', item.qty, false, 'مثال: 1 كيلو')}${fieldText('category', 'الفئة', item.category, false, 'مثال: خضار')}</div>`;
    h += fieldArea('note', 'ملاحظة (اختياري)', item.note);
    return h;
  }
  if (type === 'task') {
    h += fieldText('title', 'عنوان المهمة', item.title, true, 'مثال: مذاكرة الفيزياء');
    h += `<div class="field"><label>التصنيف</label><select name="category">${opt('daily', 'يومية', item.category || 'daily')}${opt('weekly', 'أسبوعية', item.category)}${opt('yearly', 'سنوية', item.category)}${opt('general', 'عامة', item.category)}</select></div>`;
    h += `<div class="field"><label>المسار (اختياري)</label><select name="track"><option value="">— بدون مسار —</option>${store.tracks.map((tr) => opt(tr.id, tr.name, item.track)).join('')}</select></div>`;
    h += `<div class="field-row">${fieldDate('date', 'التاريخ (اختياري)', item.date)}${fieldTime('time', 'الوقت (اختياري)', item.time)}</div>`;
    h += switchRow('remind', 'ذكّرني بهذه المهمة', !!item.remind);
  } else if (type === 'appointment') {
    h += fieldText('title', 'عنوان الموعد', item.title, true, 'مثال: موعد الطبيب');
    h += `<div class="field-row">${fieldDate('date', 'التاريخ', item.date, true)}${fieldTime('time', 'الوقت', item.time)}</div>`;
    h += fieldText('note', 'ملاحظة (اختياري)', item.note, false, 'المكان أو تفاصيل');
    h += switchRow('remind', 'ذكّرني بالموعد', item.id ? !!item.remind : true);
  } else if (type === 'exam') {
    h += fieldText('subject', 'المادة', item.subject, true, 'مثال: الرياضيات');
    h += `<div class="field-row">${fieldDate('date', 'تاريخ الامتحان', item.date, true)}${fieldTime('time', 'الوقت', item.time)}</div>`;
    h += fieldText('place', 'المكان (اختياري)', item.place, false, 'القاعة / المبنى');
    h += fieldArea('note', 'ملاحظات (اختياري)', item.note);
  } else {
    h += fieldText('name', 'اسم الكورس', item.name, true, 'مثال: مقدمة في البرمجة');
    h += `<div class="field-row">${daySelect(item.day)}${fieldTime('time', 'الوقت', item.time)}</div>`;
    h += fieldText('instructor', 'المحاضر (اختياري)', item.instructor, false, '');
    h += fieldArea('note', 'ملاحظات (اختياري)', item.note);
  }
  return h;
}

function bindTypeSelect() {
  const ts = $('#modal-form [name="_type"]');
  if (!ts) return;
  ts.addEventListener('change', () => {
    currentModal.type = ts.value;
    $('#modal-title').textContent = 'إضافة ' + typeLabel(ts.value);
    $('#modal-form').innerHTML = buildForm(ts.value, null, true);
    bindTypeSelect();
  });
}
function openModal(type, item, allowType) {
  currentModal = { type, id: item ? item.id : null, allowType: !!allowType };
  $('#modal-title').textContent = type === 'settings' ? 'إعدادات الذكاء' : (item ? 'تعديل ' : 'إضافة ') + typeLabel(type);
  $('#modal-form').innerHTML = buildForm(type, item, allowType);
  $('#modal').classList.remove('hidden');
  bindTypeSelect();
  if (type === 'settings') {
    const ps = $('#modal-form [name="_preset"]');
    if (ps) ps.addEventListener('change', () => { if (ps.value) { const u = $('#modal-form [name="url"]'); if (u) u.value = ps.value; } });
  }
  setTimeout(() => { const el = $('#modal-form input,#modal-form select,#modal-form textarea'); if (el) el.focus(); }, 60);
}
function closeModal() { $('#modal').classList.add('hidden'); currentModal = null; }

function saveModal() {
  if (!currentModal) return;
  const type = currentModal.type;
  const isEdit = !!currentModal.id;
  const f = new FormData($('#modal-form'));
  const g = (n) => (f.get(n) || '').toString().trim();
  if (type === 'settings') {
    Sami.auto = f.get('auto') === 'on';
    Sami.url = (g('url') || '').replace(/\/+$/, '').replace(/\/v1$/, '');
    Sami.model = g('model');
    Sami.enabled = f.get('enabled') === 'on';
    Sami.speakReplies = f.get('speak') === 'on';
    Sami.save(); closeModal();
    if (Sami.reconnect) Sami.reconnect(); else Sami.ping();
    toast('تم حفظ إعدادات الذكاء');
    return;
  }
  let coll, obj;
  if (type === 'task') {
    if (!g('title')) return toast('اكتبي عنوان المهمة');
    coll = 'tasks';
    obj = { id: currentModal.id || uid(), title: g('title'), category: g('category') || 'daily', track: g('track'), date: g('date'), time: g('time'), remind: f.get('remind') === 'on' };
    if (!isEdit) { obj.done = false; obj.createdAt = Date.now(); }
  } else if (type === 'appointment') {
    if (!g('title')) return toast('اكتبي عنوان الموعد');
    if (!g('date')) return toast('اختاري تاريخ الموعد');
    coll = 'appointments';
    obj = { id: currentModal.id || uid(), title: g('title'), date: g('date'), time: g('time'), note: g('note'), remind: f.get('remind') === 'on' };
  } else if (type === 'exam') {
    if (!g('subject')) return toast('اكتبي اسم المادة');
    if (!g('date')) return toast('اختاري تاريخ الامتحان');
    coll = 'exams';
    obj = { id: currentModal.id || uid(), subject: g('subject'), date: g('date'), time: g('time'), place: g('place'), note: g('note') };
  } else if (type === 'result') {
    if (!g('subject')) return toast('اكتبي اسم المادة');
    coll = 'results';
    obj = { id: currentModal.id || uid(), subject: g('subject'), term: g('term'), score: parseFloat(g('score')) || 0, maxScore: parseFloat(g('maxScore')) || 100, credit: g('credit'), note: g('note') };
  } else if (type === 'book') {
    if (!g('title')) return toast('اكتبي اسم الكتاب');
    coll = 'books';
    obj = { id: currentModal.id || uid(), title: g('title'), author: g('author'), totalPages: g('totalPages'), status: g('status') || 'toread', note: g('note') };
    if (!isEdit) obj.createdAt = Date.now();
  } else if (type === 'reading') {
    const pages = parseFloat(g('pages'));
    if (!(pages > 0)) return toast('اكتبي عدد الصفحات المقروءة');
    coll = 'reading';
    obj = { id: currentModal.id || uid(), bookId: g('bookId'), pages: pages, date: g('date') || todayISO(), note: g('note') };
    const b = store.books.find((x) => x.id === g('bookId'));
    if (b && b.status === 'toread') { b.status = 'reading'; persist('books'); }
  } else if (type === 'purchase') {
    if (!g('name')) return toast('اكتبي اسم المادة');
    coll = 'purchases';
    obj = { id: currentModal.id || uid(), name: g('name'), qty: g('qty'), category: g('category'), note: g('note') };
    if (!isEdit) { obj.bought = false; obj.createdAt = Date.now(); }
  } else if (type === 'course') {
    if (!g('name')) return toast('اكتبي اسم الكورس');
    coll = 'courses';
    obj = { id: currentModal.id || uid(), name: g('name'), day: g('day'), time: g('time'), instructor: g('instructor'), note: g('note') };
  } else {
    if (!g('name')) return toast('اكتبي اسم المسار');
    coll = 'tracks';
    obj = { id: currentModal.id || uid(), name: g('name') };
    if (!isEdit) obj.color = TRACK_COLORS[store.tracks.length % TRACK_COLORS.length];
  }
  upsert(coll, obj);
  closeModal();
  refreshAll();
  if (!$('#calendar').classList.contains('hidden')) renderCalendar();
  scheduleNativeReminders();
  toast(isEdit ? 'تم التحديث' : 'تمت الإضافة');
}

/* ============ عمليات العناصر ============ */
const collOf = (type) => ({ task: 'tasks', appointment: 'appointments', exam: 'exams', course: 'courses', track: 'tracks', result: 'results', book: 'books', reading: 'reading', purchase: 'purchases' }[type]);
function findItem(type, id) { return store[collOf(type)].find((x) => x.id === id); }
function editItem(type, id) { const it = findItem(type, id); if (it) openModal(type, it, false); }
function removeItem(type, id) {
  const coll = collOf(type);
  tombstone(id);
  store[coll] = store[coll].filter((x) => x.id !== id);
  persist(coll); refreshAll(); toast('تم الحذف');
}
function toggleTask(id) {
  const t = store.tasks.find((x) => x.id === id);
  if (!t) return;
  t.done = !t.done;
  t.completedAt = t.done ? Date.now() : null;
  t.updatedAt = Date.now();
  persist('tasks'); refreshAll();
}

/* ============ التنبيه السريع ============ */
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.classList.remove('hidden'); el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.classList.add('hidden'), 300); }, 2600);
}

/* ============ الصوت: النطق والاستماع ============ */
const synth = window.speechSynthesis;
let arVoice = null;
function loadVoices() { if (!synth) return; const vs = synth.getVoices(); arVoice = vs.find((v) => /ar(-|_|$)/i.test(v.lang)) || arVoice; }
if (synth) { loadVoices(); synth.onvoiceschanged = loadVoices; }
function speak(text) {
  if (!synth) return;
  try {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ar-SA'; u.rate = 1; u.pitch = 1;
    if (arVoice) u.voice = arVoice;
    synth.speak(u);
  } catch (e) { /* تجاهل */ }
}

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog = null, listening = false;
function initRecog() {
  if (!SR) return null;
  const r = new SR();
  r.lang = 'ar-SA'; r.interimResults = false; r.maxAlternatives = 1; r.continuous = false;
  r.onstart = () => { listening = true; $('#btn-mic').classList.add('listening'); };
  r.onend = () => { listening = false; $('#btn-mic').classList.remove('listening'); };
  r.onerror = (e) => { listening = false; $('#btn-mic').classList.remove('listening'); if (e.error === 'not-allowed') toast('يرجى السماح باستخدام الميكروفون'); };
  r.onresult = (e) => { const txt = e.results[0][0].transcript; $('#chat-text').value = txt; handleUserInput(txt, true); };
  return r;
}
function toggleMic() {
  if (!SR) { toast('الإدخال الصوتي يعمل على Chrome أو Edge'); return; }
  if (!recog) recog = initRecog();
  if (listening) { try { recog.stop(); } catch (e) {} return; }
  try { recog.start(); } catch (e) { /* قد يكون يعمل بالفعل */ }
}

/* ============ المساعد: محلل الأوامر العربي ============ */
function normalize(s) {
  return String(s || '')
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[؟?.,،!]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

const STOP = new Set(['ذكرني', 'ذكريني', 'ذكر', 'تذكير', 'تذكرني', 'اضف', 'اضيف', 'اضيفي', 'ضيف', 'ضيفي', 'سجل', 'سجلي', 'حط', 'حطي', 'انشئ', 'انشي', 'اعمل', 'اعملي', 'سوي', 'حدد', 'احجز', 'عايزه', 'عايز', 'اريد', 'ابي', 'ابغي', 'لي', 'عن', 'مع', 'في', 'يوم', 'الساعه', 'ساعه', 'عند', 'الموعد', 'موعد', 'مسار', 'المسار', 'اضافه', 'امتحان', 'اختبار', 'كويز', 'فاينل', 'ميدتيرم', 'كورس', 'محاضره', 'دوره', 'حصه', 'درس', 'سيمنار', 'مهمه', 'المهمه', 'اليوم', 'النهارده', 'غدا', 'غد', 'بكره', 'بكرا', 'بعد', 'امس', 'الاحد', 'احد', 'الاثنين', 'الاتنين', 'اثنين', 'اتنين', 'الثلاثاء', 'ثلاثاء', 'الاربعاء', 'اربعاء', 'الخميس', 'خميس', 'الجمعه', 'جمعه', 'السبت', 'سبت', 'صباحا', 'صباح', 'الصبح', 'مساء', 'مسا', 'مساءا', 'ظهرا', 'ظهر', 'الظهر', 'عصرا', 'عصر', 'العصر', 'الليل', 'ليلا', 'فجرا', 'فجر', 'عشاء', 'عشا', 'ونص', 'والنص', 'والربع', 'وثلث', 'الواحده', 'الثانيه', 'الثالثه', 'الرابعه', 'الخامسه', 'السادسه', 'السابعه', 'الثامنه', 'التاسعه', 'العاشره', 'الحاديه', 'عشر', 'عشره', 'القادم', 'القادمه', 'الجايه', 'الجاي', 'هذا', 'هذه', 'كل', 'اسبوعي', 'اسبوعيه', 'يومي', 'يوميه', 'سنوي', 'سنويه', 'الاسبوع', 'اسبوع', 'الشهر', 'شهر', 'السنه', 'العام', 'هالاسبوع', 'الايام', 'عامه', 'العامه', 'عام', 'مشتريات', 'المشتريات', 'للمشتريات']);

const REMIND_VERBS = new Set(['ذكرني', 'ذكريني', 'ذكر', 'تذكير', 'تذكرني']);
function extractTitle(original) {
  const toks = String(original).replace(/[؟?.,،!]/g, ' ').replace(/\s+/g, ' ').trim().split(' ');
  const kept = [];
  let prev = '';
  for (const tk of toks) {
    if (!tk) continue;
    const n = normalize(tk);
    const n2 = n.replace(/^(بـ|ب|و|ل|ف|ك)/, '');
    if (/^\d+$/.test(n) || /^\d{1,2}[:.]\d{1,2}$/.test(n) || /^\d{1,2}[\/\-]\d{1,2}/.test(n)) { prev = n; continue; }
    if (STOP.has(n) || STOP.has(n2)) { prev = n; continue; }
    // إزالة حرف الجر «بـ» فقط إذا جاء بعد فعل تذكير (ذكّرني بمذاكرة ← مذاكرة)
    let word = tk;
    if (REMIND_VERBS.has(prev) && /^بـ?./.test(tk) && tk.length > 2) word = tk.replace(/^بـ?/, '');
    kept.push(word);
    prev = n;
  }
  return kept.join(' ').trim();
}

function extractDate(norm) {
  const today = new Date();
  if (/بعد غد|بعد بكره|بعد بكرا/.test(norm)) return addDays(today, 2);
  const toks = norm.split(' ');
  const rel = { 'اليوم': 0, 'النهارده': 0, 'غدا': 1, 'غد': 1, 'بكره': 1, 'بكرا': 1 };
  for (const tk of toks) if (tk in rel) return addDays(today, rel[tk]);
  const days = { 'الاحد': 0, 'احد': 0, 'الاثنين': 1, 'الاتنين': 1, 'اثنين': 1, 'اتنين': 1, 'الثلاثاء': 2, 'ثلاثاء': 2, 'الاربعاء': 3, 'اربعاء': 3, 'الخميس': 4, 'خميس': 4, 'الجمعه': 5, 'جمعه': 5, 'السبت': 6, 'سبت': 6 };
  for (const tk of toks) if (tk in days) return nextWeekday(today, days[tk]);
  let m = norm.match(/(\d{1,2})\s*[\/\-]\s*(\d{1,2})(?:\s*[\/\-]\s*(\d{2,4}))?/);
  if (m) {
    const d = +m[1], mo = +m[2] - 1;
    let y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : today.getFullYear();
    const dt = new Date(y, mo, d);
    if (!m[3] && dt < stripTime(today)) dt.setFullYear(dt.getFullYear() + 1);
    return dt;
  }
  m = norm.match(/يوم\s+(\d{1,2})(?!\s*[:.])/);
  if (m) {
    const dt = new Date(today.getFullYear(), today.getMonth(), +m[1]);
    if (dt < stripTime(today)) dt.setMonth(dt.getMonth() + 1);
    return dt;
  }
  return null;
}

function extractTime(norm) {
  let h = null, min = 0, period = null;
  if (/صباح|الصبح|فجر/.test(norm)) period = 'am';
  else if (/مساء|مسا|الليل|عشاء|عشا|عصر/.test(norm)) period = 'pm';
  else if (/ظهر/.test(norm)) period = 'noon';
  let m = norm.match(/(\d{1,2})\s*[:.]\s*(\d{2})/);
  if (m) { h = +m[1]; min = +m[2]; }
  else {
    let m2 = norm.match(/(?:الساعه|ساعه|عند)\s*(\d{1,2})/) || norm.match(/(\d{1,2})\s*(?:صباح|مساء|مسا|ظهر|عصر|الصبح|الليل)/);
    if (m2) h = +m2[1];
    else {
      const w = { 'الواحده': 1, 'الثانيه': 2, 'الثالثه': 3, 'الرابعه': 4, 'الخامسه': 5, 'السادسه': 6, 'السابعه': 7, 'الثامنه': 8, 'التاسعه': 9, 'العاشره': 10 };
      for (const k in w) if (norm.includes(k)) { h = w[k]; break; }
    }
  }
  if (h == null) return '';
  if (/ونص|والنص/.test(norm)) min = 30;
  else if (/والربع/.test(norm)) min = 15;
  else if (/وثلث/.test(norm)) min = 20;
  if (period === 'pm' && h < 12) h += 12;
  if (period === 'noon') h = 12;
  if (period === 'am' && h === 12) h = 0;
  if (h > 23) h = h % 24;
  return pad(h) + ':' + pad(min);
}

function detectIntent(norm) {
  if (/احذف|امسح|الغ|شيل|ازل|انسي/.test(norm)) return 'delete';
  if (/خلصت|انهيت|انجزت|سويت|اكملت|تمت|خلصنا|انتهيت/.test(norm)) return 'complete';
  const hasQ = /(^|\s)(ما|ماذا|ايش|وش|شو|كم|اعرض|عرض|اعرضي|وريني|اظهر|اظهري)(\s|$)/.test(norm) || /مهامي|مواعيدي|جدولي|عندي|لدي|امتحاناتي|كورساتي|مساراتي|مساري|جدول|مشتريات|مشترياتي|كتبي|قراءتي|تقرير|نتيج|معدل|قائمه/.test(norm);
  const createVerb = /ذكر|اضف|اضيف|ضيف|سجل|حط|انشئ|اعمل|سوي|حدد|احجز|عايز|اريد|ابي|ابغ/.test(norm);
  if (hasQ && !createVerb) return 'query';
  // تسجيل قراءة: فعل ماضٍ صريح «قرأت» أو «سجّل قراءة/صفحات + رقم»
  if (/قرات|قرءت/.test(norm) || (/سجل/.test(norm) && /قراءه|صفح/.test(norm) && /\d/.test(norm))) return 'reading';
  // أوامر الإنشاء تتطلّب فعل إضافة صريح حتى لا تختلط بالأسئلة المفتوحة
  if (createVerb) {
    if (/مهمه|مهمة/.test(norm)) return 'task';
    if (/امتحان|اختبار|كويز|فاينل|ميدتيرم/.test(norm)) return 'exam';
    if (/كورس|محاضر|دوره|حصه|سيمنار/.test(norm)) return 'course';
    if (/موعد|مقابله|اجتماع|زياره|حجز|كشف/.test(norm)) return 'appointment';
    if (/مشتريات|للمشتريات|اشتري|تسوق/.test(norm)) return 'purchase';
    if (/مسار/.test(norm)) return 'track';
    if (/كتاب|روايه/.test(norm)) return 'book';
    if (/نتيجه|درجه|علامه|معدل/.test(norm) && /\d/.test(norm)) return 'result';
    return 'task';
  }
  if (/اشتري|تسوق/.test(norm)) return 'purchase';
  return 'unknown';
}

function whenText(date, time) {
  let s = '';
  if (date) { const r = relDate(date); s += ' ' + (r.diff === 0 ? 'اليوم' : r.diff === 1 ? 'غدًا' : 'يوم ' + fmtDayMonth(date)); }
  if (time) s += ' الساعة ' + fmtTime(time);
  return s;
}
const needTitle = (what, ex) => `لم أفهم اسم ${what}. جرّبي مثلاً: «${ex}»`;

function executeCreate(type, original, norm) {
  const dt = extractDate(norm);
  const time = extractTime(norm);
  const date = dt ? dateToISO(dt) : '';
  const title = extractTitle(original);
  if (type === 'exam') {
    if (!title) return needTitle('الامتحان', 'ذكّريني بامتحان الرياضيات يوم الأحد الساعة 9');
    store.exams.push({ id: uid(), subject: title, date, time, place: '', note: '' }); persist('exams');
    return `حسنًا، سجّلتُ امتحان «${title}»${whenText(date, time)}. سأذكّركِ به.`;
  }
  if (type === 'course') {
    if (!title) return needTitle('الكورس', 'أضيفي كورس البرمجة يوم الثلاثاء الساعة 5 مساءً');
    const day = dt ? dt.getDay() : '';
    store.courses.push({ id: uid(), name: title, day: day === '' ? '' : day, time, instructor: '', note: '' }); persist('courses');
    return `أضفتُ كورس «${title}»${day !== '' ? ' كل يوم ' + WEEK[day] : ''}${time ? ' الساعة ' + fmtTime(time) : ''}.`;
  }
  if (type === 'appointment') {
    if (!title) return needTitle('الموعد', 'ذكّريني بموعد الطبيب غدًا الساعة 11');
    store.appointments.push({ id: uid(), title, date, time, note: '', remind: true }); persist('appointments');
    return `سجّلتُ موعد «${title}»${whenText(date, time)}. سأذكّركِ به.`;
  }
  if (!title) return needTitle('المهمة', 'أضيفي مهمة مذاكرة الفيزياء غدًا');
  let category = 'daily';
  if (/اسبوع/.test(norm)) category = 'weekly';
  else if (/عامه/.test(norm)) category = 'general';
  else if (/سنه|سنوي|العام/.test(norm)) category = 'yearly';
  let tTitle = title, track = '', trackName = '', trackTokens = null;
  for (const tr of store.tracks) { const n = normalize(tr.name); if (n && norm.includes(n)) { track = tr.id; trackName = tr.name; trackTokens = new Set(n.split(' ')); break; } }
  if (trackTokens) { const c = tTitle.split(' ').filter((w) => !trackTokens.has(normalize(w))).join(' ').trim(); if (c) tTitle = c; }
  const remind = /ذكر|تذكير/.test(norm) || !!time || !!date;
  store.tasks.push({ id: uid(), title: tTitle, category, track, date, time, remind, done: false, createdAt: Date.now() }); persist('tasks');
  return `أضفتُ مهمة «${tTitle}» (${catLabel(category)})${trackName ? ' ضمن مسار «' + trackName + '»' : ''}${whenText(date, time)}.${remind ? ' سأذكّركِ بها.' : ''}`;
}

/* استعلامات */
const byTime = (a, b) => (a.time || '99').localeCompare(b.time || '99');
function summaryToday() {
  const today = todayISO();
  const lines = [];
  const appts = store.appointments.filter((a) => a.date === today).sort(byTime);
  const exams = store.exams.filter((x) => x.date === today);
  const tasks = store.tasks.filter((t) => !t.done && (t.date === today || (t.category === 'daily' && !t.date)));
  if (appts.length) lines.push('المواعيد: ' + appts.map((a) => a.title + (a.time ? ' (' + fmtTime(a.time) + ')' : '')).join('، '));
  if (exams.length) lines.push('امتحانات: ' + exams.map((x) => x.subject + (x.time ? ' (' + fmtTime(x.time) + ')' : '')).join('، '));
  if (tasks.length) lines.push('المهام: ' + tasks.map((t) => t.title + (t.time ? ' (' + fmtTime(t.time) + ')' : '')).join('، '));
  if (!lines.length) return 'لا يوجد لديكِ شيء مجدول اليوم. يومٌ هادئ، فاستغلّيه في الراحة أو المذاكرة.';
  return `جدول اليوم (${fmtDayMonth(today)}):\n• ` + lines.join('\n• ');
}
function summaryExams() {
  const today = stripTime(new Date());
  const up = store.exams.filter((x) => x.date && new Date(x.date + 'T00:00') >= today).sort((a, b) => a.date.localeCompare(b.date));
  if (!up.length) return 'لا توجد امتحانات قادمة مسجّلة.';
  return 'الامتحانات القادمة:\n• ' + up.map((x) => `${x.subject} — ${fmtDayMonth(x.date)}${x.time ? ' الساعة ' + fmtTime(x.time) : ''}`).join('\n• ');
}
function summaryCourses() {
  if (!store.courses.length) return 'لا كورسات مسجّلة بعد.';
  return 'كورساتك:\n• ' + store.courses.map((c) => `${c.name}${c.day !== '' && c.day != null ? ' (كل ' + WEEK[+c.day] + ')' : ''}${c.time ? ' الساعة ' + fmtTime(c.time) : ''}`).join('\n• ');
}
function summaryAppts() {
  const today = todayISO();
  const up = store.appointments.filter((a) => a.date && a.date >= today).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  if (!up.length) return 'لا مواعيد قادمة مسجّلة.';
  return 'مواعيدك القادمة:\n• ' + up.map((a) => `${a.title} — ${relDate(a.date).label}${a.time ? ' الساعة ' + fmtTime(a.time) : ''}`).join('\n• ');
}
function summaryByCat(cat) {
  const arr = store.tasks.filter((t) => t.category === cat && !t.done);
  if (!arr.length) return `لا توجد مهام ${catLabel(cat)} حالياً.`;
  return `المهام ${catLabel(cat)}:\n• ` + arr.map((t) => t.title + (t.date ? ' (' + relDate(t.date).label + ')' : '')).join('\n• ');
}
function summaryResults() {
  const arr = store.results;
  if (!arr.length) return 'لا توجد نتائج مسجّلة بعد.';
  const { avg } = computeResults(arr);
  return 'نتائجك:\n• ' + arr.map((r) => `${r.subject}: ${r.score}/${parseFloat(r.maxScore) || 100} (${Math.round((parseFloat(r.score) || 0) / (parseFloat(r.maxScore) || 100) * 100)}%)`).join('\n• ') + `\nالمعدل العام: ${avg.toFixed(1)}% (${gradeLabel(avg)})`;
}
function summaryReading() {
  const e = store.reading;
  if (!e.length) return 'لم تُسجّلي قراءة بعد.';
  const today = todayISO();
  const ws = weekStartSat(new Date()), we = new Date(ws); we.setDate(we.getDate() + 6);
  const sp = (arr) => arr.reduce((s, x) => s + (parseFloat(x.pages) || 0), 0);
  const tp = sp(e.filter((x) => x.date === today));
  const wp = sp(e.filter((x) => { const d = new Date(x.date + 'T00:00'); return d >= ws && d <= we; }));
  const bd = {};
  e.filter((x) => x.date === today).forEach((x) => { const b = store.books.find((bk) => bk.id === x.bookId); const t = b ? b.title : 'كتاب'; bd[t] = (bd[t] || 0) + (parseFloat(x.pages) || 0); });
  const bdText = Object.keys(bd).map((t) => `${t}: ${bd[t]}`).join('، ');
  return `اليوم قرأتِ ${tp} صفحة${bdText ? ' (' + bdText + ')' : ''}.\nهذا الأسبوع: ${wp} صفحة.`;
}
function summaryShopping() {
  const arr = store.purchases || [];
  if (!arr.length) return 'قائمة المشتريات فارغة.';
  const todo = arr.filter((p) => !p.bought);
  const done = arr.filter((p) => p.bought);
  let s = `قائمة المشتريات (مطلوب ${todo.length}، اشتُري ${done.length}):`;
  if (todo.length) s += '\n• ' + todo.map((p) => p.name + (p.qty ? ' — ' + p.qty : '')).join('\n• ');
  else s += '\n(لا شيء مطلوب الآن، أحسنتِ)';
  return s;
}
function summaryTrackTasks(tr) {
  const items = store.tasks.filter((t) => t.track === tr.id && !t.done);
  if (!items.length) return `لا توجد مهام نشطة في مسار «${tr.name}».`;
  return `مهام مسار «${tr.name}»:\n• ` + items.map((t) => t.title + (t.date ? ' (' + relDate(t.date).label + ')' : '')).join('\n• ');
}
function doQuery(norm) {
  if (/مسار/.test(norm)) {
    for (const tr of store.tracks) { if (norm.includes(normalize(tr.name))) return summaryTrackTasks(tr); }
    if (!store.tracks.length) return 'لا توجد مسارات بعد.';
    return 'مساراتكِ:\n• ' + store.tracks.map((t) => t.name).join('\n• ');
  }
  if (/تقرير/.test(norm)) return reportToText(0);
  if (/نتيج|معدل|تقدير|درجات/.test(norm)) return summaryResults();
  if (/عامه|المهام العامه|مهام عامه/.test(norm)) return summaryByCat('general');
  if (/قراءه|قرات|صفح|سجل القراءه/.test(norm)) return summaryReading();
  if (/كتبي|الكتب|قائمه الكتب/.test(norm)) return store.books.length ? 'كتبكِ:\n• ' + store.books.map((b) => b.title).join('\n• ') : 'لا كتب بعد.';
  if (/مشتريات|قائمه المشتريات|قائمه الشراء|تسوق/.test(norm)) return summaryShopping();
  if (/امتحان|كويز|اختبار/.test(norm)) return summaryExams();
  if (/كورس|محاضر|دوره/.test(norm)) return summaryCourses();
  if (/مواعيد|موعد/.test(norm)) return summaryAppts();
  if (/اسبوع/.test(norm)) return summaryByCat('weekly');
  if (/سنه|سنوي|العام/.test(norm)) return summaryByCat('yearly');
  return summaryToday();
}

function doComplete(norm) {
  let best = null, score = 0;
  for (const t of store.tasks.filter((x) => !x.done)) {
    const n = normalize(t.title); if (!n) continue;
    let s = norm.includes(n) ? n.length : n.split(' ').filter((tk) => tk.length > 2 && norm.includes(tk)).length;
    if (s > score) { score = s; best = t; }
  }
  if (best && score > 0) { best.done = true; best.completedAt = Date.now(); best.updatedAt = Date.now(); persist('tasks'); return `أحسنتِ! وضعتُ علامة الإنجاز على «${best.title}».`; }
  return 'لم أجد مهمة بهذا الاسم لإكمالها.';
}
function doDelete(norm) {
  const colls = [['tasks', 'title', 'المهمة'], ['appointments', 'title', 'الموعد'], ['exams', 'subject', 'الامتحان'], ['courses', 'name', 'الكورس']];
  for (const [coll, field, label] of colls) {
    const idx = store[coll].findIndex((it) => { const n = normalize(it[field] || ''); return n && norm.includes(n); });
    if (idx >= 0) { const it = store[coll][idx]; tombstone(it.id); store[coll].splice(idx, 1); persist(coll); return `حذفتُ ${label} «${it[field]}».`; }
  }
  return 'لم أجد العنصر المطلوب حذفه. اذكري اسمه كما هو مسجّل.';
}
function helpText() {
  return 'أنا سامي مساعدكِ. يمكنكِ أن تطلبي أمورًا مثل:\n• «ذكّريني بامتحان الكيمياء يوم الخميس الساعة 10»\n• «أضيفي مهمة مذاكرة الإنجليزي غدًا»\n• «سجّلي موعد الطبيب 12/6 الساعة 5 مساءً»\n• «أضيفي كورس الرياضيات يوم الأحد الساعة 9»\n• «أضيفي مهمة المراجعة في مسار العلوم الشرعية»\n• «ما مهامي اليوم؟» أو «ما مساراتي؟»\n• «خلّصت مذاكرة الفيزياء» لإكمال مهمة';
}

/* ============ أدوات سامي الذكي (تُستدعى من النموذج عبر llm.js) ============ */
function resolveDate(s) {
  if (!s) return '';
  s = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = extractDate(normalize(s));
  return d ? dateToISO(d) : '';
}
// التواريخ من رسالة سلمى الأصلية أوثق من حساب النموذج الصغير
function userText() { return (typeof Sami !== 'undefined' && Sami.currentUserText) ? Sami.currentUserText : ''; }
function smartDate(modelVal) {
  const u = userText();
  if (u) { const d = extractDate(normalize(u)); if (d) return dateToISO(d); }
  return resolveDate(modelVal);
}
function smartTime(modelVal) {
  const u = userText();
  if (u) { const t = extractTime(normalize(u)); if (t) return t; }
  return resolveTime(modelVal);
}
function resolveTime(s) {
  if (!s) return '';
  s = String(s).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return pad(+m[1]) + ':' + pad(+m[2]);
  return extractTime(normalize(s)) || '';
}
function resolveTrackId(name) {
  if (!name) return '';
  const n = normalize(name);
  const tr = store.tracks.find((t) => normalize(t.name) === n) || store.tracks.find((t) => n.includes(normalize(t.name)) || normalize(t.name).includes(n));
  return tr ? tr.id : '';
}
function resolveWeekday(s) {
  if (s === '' || s == null) return '';
  const str = String(s).trim();
  if (/^[0-6]$/.test(str)) return +str;
  const d = extractDate(normalize(str));
  return d ? d.getDay() : '';
}
window.SamiActions = {
  add_task(a) {
    const title = (a.title || '').trim(); if (!title) return 'لا يوجد عنوان للمهمة';
    const cat = ['daily', 'weekly', 'yearly', 'general'].includes(a.category) ? a.category : 'daily';
    const date = smartDate(a.date), time = smartTime(a.time), track = resolveTrackId(a.track);
    const remind = a.remind !== undefined ? !!a.remind : (!!time || !!date);
    store.tasks.push({ id: uid(), title, category: cat, track, date, time, remind, done: false, createdAt: Date.now() });
    persist('tasks'); refreshAll(); scheduleNativeReminders();
    const trN = track ? (store.tracks.find((t) => t.id === track) || {}).name : '';
    return `تمت إضافة مهمة «${title}» (${catLabel(cat)})${trN ? ' في مسار ' + trN : ''}${date ? ' بتاريخ ' + date : ''}${time ? ' الساعة ' + time : ''}`;
  },
  add_exam(a) {
    const subject = (a.subject || '').trim(); if (!subject) return 'لا يوجد اسم للمادة';
    const date = smartDate(a.date); if (!date) return 'لم يُحدَّد تاريخ صحيح للامتحان';
    const time = smartTime(a.time);
    store.exams.push({ id: uid(), subject, date, time, place: (a.place || '').trim(), note: '' });
    persist('exams'); refreshAll(); scheduleNativeReminders();
    return `تمت إضافة امتحان «${subject}» بتاريخ ${date}${time ? ' الساعة ' + time : ''}`;
  },
  add_appointment(a) {
    const title = (a.title || '').trim(); if (!title) return 'لا يوجد عنوان للموعد';
    const date = smartDate(a.date); if (!date) return 'لم يُحدَّد تاريخ صحيح للموعد';
    const time = smartTime(a.time);
    store.appointments.push({ id: uid(), title, date, time, note: (a.note || '').trim(), remind: true });
    persist('appointments'); refreshAll(); scheduleNativeReminders();
    return `تمت إضافة موعد «${title}» بتاريخ ${date}${time ? ' الساعة ' + time : ''}`;
  },
  add_course(a) {
    const name = (a.name || '').trim(); if (!name) return 'لا يوجد اسم للكورس';
    const day = resolveWeekday(a.weekday), time = smartTime(a.time);
    store.courses.push({ id: uid(), name, day: day === '' ? '' : day, time, instructor: (a.instructor || '').trim(), note: '' });
    persist('courses'); refreshAll(); scheduleNativeReminders();
    return `تمت إضافة كورس «${name}»${day !== '' ? ' كل ' + WEEK[day] : ''}${time ? ' الساعة ' + time : ''}`;
  },
  add_track(a) {
    const name = (a.name || '').trim(); if (!name) return 'لا يوجد اسم للمسار';
    if (store.tracks.some((t) => normalize(t.name) === normalize(name))) return 'المسار موجود مسبقًا';
    store.tracks.push({ id: uid(), name, color: TRACK_COLORS[store.tracks.length % TRACK_COLORS.length] });
    persist('tracks'); refreshAll();
    return `تمت إضافة مسار «${name}»`;
  },
  add_result(a) {
    const subject = (a.subject || '').trim(); if (!subject) return 'لا يوجد اسم للمادة';
    const score = parseFloat(a.score); const maxScore = parseFloat(a.maxScore) || 100;
    store.results.push({ id: uid(), subject, term: (a.term || '').trim(), score: isNaN(score) ? 0 : score, maxScore, credit: (a.credit != null ? String(a.credit) : ''), note: '' });
    persist('results'); refreshAll();
    const pct = maxScore ? ((isNaN(score) ? 0 : score) / maxScore * 100) : 0;
    return `تمت إضافة نتيجة «${subject}»: ${isNaN(score) ? 0 : score} من ${maxScore} (${pct.toFixed(0)}% — ${gradeLabel(pct)})`;
  },
  add_book(a) {
    const title = (a.title || '').trim(); if (!title) return 'لا يوجد اسم للكتاب';
    store.books.push({ id: uid(), title, author: (a.author || '').trim(), totalPages: (a.totalPages != null ? String(a.totalPages) : ''), status: 'toread', note: '', createdAt: Date.now() });
    persist('books'); refreshAll();
    return `تمت إضافة كتاب «${title}» إلى قائمة القراءة`;
  },
  log_reading(a) {
    const pages = parseFloat(a.pages); if (!(pages > 0)) return 'كم صفحة قرأتِ؟';
    let b = null; const name = (a.book || '').trim();
    if (name) {
      const n = normalize(name);
      b = store.books.find((x) => normalize(x.title) === n) || store.books.find((x) => normalize(x.title).includes(n) || n.includes(normalize(x.title)));
      if (!b) { b = { id: uid(), title: name, author: '', totalPages: '', status: 'reading', note: '', createdAt: Date.now() }; store.books.push(b); }
    }
    const date = smartDate(a.date) || todayISO();
    store.reading.push({ id: uid(), bookId: b ? b.id : '', pages: pages, date: date, note: '' });
    if (b && b.status === 'toread') b.status = 'reading';
    persist('reading'); persist('books'); refreshAll();
    return `سجّلت ${pages} صفحة${b ? ' من «' + b.title + '»' : ''} بتاريخ ${date}`;
  },
  add_purchase(a) {
    const name = (a.name || '').trim(); if (!name) return 'لا يوجد اسم للمادة';
    store.purchases.push({ id: uid(), name, qty: (a.qty || '').trim(), category: (a.category || '').trim(), note: '', bought: false, createdAt: Date.now() });
    persist('purchases'); refreshAll();
    return `تمت إضافة «${name}»${a.qty ? ' (' + a.qty + ')' : ''} إلى المشتريات`;
  },
  mark_bought(a) {
    const name = (a.name || '').trim(); if (!name) return 'ما المادة التي اشتريتِها؟';
    const n = normalize(name);
    const p = (store.purchases || []).find((x) => !x.bought && normalize(x.name) === n) || (store.purchases || []).find((x) => !x.bought && (n.includes(normalize(x.name)) || normalize(x.name).includes(n)));
    if (!p) return 'لم أجد مادة بهذا الاسم في القائمة المطلوبة.';
    p.bought = true; p.boughtAt = Date.now(); p.updatedAt = Date.now(); persist('purchases'); refreshAll();
    return `علّمت «${p.name}» كمشتراة`;
  },
  complete_task(a) { const r = doComplete(normalize(a.title || '')); refreshAll(); return r; },
  delete_item(a) { const r = doDelete(normalize(a.name || '')); refreshAll(); return r; },
  get_schedule(a) {
    switch (a.scope) {
      case 'exams': return summaryExams();
      case 'appointments': return summaryAppts();
      case 'tracks': return 'المسارات: ' + store.tracks.map((t) => t.name).join('، ');
      case 'weekly': return summaryByCat('weekly');
      case 'yearly': return summaryByCat('yearly');
      case 'general': return summaryByCat('general');
      case 'results': return summaryResults();
      case 'reading': return summaryReading();
      case 'shopping': return summaryShopping();
      case 'report': return reportToText(0);
      default: return summaryToday();
    }
  }
};

function executePurchaseAdd(original, norm) {
  const title = extractTitle(original);
  if (!title) return 'لم أفهم اسم المادة. مثال: «أضيفي مشتريات زيت زيتون»';
  store.purchases.push({ id: uid(), name: title, qty: '', category: '', note: '', bought: false, createdAt: Date.now() });
  persist('purchases'); refreshAll();
  return `أضفتُ «${title}» إلى قائمة المشتريات.`;
}

function extractAfter(original, kw) {
  const m = original.match(new RegExp(kw + '\\s+(.+)$'));
  return m ? m[1].replace(/[.،!؟]+\s*$/, '').trim() : '';
}
function executeReadingLog(original, norm) {
  const m = norm.match(/(\d+)\s*صفح/) || norm.match(/(\d+)/);
  const pages = m ? parseInt(m[1], 10) : 0;
  if (!pages) return 'كم صفحة قرأتِ؟ مثال: «قرأت 20 صفحة من صحيح البخاري».';
  let bookName = '';
  const mm = original.match(/(?:^|\s)من\s+(.+)$/);
  if (mm) bookName = mm[1].replace(/[.،!؟]+\s*$/, '').trim();
  let b = null;
  if (bookName) {
    const n = normalize(bookName);
    b = store.books.find((x) => normalize(x.title) === n) || store.books.find((x) => normalize(x.title).includes(n) || n.includes(normalize(x.title)));
    if (!b) { b = { id: uid(), title: bookName, author: '', totalPages: '', status: 'reading', note: '', createdAt: Date.now() }; store.books.push(b); }
  }
  const dt = extractDate(norm);
  const date = dt ? dateToISO(dt) : todayISO();
  store.reading.push({ id: uid(), bookId: b ? b.id : '', pages, date, note: '' });
  if (b && b.status === 'toread') b.status = 'reading';
  persist('reading'); persist('books');
  return `سجّلتُ ${pages} صفحة${b ? ' من «' + b.title + '»' : ''}${date !== todayISO() ? ' بتاريخ ' + fmtDayMonth(date) : ''}.`;
}
function executeBookAdd(original, norm) {
  let title = extractAfter(original, 'كتاب') || extractAfter(original, 'رواية');
  if (!title) return 'ما اسم الكتاب؟ مثال: «أضيفي كتاب إحياء علوم الدين».';
  store.books.push({ id: uid(), title, author: '', totalPages: '', status: 'toread', note: '', createdAt: Date.now() });
  persist('books');
  return `أضفتُ كتاب «${title}» إلى قائمة القراءة.`;
}
function executeTrackAdd(original, norm) {
  const name = extractAfter(original, 'مسار');
  if (!name) return 'ما اسم المسار؟ مثال: «أضيفي مسار التصوير».';
  if (store.tracks.some((t) => normalize(t.name) === normalize(name))) return `المسار «${name}» موجود مسبقًا.`;
  store.tracks.push({ id: uid(), name, color: TRACK_COLORS[store.tracks.length % TRACK_COLORS.length] });
  persist('tracks');
  return `أضفتُ مسار «${name}».`;
}
function executeResultAdd(original, norm) {
  let score, maxScore = 100;
  const mm = norm.match(/(\d+(?:\.\d+)?)\s*من\s*(\d+(?:\.\d+)?)/);
  if (mm) { score = parseFloat(mm[1]); maxScore = parseFloat(mm[2]); }
  else { const m = norm.match(/(\d+(?:\.\d+)?)/); if (m) score = parseFloat(m[1]); }
  if (score == null || isNaN(score)) return 'كم الدرجة؟ مثال: «أضيفي نتيجة الفقه 95 من 100».';
  const cleaned = original.replace(/\d+(?:\.\d+)?/g, ' ').replace(/نتيجه|نتيجة|درجه|درجة|علامه|علامة|معدل/g, ' ').replace(/(^|\s)من(\s|$)/g, ' ');
  const subject = extractTitle(cleaned);
  if (!subject) return 'ما اسم المادة؟ مثال: «أضيفي نتيجة الفقه 95 من 100».';
  const pct = maxScore ? (score / maxScore * 100) : 0;
  store.results.push({ id: uid(), subject, term: '', score, maxScore, credit: '', note: '' });
  persist('results');
  return `سجّلتُ نتيجة «${subject}»: ${score} من ${maxScore} (${pct.toFixed(0)}% — ${gradeLabel(pct)}).`;
}

function processCommand(original) {
  const norm = normalize(original);
  const intent = detectIntent(norm);
  switch (intent) {
    case 'query': return { text: doQuery(norm), refresh: false };
    case 'complete': return { text: doComplete(norm), refresh: true };
    case 'delete': return { text: doDelete(norm), refresh: true };
    case 'exam': case 'course': case 'appointment': case 'task':
      return { text: executeCreate(intent, original, norm), refresh: true };
    case 'purchase': return { text: executePurchaseAdd(original, norm), refresh: true };
    case 'reading': return { text: executeReadingLog(original, norm), refresh: true };
    case 'book': return { text: executeBookAdd(original, norm), refresh: true };
    case 'track': return { text: executeTrackAdd(original, norm), refresh: true };
    case 'result': return { text: executeResultAdd(original, norm), refresh: true };
    default: return { text: helpText(), refresh: false };
  }
}

/* ============ واجهة المحادثة ============ */
function addMsg(text, who) {
  const div = document.createElement('div');
  div.className = 'msg ' + who; div.textContent = text;
  $('#chat').appendChild(div);
  $('#chat').scrollIntoView(false);
  div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function showTyping() {
  const d = document.createElement('div');
  d.className = 'msg bot typing';
  d.innerHTML = '<span></span><span></span><span></span>';
  $('#chat').appendChild(d);
  d.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  return d;
}
function removeTyping(d) { if (d && d.parentNode) d.parentNode.removeChild(d); }

function runByRules(text, fromVoice) {
  const res = processCommand(text);
  addMsg(res.text, 'bot');
  if (fromVoice || (typeof Sami !== 'undefined' && Sami.speakReplies)) speak(res.text);
  if (res.refresh) { refreshAll(); scheduleNativeReminders(); }
}
function isDataQuery(norm) {
  return /مهام|مواعيد|موعد|امتحان|كورس|محاضر|مسار|مشتري|كتب|كتاب|قراءه|قرات|نتيج|معدل|درجات|تقرير|جدول|اليوم|الاسبوع|القادم/.test(norm);
}
async function handleUserInput(text, fromVoice) {
  text = (text || '').trim();
  if (!text) return;
  addMsg(text, 'user');
  $('#chat-text').value = '';
  $('#chat-suggestions').classList.add('hidden');

  const norm = normalize(text);
  const intent = detectIntent(norm);
  const llmReady = (typeof Sami !== 'undefined' && Sami.enabled && Sami.available);

  // الأوامر (إضافة/تسجيل/حذف/إنهاء) والاستعلام عن البيانات: المحرّك الدقيق الفوري الموثوق
  const isAction = intent !== 'unknown' && intent !== 'query';
  const goRules = isAction || (intent === 'query' && (!llmReady || isDataQuery(norm)));
  if (goRules) { runByRules(text, fromVoice); return; }

  // المحادثة والأسئلة المفتوحة: النموذج الذكي إن توفّر، وإلا المحرّك البسيط
  if (llmReady) {
    const typing = showTyping();
    try {
      const reply = await Sami.chat(text);
      removeTyping(typing);
      addMsg(reply, 'bot');
      if (fromVoice || Sami.speakReplies) speak(reply);
      refreshAll(); scheduleNativeReminders();
    } catch (e) {
      removeTyping(typing);
      Sami.available = false; updateLlmStatus();
      runByRules(text, fromVoice);
    }
    return;
  }
  runByRules(text, fromVoice);
}

/* ============ التذكير والإشعارات ============ */
function collectReminders() {
  const out = [];
  store.tasks.forEach((t) => { if (!t.done && t.remind && t.date) out.push({ tag: 'task-' + t.id, when: new Date(`${t.date}T${t.time || '09:00'}`), title: 'تذكير بمهمة', body: t.title }); });
  store.appointments.forEach((a) => { if (a.remind !== false && a.date) out.push({ tag: 'appt-' + a.id, when: new Date(`${a.date}T${a.time || '09:00'}`), title: 'موعد', body: a.title + (a.note ? ' — ' + a.note : '') }); });
  store.exams.forEach((x) => { if (x.date) out.push({ tag: 'exam-' + x.id, when: new Date(`${x.date}T${x.time || '09:00'}`), title: 'امتحان قريب', body: 'امتحان ' + x.subject + (x.place ? ' — ' + x.place : '') }); });
  return out;
}
function fireReminder(r) {
  const opts = { body: r.body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: r.tag, vibrate: [120, 60, 120] };
  if ('Notification' in window && Notification.permission === 'granted') {
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then((reg) => reg.showNotification(r.title, opts)).catch(() => { try { new Notification(r.title, opts); } catch (e) {} });
    } else { try { new Notification(r.title, opts); } catch (e) {} }
  }
  speak(r.title + ': ' + r.body);
  toast(r.title + ': ' + r.body);
}
function checkReminders() {
  const now = Date.now();
  collectReminders().forEach((r) => {
    const t = r.when.getTime();
    if (isNaN(t)) return;
    const key = r.tag + '@' + r.when.toISOString().slice(0, 16);
    if (t <= now && now - t < 3600000 && !store.notified.includes(key)) {
      fireReminder(r); store.notified.push(key); persist('notified');
    }
  });
  // الكورسات المتكررة أسبوعياً
  const d = new Date(now), dow = d.getDay(), today = todayISO();
  store.courses.forEach((c) => {
    if (c.day === '' || c.day == null || !c.time) return;
    if (+c.day !== dow) return;
    const t = new Date(`${today}T${c.time}`).getTime();
    const key = 'course-' + c.id + '@' + today;
    if (t <= now && now - t < 3600000 && !store.notified.includes(key)) {
      fireReminder({ title: 'محاضرة اليوم', body: c.name + (c.instructor ? ' — ' + c.instructor : ''), tag: 'course-' + c.id });
      store.notified.push(key); persist('notified');
    }
  });
}
async function scheduleNativeReminders() {
  try {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (!('TimestampTrigger' in window)) return;
    const reg = await navigator.serviceWorker.ready;
    const items = collectReminders().filter((r) => r.when.getTime() > Date.now() + 5000);
    for (const r of items) {
      try {
        await reg.showNotification(r.title, {
          body: r.body, tag: r.tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
          showTrigger: new window.TimestampTrigger(r.when.getTime())
        });
      } catch (e) { /* تجاهل */ }
    }
  } catch (e) { /* تجاهل */ }
}
async function requestNotify() {
  if (!('Notification' in window)) { toast('متصفحكِ لا يدعم الإشعارات'); return; }
  let p = Notification.permission;
  if (p !== 'granted') p = await Notification.requestPermission();
  if (p === 'granted') { $('#btn-notify').classList.add('on'); toast('تم تفعيل الإشعارات'); scheduleNativeReminders(); }
  else toast('لم يتم السماح بالإشعارات');
}

/* ============ الترويسة ============ */
function setHeader() {
  const h = new Date().getHours();
  const greet = h < 12 ? 'صباح الخير' : 'مساء الخير';
  $('#greeting').textContent = greet + ' سلمى';
  $('#today-date').textContent = fmtFull(todayISO());
}

/* ============ التقارير (أسبوعي / شهري) ============ */
let reportOffset = 0;
let reportMode = 'week';
function buildMonthData(offset) {
  const base = new Date();
  const start = new Date(base.getFullYear(), base.getMonth() + offset, 1); start.setHours(0, 0, 0, 0);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0); end.setHours(23, 59, 59, 999);
  const inRange = (ms) => ms >= start.getTime() && ms <= end.getTime();
  const inMonth = (iso) => { const t = new Date(iso + 'T00:00').getTime(); return t >= start.getTime() && t <= end.getTime(); };
  const done = store.tasks.filter((t) => t.done && t.completedAt && inRange(t.completedAt));
  const todo = store.tasks.filter((t) => !t.done && t.date && inMonth(t.date));
  const events = [];
  store.exams.filter((x) => x.date && inMonth(x.date)).forEach((x) => events.push({ kind: 'امتحان', title: x.subject, date: x.date, time: x.time }));
  store.appointments.filter((a) => a.date && inMonth(a.date)).forEach((a) => events.push({ kind: 'موعد', title: a.title, date: a.date, time: a.time }));
  events.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const readPages = store.reading.filter((e) => inMonth(e.date)).reduce((s, e) => s + (parseFloat(e.pages) || 0), 0);
  return { start, end, done, todo, events, readPages };
}
function monthLabel(d) { return d.toLocaleDateString(AR, { month: 'long', year: 'numeric' }); }
function weekStartSat(d) {
  const x = stripTime(d);
  const diff = (x.getDay() - 6 + 7) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}
function buildWeekData(offset) {
  const start = weekStartSat(new Date());
  start.setDate(start.getDate() + offset * 7);
  const end = new Date(start); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999);
  const inWeek = (ms) => ms >= start.getTime() && ms <= end.getTime();
  const done = store.tasks.filter((t) => t.done && t.completedAt && inWeek(t.completedAt));
  const todo = store.tasks.filter((t) => !t.done && t.date && new Date(t.date + 'T00:00').getTime() <= end.getTime());
  const nEnd = new Date(end); nEnd.setDate(nEnd.getDate() + 7);
  const next = [];
  store.tasks.filter((t) => !t.done && t.date).forEach((t) => { const d = new Date(t.date + 'T00:00'); if (d > end && d <= nEnd) next.push({ kind: 'مهمة', title: t.title, date: t.date, time: t.time }); });
  store.exams.filter((x) => x.date).forEach((x) => { const d = new Date(x.date + 'T00:00'); if (d > end && d <= nEnd) next.push({ kind: 'امتحان', title: x.subject, date: x.date, time: x.time }); });
  store.appointments.filter((a) => a.date).forEach((a) => { const d = new Date(a.date + 'T00:00'); if (d > end && d <= nEnd) next.push({ kind: 'موعد', title: a.title, date: a.date, time: a.time }); });
  next.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const readPages = store.reading.filter((e) => { const t = new Date(e.date + 'T00:00').getTime(); return t >= start.getTime() && t <= end.getTime(); }).reduce((s, e) => s + (parseFloat(e.pages) || 0), 0);
  return { start, end, done, todo, next, readPages };
}
function weekLabel(start, end) {
  const s = start.toLocaleDateString(AR, { day: 'numeric', month: 'long' });
  const e = end.toLocaleDateString(AR, { day: 'numeric', month: 'long' });
  return `${s} — ${e}`;
}
const repSec = (cls, title, items, render) => `<div class="rep-section ${cls}"><h4>${title} <span class="rep-meta">${items.length}</span></h4>${items.length ? items.map(render).join('') : '<div class="rep-empty">لا شيء</div>'}</div>`;
function renderReport() {
  if (reportMode === 'month') return renderMonthReport();
  const w = buildWeekData(reportOffset);
  const t = $('#report-title'); if (t) t.textContent = 'التقرير الأسبوعي';
  $('#report-range').textContent = weekLabel(w.start, w.end) + (reportOffset === 0 ? ' (هذا الأسبوع)' : '');
  const taskItem = (t) => `<div class="rep-item"><span>${esc(t.title)}</span><span class="rep-meta">${t.date ? relDate(t.date).label : catLabel(t.category)}</span></div>`;
  const nextItem = (n) => `<div class="rep-item"><span>${esc(n.kind)}: ${esc(n.title)}</span><span class="rep-meta">${relDate(n.date).label}${n.time ? ' • ' + fmtTime(n.time) : ''}</span></div>`;
  $('#report-body').innerHTML =
    `<div class="rep-readstat">صفحات مقروءة هذا الأسبوع: ${w.readPages}</div>` +
    repSec('done', 'ما تمّ إنجازه', w.done, taskItem) +
    repSec('todo', 'ما لم يتمّ بعد', w.todo, taskItem) +
    repSec('next', 'التالي (الأسبوع القادم)', w.next, nextItem);
}
function renderMonthReport() {
  const m = buildMonthData(reportOffset);
  const t = $('#report-title'); if (t) t.textContent = 'التقرير الشهري';
  $('#report-range').textContent = monthLabel(m.start) + (reportOffset === 0 ? ' (هذا الشهر)' : '');
  const taskItem = (t) => `<div class="rep-item"><span>${esc(t.title)}</span><span class="rep-meta">${t.date ? fmtDayMonth(t.date) : catLabel(t.category)}</span></div>`;
  const evItem = (n) => `<div class="rep-item"><span>${esc(n.kind)}: ${esc(n.title)}</span><span class="rep-meta">${fmtDayMonth(n.date)}${n.time ? ' • ' + fmtTime(n.time) : ''}</span></div>`;
  $('#report-body').innerHTML =
    `<div class="rep-readstat">صفحات مقروءة هذا الشهر: ${m.readPages}</div>` +
    repSec('done', 'ما تمّ إنجازه', m.done, taskItem) +
    repSec('todo', 'مهام لم تتمّ', m.todo, taskItem) +
    repSec('next', 'امتحانات ومواعيد الشهر', m.events, evItem);
}
function syncRepToggle() { document.querySelectorAll('[data-repmode]').forEach((b) => b.classList.toggle('active', b.dataset.repmode === reportMode)); }
function openReport(mode) { reportMode = mode || 'week'; reportOffset = 0; syncRepToggle(); renderReport(); $('#report').classList.remove('hidden'); }
function closeReport() { $('#report').classList.add('hidden'); }
function monthReportToText(offset) {
  const m = buildMonthData(offset == null ? reportOffset : offset);
  const L = ['التقرير الشهري: ' + monthLabel(m.start), ''];
  L.push('صفحات مقروءة هذا الشهر: ' + m.readPages, '');
  L.push('• ما تمّ إنجازه (' + m.done.length + '):');
  m.done.forEach((t) => L.push('   - ' + t.title)); if (!m.done.length) L.push('   (لا شيء)');
  L.push('', '• مهام لم تتمّ (' + m.todo.length + '):');
  m.todo.forEach((t) => L.push('   - ' + t.title + (t.date ? ' [' + t.date + ']' : ''))); if (!m.todo.length) L.push('   (لا شيء)');
  L.push('', '• امتحانات ومواعيد الشهر (' + m.events.length + '):');
  m.events.forEach((n) => L.push('   - ' + n.kind + ': ' + n.title + ' [' + n.date + (n.time ? ' ' + n.time : '') + ']')); if (!m.events.length) L.push('   (لا شيء)');
  return L.join('\n');
}
function reportToText(offset) {
  if (reportMode === 'month') return monthReportToText(offset);
  const w = buildWeekData(offset == null ? reportOffset : offset);
  const L = ['تقرير الأسبوع: ' + weekLabel(w.start, w.end), ''];
  L.push('صفحات مقروءة هذا الأسبوع: ' + w.readPages, '');
  L.push('• ما تمّ إنجازه (' + w.done.length + '):');
  w.done.forEach((t) => L.push('   - ' + t.title));
  if (!w.done.length) L.push('   (لا شيء)');
  L.push('', '• ما لم يتمّ بعد (' + w.todo.length + '):');
  w.todo.forEach((t) => L.push('   - ' + t.title + (t.date ? ' [' + t.date + ']' : '')));
  if (!w.todo.length) L.push('   (لا شيء)');
  L.push('', '• التالي — الأسبوع القادم (' + w.next.length + '):');
  w.next.forEach((n) => L.push('   - ' + n.kind + ': ' + n.title + ' [' + n.date + (n.time ? ' ' + n.time : '') + ']'));
  if (!w.next.length) L.push('   (لا شيء)');
  return L.join('\n');
}
function downloadFile(name, content, type) {
  const blob = new Blob([content], { type: type || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}
function saveReportFile() {
  if (reportMode === 'month') {
    const m = buildMonthData(reportOffset);
    downloadFile('تقرير-شهر-' + dateToISO(m.start).slice(0, 7) + '.txt', reportToText());
  } else {
    const w = buildWeekData(reportOffset);
    downloadFile('تقرير-الأسبوع-' + dateToISO(w.start) + '.txt', reportToText());
  }
  toast('تم حفظ التقرير على الحاسوب (مجلد التنزيلات)');
}

/* ============ التقويم الشهري التفاعلي ============ */
let calOffset = 0;
let calSelected = null;
function dayItems(iso) {
  const dow = new Date(iso + 'T00:00').getDay();
  return {
    tasks: store.tasks.filter((t) => t.date === iso),
    appts: store.appointments.filter((a) => a.date === iso),
    exams: store.exams.filter((x) => x.date === iso),
    courses: store.courses.filter((c) => c.day !== '' && c.day != null && String(c.day) === String(dow)),
    reading: store.reading.filter((r) => r.date === iso)
  };
}
function dayCount(iso) {
  const d = dayItems(iso);
  return d.tasks.filter((t) => !t.done).length + d.appts.length + d.exams.length + d.courses.length;
}
function renderCalendar() {
  const wd = $('#cal-weekdays');
  if (wd) wd.innerHTML = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'].map((s) => `<span>${s}</span>`).join('');
  const base = new Date();
  const view = new Date(base.getFullYear(), base.getMonth() + calOffset, 1);
  const y = view.getFullYear(), m = view.getMonth();
  $('#cal-month').textContent = view.toLocaleDateString(AR, { month: 'long', year: 'numeric' });
  const first = new Date(y, m, 1);
  const gridStart = new Date(y, m, 1 - first.getDay());
  const today = todayISO();
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart); d.setDate(gridStart.getDate() + i);
    const iso = dateToISO(d);
    const cnt = dayCount(iso);
    const cls = ['cal-cell'];
    if (d.getMonth() !== m) cls.push('muted');
    if (iso === today) cls.push('today');
    if (iso === calSelected) cls.push('selected');
    cells += `<div class="${cls.join(' ')}" data-cal-day="${iso}">${d.getDate()}${cnt ? `<span class="cal-cnt">${cnt}</span>` : ''}</div>`;
  }
  $('#cal-grid').innerHTML = cells;
  renderCalDetail(calSelected);
}
function renderCalDetail(iso) {
  const box = $('#cal-detail');
  if (!box) return;
  if (!iso) { box.innerHTML = ''; return; }
  const d = dayItems(iso);
  const heading = new Date(iso + 'T00:00').toLocaleDateString(AR, { weekday: 'long', day: 'numeric', month: 'long' });
  const row = (label, meta) => `<div class="rep-item"><span>${esc(label)}</span><span class="rep-meta">${esc(meta || '')}</span></div>`;
  let items = '';
  d.exams.forEach((x) => items += row('امتحان ' + x.subject, x.time ? fmtTime(x.time) : ''));
  d.appts.forEach((a) => items += row(a.title, (a.time ? fmtTime(a.time) : '') + (a.note ? ' • ' + a.note : '')));
  d.courses.forEach((c) => items += row(c.name, 'محاضرة' + (c.time ? ' • ' + fmtTime(c.time) : '')));
  d.tasks.forEach((t) => items += row((t.done ? '✓ ' : '') + t.title, t.time ? fmtTime(t.time) : catLabel(t.category)));
  if (d.reading.length) { const p = d.reading.reduce((s, r) => s + (parseFloat(r.pages) || 0), 0); items += row('قراءة', p + ' صفحة'); }
  const any = items !== '';
  box.innerHTML = `<h4>${heading}</h4>` +
    (any ? `<div class="list">${items}</div>` : `<div class="cal-empty">لا يوجد شيء في هذا اليوم.</div>`) +
    `<button class="cal-add" data-cal-add="${iso}">+ أضيفي مهمة في هذا اليوم</button>`;
}
function openCalendar() { calOffset = 0; calSelected = todayISO(); renderCalendar(); $('#calendar').classList.remove('hidden'); }
function closeCalendar() { $('#calendar').classList.add('hidden'); }

/* ============ النسخ الاحتياطي على الحاسوب ============ */
function exportData() {
  const data = { app: 'سامي - مساعد سلمى', version: 1, exportedAt: new Date().toISOString() };
  KEYS.forEach((k) => { data[k] = store[k]; });
  downloadFile('نسخة-سامي-' + todayISO() + '.json', JSON.stringify(data, null, 2), 'application/json');
  toast('تم حفظ نسخة على الحاسوب (مجلد التنزيلات)');
}
function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      let count = 0;
      KEYS.forEach((k) => { if (Array.isArray(data[k])) { store[k] = data[k]; persist(k); count++; } });
      refreshAll();
      toast(count ? 'تم استيراد النسخة بنجاح' : 'الملف لا يحتوي بيانات صالحة');
    } catch (e) { toast('تعذّر قراءة الملف'); }
  };
  reader.readAsText(file);
}

/* ============ ربط الأحداث ============ */
document.addEventListener('click', (e) => {
  const close = e.target.closest('[data-close]');
  if (close) { closeModal(); return; }
  const nav = e.target.closest('.nav-btn');
  if (nav) { go(nav.dataset.screen); return; }
  const stat = e.target.closest('.stat-card');
  if (stat) { go(stat.dataset.go); return; }
  const add = e.target.closest('[data-add]');
  if (add) { openModal(add.dataset.add, null, false); return; }
  const seg = e.target.closest('.seg');
  if (seg) {
    if (seg.dataset.cat) {
      taskCat = seg.dataset.cat;
      seg.parentElement.querySelectorAll('.seg').forEach((b) => b.classList.toggle('active', b === seg));
      renderTasks();
    } else if (seg.dataset.study) {
      seg.parentElement.querySelectorAll('.seg').forEach((b) => b.classList.toggle('active', b === seg));
      $('#study-exams').classList.toggle('hidden', seg.dataset.study !== 'exams');
      $('#study-courses').classList.toggle('hidden', seg.dataset.study !== 'courses');
      $('#study-results').classList.toggle('hidden', seg.dataset.study !== 'results');
    } else if (seg.dataset.reading) {
      seg.parentElement.querySelectorAll('.seg').forEach((b) => b.classList.toggle('active', b === seg));
      $('#reading-books').classList.toggle('hidden', seg.dataset.reading !== 'books');
      $('#reading-log').classList.toggle('hidden', seg.dataset.reading !== 'log');
    } else if (seg.dataset.shop) {
      shopFilter = seg.dataset.shop;
      seg.parentElement.querySelectorAll('.seg').forEach((b) => b.classList.toggle('active', b === seg));
      renderShopping();
    } else if (seg.dataset.repmode) {
      reportMode = seg.dataset.repmode;
      reportOffset = 0;
      seg.parentElement.querySelectorAll('.seg').forEach((b) => b.classList.toggle('active', b === seg));
      renderReport();
    }
    return;
  }
  const trackDel = e.target.closest('[data-track-del]');
  if (trackDel) { deleteTrack(trackDel.dataset.trackDel); return; }
  const trackBack = e.target.closest('[data-track-back]');
  if (trackBack) { currentTrack = null; renderTracks(); return; }
  const addNewTrack = e.target.closest('[data-add-newtrack]');
  if (addNewTrack) { openModal('track', null, false); return; }
  const addTrackTask = e.target.closest('[data-add-track]');
  if (addTrackTask) { openModal('task', { track: addTrackTask.dataset.addTrack }, false); return; }
  const trackOpen = e.target.closest('[data-track-open]');
  if (trackOpen) { currentTrack = trackOpen.dataset.trackOpen; renderTracks(); return; }
  const logBook = e.target.closest('[data-log-book]');
  if (logBook) { openModal('reading', { bookId: logBook.dataset.logBook }); return; }
  const delReading = e.target.closest('[data-del-reading]');
  if (delReading) { tombstone(delReading.dataset.delReading); store.reading = store.reading.filter((x) => x.id !== delReading.dataset.delReading); persist('reading'); refreshAll(); toast('تم الحذف'); return; }
  const del = e.target.closest('.del');
  if (del) { const c = del.closest('.card'); removeItem(c.dataset.type, c.dataset.id); return; }
  const chk = e.target.closest('.check');
  if (chk) {
    const c = chk.closest('.card');
    if (c.dataset.type === 'purchase') togglePurchase(c.dataset.id);
    else toggleTask(c.dataset.id);
    return;
  }
  const chip = e.target.closest('.chip');
  if (chip) { handleUserInput(chip.textContent, false); return; }
  const card = e.target.closest('.card');
  if (card) { editItem(card.dataset.type, card.dataset.id); return; }
});

$('#modal-form').addEventListener('submit', (e) => { e.preventDefault(); saveModal(); });
$('#fab').addEventListener('click', () => openModal('task', null, true));
$('#btn-notify').addEventListener('click', requestNotify);
$('#btn-mic').addEventListener('click', toggleMic);
$('#btn-send').addEventListener('click', () => handleUserInput($('#chat-text').value, false));
$('#chat-text').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleUserInput($('#chat-text').value, false); } });
$('#btn-week-report').addEventListener('click', openReport);
$('#btn-export').addEventListener('click', exportData);
$('#btn-import').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', (e) => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ''; });
$('#report-prev').addEventListener('click', () => { reportOffset--; renderReport(); });
$('#report-next').addEventListener('click', () => { reportOffset++; renderReport(); });
$('#report-save').addEventListener('click', saveReportFile);
document.addEventListener('click', (e) => { if (e.target.closest('[data-close-report]')) closeReport(); });

// التقويم
$('#btn-calendar').addEventListener('click', openCalendar);
$('#cal-prev').addEventListener('click', () => { calOffset--; renderCalendar(); });
$('#cal-next').addEventListener('click', () => { calOffset++; renderCalendar(); });
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-close-cal]')) { closeCalendar(); return; }
  const day = e.target.closest('[data-cal-day]');
  if (day) { calSelected = day.dataset.calDay; renderCalendar(); return; }
  const add = e.target.closest('[data-cal-add]');
  if (add) { openModal('task', { date: add.dataset.calAdd }, false); return; }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminders(); });

/* ============ بدء التشغيل ============ */
function init() {
  if (!store.tracks.length) {
    SEED_TRACKS.forEach((name, i) => store.tracks.push({ id: uid(), name, color: TRACK_COLORS[i % TRACK_COLORS.length], createdAt: Date.now() + i }));
    persist('tracks');
  }
  setHeader();
  refreshAll();
  if ('Notification' in window && Notification.permission === 'granted') $('#btn-notify').classList.add('on');
  addMsg('مرحبًا سلمى، أنا سامي مساعدكِ الشخصي. مهمتي أن أعينكِ على تنظيم مواعيدكِ ومهامّكِ ودراستكِ. اكتبي أو اضغطي على الميكروفون وتحدّثي معي، أو جرّبي أحد الاقتراحات في الأسفل.', 'bot');
  checkReminders();
  setInterval(checkReminders, 30000);
  scheduleNativeReminders();
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js').catch(() => {}));
  }
}
init();
