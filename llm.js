'use strict';

/* =================================================================
   تكامل المحادثة الذكية مع نموذج محلي عبر واجهة متوافقة مع OpenAI
   يعمل مع LM Studio (منفذ 1234) و Ollama (منفذ 11434) دون تغيير.
   يعتمد على دوال app.js (store, normalize, extractDate, fmtFull ...)
   ================================================================= */

const Sami = {
  url: '',
  model: 'qwen2.5:3b',
  enabled: true,
  available: false,
  speakReplies: false,
  models: [],
  history: [],

  candidates() {
    const h = location.hostname || 'localhost';
    return [`http://${h}:1234`, `http://${h}:11434`];
  },
  load() {
    try {
      const s = JSON.parse(localStorage.getItem('salma.sami') || '{}');
      this.url = (s.url || '').replace(/\/+$/, '');
      this.model = s.model || '';
      this.enabled = s.enabled !== false;
      this.speakReplies = !!s.speakReplies;
    } catch (e) { /* تجاهل */ }
  },
  save() {
    localStorage.setItem('salma.sami', JSON.stringify({ url: this.url, model: this.model, enabled: this.enabled, speakReplies: this.speakReplies }));
  },

  async init() {
    this.load();
    if (!this.url) await this.autodetect();
    await this.ping();
  },
  async autodetect() {
    for (const base of this.candidates()) {
      try {
        const r = await fetchTimeout(base + '/v1/models', {}, 1800);
        if (r.ok) { this.url = base; return; }
      } catch (e) { /* جرّب التالي */ }
    }
  },
  async ping() {
    if (!this.enabled) { this.available = false; this.models = []; updateLlmStatus(); return; }
    if (!this.url) await this.autodetect();
    try {
      const r = await fetchTimeout(this.url + '/v1/models', {}, 2500);
      const j = await r.json();
      this.models = (j.data || []).map((m) => m.id);
      this.available = this.models.length > 0 || r.ok;
      this.chooseModel();
    } catch (e) { this.available = false; }
    updateLlmStatus();
  },
  chooseModel() {
    if (this.model && this.models.includes(this.model)) return;
    if (!this.models.length) { if (!this.model) this.model = 'qwen2.5:3b'; return; }
    // الأفضل لهذا الجهاز: نموذج خفيف يعمل كاملًا على الكرت (3b ثم أي qwen ثم أي نموذج)
    this.model = this.models.find((m) => /qwen2\.5:3b/i.test(m))
      || this.models.find((m) => /3b/i.test(m))
      || this.models.find((m) => /qwen/i.test(m))
      || this.models[0];
  },

  systemPrompt() {
    const tracks = (store.tracks || []).map((t) => t.name).join('، ') || 'لا يوجد';
    return [
      'أنتَ «سامي»، مساعد شخصي ذكي لـ«سلمى».',
      'تحدّث عن نفسك بصيغة المذكّر (فأنت سامي)، وخاطِب سلمى دائمًا بصيغة المؤنث وبالعربية الفصحى فقط، وتجنّب العامية.',
      'مهمتك مساعدتها على تنظيم مواعيدها ومهامّها ودراستها (كورسات وامتحانات) ومساراتها الحياتية.',
      `تاريخ اليوم هو ${fmtFull(todayISO())}.`,
      'مهم جدًا: لا تحسب التواريخ بنفسك. مرِّر التاريخ في الأدوات كما نطقته سلمى بالعربية حرفيًا (مثل: «اليوم»، «غدًا»، «بعد غد»، «الأحد القادم»، «12 يونيو»). النظام سيحوّله تلقائيًا. أمّا الوقت فمرِّريه بصيغة HH:MM بنظام 24 ساعة (مثلًا 4 عصرًا = 16:00).',
      `مسارات سلمى الحالية: ${tracks}.`,
      'إذا طلبت إضافة أو حذف أو إنهاء أو عرض شيء (مهمة، موعد، امتحان، كورس، مسار)، فاستخدم الأدوات (functions) المتاحة، ثم أكّد لها النتيجة بإيجاز ولُطف بالفصحى.',
      'إذا كان كلامها محادثة عامة أو سؤالًا معرفيًا، فأجِب مباشرةً بإيجاز ودفء دون استخدام أدوات.',
      'كن مختصرًا وعمليًا ومشجِّعًا.'
    ].join('\n');
  },

  async chat(text) {
    this.currentUserText = text;
    const msgs = [
      { role: 'system', content: this.systemPrompt() },
      ...this.history.slice(-10),
      { role: 'user', content: text }
    ];
    let finalText = '';
    for (let i = 0; i < 4; i++) {
      const res = await fetchTimeout(this.url + '/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, messages: msgs, tools: TOOLS, tool_choice: 'auto', temperature: 0.5, stream: false })
      }, 120000);
      const data = await res.json();
      const m = (data.choices && data.choices[0] && data.choices[0].message) || {};
      msgs.push(m);
      if (m.tool_calls && m.tool_calls.length) {
        m.tool_calls.forEach((tc, idx) => {
          let args = tc.function && tc.function.arguments;
          if (typeof args === 'string') { try { args = JSON.parse(args); } catch (e) { args = {}; } }
          const out = runSamiTool(tc.function ? tc.function.name : '', args || {});
          msgs.push({ role: 'tool', tool_call_id: tc.id || ('call_' + idx), content: String(out) });
        });
        continue;
      }
      finalText = (m.content || '').trim();
      break;
    }
    if (!finalText) finalText = 'تمّ ذلك.';
    this.history.push({ role: 'user', content: text }, { role: 'assistant', content: finalText });
    if (this.history.length > 16) this.history = this.history.slice(-16);
    return finalText;
  }
};

function fetchTimeout(url, opts, ms) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, Object.assign({ signal: ctrl.signal }, opts)).finally(() => clearTimeout(id));
}

function runSamiTool(name, args) {
  const fn = window.SamiActions && window.SamiActions[name];
  if (!fn) return 'أداة غير معروفة: ' + name;
  try { return fn(args) || 'تم'; } catch (e) { return 'تعذّر التنفيذ: ' + (e && e.message); }
}

const TOOLS = [
  { type: 'function', function: { name: 'add_task', description: 'إضافة مهمة جديدة لسلمى', parameters: { type: 'object', properties: {
    title: { type: 'string', description: 'عنوان المهمة' },
    category: { type: 'string', enum: ['daily', 'weekly', 'yearly', 'general'], description: 'يومية أو أسبوعية أو سنوية أو عامة' },
    track: { type: 'string', description: 'اسم المسار إن وُجد، مثل: القرآن، الرياضة، العلوم الشرعية' },
    date: { type: 'string', description: 'التاريخ كما نطقته سلمى بالعربية حرفيًا مثل: غدًا، الأحد القادم، 12 يونيو (لا تحوّليه لأرقام)' },
    time: { type: 'string', description: 'الوقت بصيغة HH:MM بنظام 24 ساعة إن حُدِّد' },
    remind: { type: 'boolean', description: 'هل تريد سلمى تذكيرًا بها' }
  }, required: ['title'] } } },
  { type: 'function', function: { name: 'add_exam', description: 'إضافة امتحان', parameters: { type: 'object', properties: {
    subject: { type: 'string', description: 'اسم المادة' },
    date: { type: 'string', description: 'التاريخ كما نطقته سلمى بالعربية حرفيًا مثل: غدًا، الأحد القادم، 12 يونيو (لا تحوّليه لأرقام)' },
    time: { type: 'string', description: 'الوقت بصيغة HH:MM بنظام 24 ساعة' },
    place: { type: 'string', description: 'المكان' }
  }, required: ['subject', 'date'] } } },
  { type: 'function', function: { name: 'add_appointment', description: 'إضافة موعد', parameters: { type: 'object', properties: {
    title: { type: 'string', description: 'عنوان الموعد' },
    date: { type: 'string', description: 'التاريخ كما نطقته سلمى بالعربية حرفيًا مثل: غدًا، الأحد القادم، 12 يونيو (لا تحوّليه لأرقام)' },
    time: { type: 'string', description: 'الوقت بصيغة HH:MM بنظام 24 ساعة' },
    note: { type: 'string', description: 'ملاحظة' }
  }, required: ['title', 'date'] } } },
  { type: 'function', function: { name: 'add_course', description: 'إضافة كورس أو محاضرة أسبوعية متكررة', parameters: { type: 'object', properties: {
    name: { type: 'string', description: 'اسم الكورس' },
    weekday: { type: 'string', description: 'يوم المحاضرة: اسم اليوم بالعربية أو رقم 0=الأحد حتى 6=السبت' },
    time: { type: 'string', description: 'الوقت بصيغة HH:MM' },
    instructor: { type: 'string', description: 'اسم المحاضر' }
  }, required: ['name'] } } },
  { type: 'function', function: { name: 'add_track', description: 'إضافة مسار حياة جديد لسلمى', parameters: { type: 'object', properties: {
    name: { type: 'string', description: 'اسم المسار' }
  }, required: ['name'] } } },
  { type: 'function', function: { name: 'add_result', description: 'إضافة نتيجة/درجة مادة دراسية', parameters: { type: 'object', properties: {
    subject: { type: 'string', description: 'اسم المادة' },
    score: { type: 'number', description: 'الدرجة التي حصلت عليها' },
    maxScore: { type: 'number', description: 'الدرجة العظمى (افتراضيًا 100)' },
    term: { type: 'string', description: 'الفصل أو السنة الدراسية' },
    credit: { type: 'number', description: 'الساعات المعتمدة إن وُجدت' }
  }, required: ['subject', 'score'] } } },
  { type: 'function', function: { name: 'add_book', description: 'إضافة كتاب إلى قائمة القراءة', parameters: { type: 'object', properties: {
    title: { type: 'string', description: 'اسم الكتاب' },
    author: { type: 'string', description: 'المؤلف' },
    totalPages: { type: 'number', description: 'عدد صفحات الكتاب' }
  }, required: ['title'] } } },
  { type: 'function', function: { name: 'log_reading', description: 'تسجيل عدد الصفحات المقروءة من كتاب في يوم معيّن', parameters: { type: 'object', properties: {
    book: { type: 'string', description: 'اسم الكتاب' },
    pages: { type: 'number', description: 'عدد الصفحات المقروءة' },
    date: { type: 'string', description: 'التاريخ كما نطقته سلمى بالعربية (افتراضيًا اليوم)' }
  }, required: ['pages'] } } },
  { type: 'function', function: { name: 'add_purchase', description: 'إضافة مادة إلى قائمة المشتريات', parameters: { type: 'object', properties: {
    name: { type: 'string', description: 'اسم المادة' },
    qty: { type: 'string', description: 'الكمية مثل: 1 كيلو، 3 علب' },
    category: { type: 'string', description: 'الفئة مثل: خضار، ملابس' }
  }, required: ['name'] } } },
  { type: 'function', function: { name: 'mark_bought', description: 'تعليم مادة في قائمة المشتريات بأنها اشتُريت', parameters: { type: 'object', properties: {
    name: { type: 'string', description: 'اسم المادة' }
  }, required: ['name'] } } },
  { type: 'function', function: { name: 'complete_task', description: 'وضع علامة الإنجاز على مهمة بالاسم', parameters: { type: 'object', properties: {
    title: { type: 'string', description: 'اسم المهمة' }
  }, required: ['title'] } } },
  { type: 'function', function: { name: 'delete_item', description: 'حذف مهمة أو موعد أو امتحان أو كورس أو مسار بالاسم', parameters: { type: 'object', properties: {
    name: { type: 'string', description: 'اسم العنصر' }
  }, required: ['name'] } } },
  { type: 'function', function: { name: 'get_schedule', description: 'عرض جدول سلمى أو قوائمها', parameters: { type: 'object', properties: {
    scope: { type: 'string', enum: ['today', 'exams', 'appointments', 'tracks', 'weekly', 'yearly', 'general', 'results', 'reading', 'shopping', 'report'], description: 'ما المطلوب عرضه (today اليوم، results النتائج، reading القراءة، shopping المشتريات، report تقرير الأسبوع...)' }
  }, required: ['scope'] } } }
];

function updateLlmStatus() {
  const el = document.getElementById('llm-status');
  if (!el) return;
  if (typeof Sami === 'undefined' || !Sami.enabled) { el.className = 'llm-status off'; el.textContent = 'الذكاء معطّل — الوضع البسيط'; return; }
  if (Sami.available) { el.className = 'llm-status on'; el.textContent = 'سامي الذكي متصل · ' + (Sami.model || 'نموذج محلي'); }
  else { el.className = 'llm-status off'; el.textContent = 'النموذج غير متصل — الوضع البسيط'; }
}

/* ربط الزر والتشغيل (يعمل بعد تحميل app.js لأن هذا الملف يأتي بعده) */
(function () {
  const gear = document.getElementById('btn-llm-settings');
  if (gear) gear.addEventListener('click', () => openModal('settings'));
  if (Sami && typeof Sami.init === 'function') Sami.init();
})();
