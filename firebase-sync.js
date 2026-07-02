'use strict';

/* =================================================================
   مزامنة سحابية عبر Firebase (Firestore + Google Sign-In)
   دمج ذكي بين الأجهزة: updatedAt لكل عنصر + سجل محذوفات (tombstones)
   يعتمد على app.js (store, SYNC_KEYS, refreshAll, toast, renderCalendar)
   ================================================================= */

function _pickSync(src) {
  const o = { _deleted: (src && src._deleted) || [] };
  SYNC_KEYS.forEach((k) => { o[k] = (src && src[k]) || []; });
  return o;
}
function _canon(data) {
  const o = {};
  ['_deleted'].concat(SYNC_KEYS).forEach((k) => {
    o[k] = [...(data[k] || [])].sort((a, b) => String(a && a.id).localeCompare(String(b && b.id)));
  });
  return JSON.stringify(o);
}
function _ensureStamps(data) {
  SYNC_KEYS.forEach((k) => (data[k] || []).forEach((it) => {
    if (it && it.id && !it.updatedAt) it.updatedAt = it.createdAt || 1;
  }));
  return data;
}
function mergeStores(localS, remoteS) {
  const tomb = {};
  [...(localS._deleted || []), ...(remoteS._deleted || [])].forEach((t) => {
    if (t && t.id && (!tomb[t.id] || t.at > tomb[t.id])) tomb[t.id] = t.at;
  });
  const out = { _deleted: Object.keys(tomb).map((id) => ({ id, at: tomb[id] })) };
  SYNC_KEYS.forEach((k) => {
    const map = {};
    [...(remoteS[k] || []), ...(localS[k] || [])].forEach((it) => {
      if (!it || !it.id) return;
      const ex = map[it.id];
      if (!ex || (it.updatedAt || 0) >= (ex.updatedAt || 0)) map[it.id] = it;
    });
    out[k] = Object.values(map).filter((it) => !(it.id in tomb) || (it.updatedAt || 0) > tomb[it.id]);
  });
  return out;
}

const Sync = {
  app: null, auth: null, db: null, user: null, ref: null, unsub: null,
  applying: false, pushTimer: null, lastPushedJson: '', status: 'off',

  init() {
    const cfg = window.SAMI_FIREBASE_CONFIG;
    if (!cfg || !cfg.apiKey || typeof firebase === 'undefined') { this.setStatus('off'); return; }
    try {
      this.app = firebase.initializeApp(cfg);
      this.auth = firebase.auth();
      this.db = firebase.firestore();
      try { this.auth.useDeviceLanguage(); } catch (e) {}
    } catch (e) { this.setStatus('off'); return; }
    this.auth.onAuthStateChanged((u) => {
      this.user = u;
      if (u) { this.startListening(); this.setStatus('syncing'); }
      else { this.stopListening(); this.setStatus('signedout'); }
    });
    this.auth.getRedirectResult().catch(() => {});
  },

  signIn() {
    if (!this.auth) { toast('المزامنة غير مُعدّة بعد'); return; }
    const provider = new firebase.auth.GoogleAuthProvider();
    this.auth.signInWithPopup(provider).catch((err) => {
      const c = err && err.code;
      if (c === 'auth/popup-blocked' || c === 'auth/cancelled-popup-request' || c === 'auth/operation-not-supported-in-this-environment' || c === 'auth/popup-closed-by-user') {
        try { this.auth.signInWithRedirect(provider); } catch (e) {}
      } else { toast('تعذّر تسجيل الدخول' + (c ? ': ' + c : '')); }
    });
  },
  signOut() { if (this.auth) this.auth.signOut(); },

  startListening() {
    if (!this.user) return;
    this.ref = this.db.collection('users').doc(this.user.uid);
    this.stopListening();
    this.unsub = this.ref.onSnapshot((snap) => {
      if (snap.exists) this.applyRemote(snap.data() || {});
      else { this.lastPushedJson = ''; this.pushLocal(); }
    }, () => this.setStatus('error'));
  },
  stopListening() { if (this.unsub) { this.unsub(); this.unsub = null; } this.ref = null; },

  applyRemote(remote) {
    this.applying = true;
    const merged = mergeStores(_pickSync(store), remote);
    SYNC_KEYS.forEach((k) => { store[k] = merged[k] || []; localStorage.setItem('salma.' + k, JSON.stringify(store[k])); });
    store._deleted = merged._deleted || [];
    localStorage.setItem('salma._deleted', JSON.stringify(store._deleted));
    this.applying = false;
    try { refreshAll(); if (!document.getElementById('calendar').classList.contains('hidden')) renderCalendar(); } catch (e) {}
    const mj = _canon(merged);
    if (mj !== _canon(_pickSync(remote))) { this.lastPushedJson = ''; this.schedulePush(); }
    else this.lastPushedJson = mj;
    this.setStatus('synced');
    if (typeof scheduleNativeReminders === 'function') scheduleNativeReminders();
  },

  onLocalChange() { if (this.applying || !this.user) return; this.schedulePush(); },
  schedulePush() { clearTimeout(this.pushTimer); this.setStatus('syncing'); this.pushTimer = setTimeout(() => this.pushLocal(), 1200); },
  pushLocal() {
    if (!this.user || !this.ref) return;
    const data = _ensureStamps(_pickSync(store));
    const j = _canon(data);
    if (j === this.lastPushedJson) { this.setStatus('synced'); return; }
    this.ref.set(data).then(() => { this.lastPushedJson = j; this.setStatus('synced'); }).catch(() => this.setStatus('error'));
  },

  setStatus(s) { this.status = s; updateSyncUI(); },
  syncNow() { if (this.user) { this.lastPushedJson = ''; this.pushLocal(); } }
};

function syncStateText() {
  if (typeof Sync === 'undefined') return { label: 'المزامنة', cls: '' };
  switch (Sync.status) {
    case 'synced': return { label: 'متزامن ✓', cls: 'on' };
    case 'syncing': return { label: 'جارٍ المزامنة…', cls: 'busy' };
    case 'signedout': return { label: 'المزامنة — سجّلي الدخول', cls: 'off' };
    case 'error': return { label: 'خطأ في المزامنة', cls: 'err' };
    default: return { label: 'المزامنة غير مُفعّلة', cls: 'off' };
  }
}
function updateSyncUI() {
  const st = syncStateText();
  const lbl = document.getElementById('sync-label');
  if (lbl) { lbl.textContent = st.label; }
  const bar = document.getElementById('btn-sync');
  if (bar) { bar.className = 'sync-bar ' + st.cls; }
  const body = document.getElementById('sync-body');
  if (body && !document.getElementById('sync-modal').classList.contains('hidden')) renderSyncModal();
}
function renderSyncModal() {
  const body = document.getElementById('sync-body');
  if (!body) return;
  if (typeof Sync === 'undefined' || Sync.status === 'off') {
    body.innerHTML = '<div class="cal-empty">المزامنة غير مُعدّة على هذه النسخة بعد.</div>';
    return;
  }
  if (Sync.user) {
    body.innerHTML =
      '<div class="sync-info"><div class="sync-badge on">✓</div>' +
      '<div><div class="sync-title">المزامنة مُفعّلة</div>' +
      '<div class="muted">' + esc(Sync.user.email || Sync.user.displayName || '') + '</div></div></div>' +
      '<p class="muted" style="margin:12px 2px">بياناتكِ تتزامن تلقائيًا بين كل أجهزتكِ التي سجّلتِ الدخول فيها بنفس الحساب.</p>' +
      '<div class="modal-actions"><button type="button" class="btn ghost" id="sync-signout">تسجيل الخروج</button>' +
      '<button type="button" class="btn primary" id="sync-now">مزامنة الآن</button></div>';
    const so = document.getElementById('sync-signout'); if (so) so.onclick = () => { Sync.signOut(); };
    const sn = document.getElementById('sync-now'); if (sn) sn.onclick = () => { Sync.syncNow(); toast('يُزامن الآن'); };
  } else {
    body.innerHTML =
      '<p class="muted" style="margin:6px 2px 16px">سجّلي الدخول بحساب Google مرة واحدة على كل جهاز، فتصبح مهامّكِ وأحداثكِ واحدة ومتزامنة في كل مكان.</p>' +
      '<button type="button" class="btn primary" id="sync-google" style="width:100%">تسجيل الدخول بحساب Google</button>';
    const g = document.getElementById('sync-google'); if (g) g.onclick = () => { Sync.signIn(); };
  }
}
function openSyncModal() { document.getElementById('sync-modal').classList.remove('hidden'); renderSyncModal(); }
function closeSyncModal() { document.getElementById('sync-modal').classList.add('hidden'); }

(function () {
  const b = document.getElementById('btn-sync');
  if (b) b.addEventListener('click', openSyncModal);
  document.addEventListener('click', (e) => { if (e.target.closest('[data-close-sync]')) closeSyncModal(); });
  if (typeof Sync !== 'undefined' && Sync.init) { try { Sync.init(); } catch (e) {} }
  updateSyncUI();
})();
