/**
 * career_ai.js
 * -------------
 * تجربة المساعد الذكي للإرشاد المهني («سعود»):
 *   - عرض تدفق الأسئلة/الأجوبة داخل ‎#aria-panel‎
 *   - التواصل مع خادم Flask عبر ‎/recommend‎ و ‎/chat‎
 *   - التراجع الآمن إلى توصية محلية إذا تعذر الوصول إلى الخادم
 *
 * تُوفِّر هذه الوحدة واجهة برمجية صغيرة على ‎window.CareerAI‎ حتى يستطيع
 * script.js (مشهد Three.js) فتح «سعود»، والتفاعل مع التوصية النهائية
 * (مثل نقل الزائر إلى الغرفة الموصى بها).
 *
 * المسارات الثلاثة التي توصي بها سعود:
 *   1. هندسة الطاقة المتجددة (renewable_energy)
 *   2. الذكاء الاصطناعي (artificial_intelligence)
 *   3. الروبوتات الجراحية (surgical_robotics)
 */

// عنوان خادم Flask. بما أن app.py يخدم الواجهة أيضاً، فالمسارات النسبية
// تعمل مباشرة عند التشغيل من http://localhost:5000
const API_BASE = "";

// -----------------------------------------------------------------------
// «البوصلة المهنية» — اختبار ميول مهنية بأسلوب Career Compass
// -----------------------------------------------------------------------
// بدل المطابقة بالكلمات المفتاحية: كل خيار يحمل أوزاناً رقمية صريحة لكل
// مسار من المسارات الثلاثة، وتُحسب في النهاية نسبة توافق مئوية مرتبة
// لكل مسار — كما في تجربة Career Compass. ثمانية أبعاد: الاهتمامات،
// نقاط القوة، بيئة العمل، الأثر، أسلوب العمل، المواد المفضلة، التقنيات،
// والرؤية المستقبلية.
// المفاتيح: re = الطاقة المتجددة، ai = الذكاء الاصطناعي، sr = الروبوتات الجراحية.
const QUESTIONS = [
  {
    text: "أي المجالات تستمتع بالقراءة والمشاهدة عنه في وقت فراغك؟",
    options: [
      { label: "البيئة والمناخ والطاقة النظيفة", w: { re: 3 } },
      { label: "الحواسيب والخوارزميات والتقنية", w: { ai: 3 } },
      { label: "الطب وجسم الإنسان والصحة", w: { sr: 3 } },
      { label: "الآلات والميكانيكا والهندسة", w: { re: 1, sr: 2 } },
    ],
  },
  {
    text: "ما أبرز نقاط قوتك الشخصية؟",
    options: [
      { label: "التحليل الرياضي وفهم الفيزياء", w: { re: 2, ai: 1 } },
      { label: "البرمجة والتفكير المنطقي", w: { ai: 3 } },
      { label: "الدقة العالية والعمل اليدوي الحريص", w: { sr: 3 } },
      { label: "التصميم والإبداع الهندسي", w: { re: 2, ai: 1 } },
    ],
  },
  {
    text: "أي بيئة عمل تفضّل قضاء يومك فيها؟",
    options: [
      { label: "مواقع ميدانية ومحطات في الهواء الطلق", w: { re: 3 } },
      { label: "مكاتب ومختبرات حاسوبية متقدمة", w: { ai: 3 } },
      { label: "مستشفيات ومراكز طبية متخصصة", w: { sr: 3 } },
      { label: "مصانع ومختبرات تقنية متنوعة", w: { re: 1, ai: 1, sr: 1 } },
    ],
  },
  {
    text: "ما الأثر الذي تحلم بتركه في العالم؟",
    options: [
      { label: "كوكب أنظف واستدامة للأجيال القادمة", w: { re: 3 } },
      { label: "تقنيات ذكية تسهّل حياة الناس يومياً", w: { ai: 3 } },
      { label: "إنقاذ الأرواح وتحسين نتائج العلاج", w: { sr: 3 } },
      { label: "ابتكار منتجات وريادة أعمال تقنية", w: { ai: 2, re: 1 } },
    ],
  },
  {
    text: "أي أسلوب عمل يناسب شخصيتك أكثر؟",
    options: [
      { label: "مشاريع ضخمة طويلة المدى وبنية تحتية", w: { re: 2, ai: 1 } },
      { label: "تجارب سريعة وتكرار وتحسين مستمر", w: { ai: 3 } },
      { label: "بروتوكولات دقيقة ومعايير سلامة صارمة", w: { sr: 3 } },
      { label: "فرق متعددة التخصصات تجمع مجالات مختلفة", w: { re: 1, ai: 1, sr: 1 } },
    ],
  },
  {
    text: "أي المواد الدراسية كانت (أو ما تزال) الأقرب إلى قلبك؟",
    options: [
      { label: "الفيزياء والكهرباء", w: { re: 3 } },
      { label: "الرياضيات وعلوم الحاسب", w: { ai: 3 } },
      { label: "الأحياء والكيمياء", w: { sr: 3 } },
      { label: "التقنية الرقمية والتصميم", w: { ai: 2, re: 1 } },
    ],
  },
  {
    text: "أي تقنية تتمنى أن تعمل عليها بيديك؟",
    options: [
      { label: "ألواح شمسية وتوربينات وشبكات ذكية", w: { re: 3 } },
      { label: "نماذج ذكاء اصطناعي وروبوتات ذكية", w: { ai: 3 } },
      { label: "روبوتات جراحية وأجهزة طبية دقيقة", w: { sr: 3 } },
      { label: "مركبات ذاتية القيادة", w: { ai: 2, sr: 1 } },
    ],
  },
  {
    text: "كيف ترى نفسك بعد عشر سنوات؟",
    options: [
      { label: "مهندس طاقة يقود مشاريع وطنية كبرى", w: { re: 3 } },
      { label: "خبير ذكاء اصطناعي يبني أنظمة ذكية", w: { ai: 3 } },
      { label: "مختص تقنيات طبية يطوّر أدوات العلاج", w: { sr: 3 } },
      { label: "باحث وأكاديمي في مجال تقني متقدم", w: { re: 1, ai: 1, sr: 1 } },
    ],
  },
];

// بيانات المسارات الثلاثة (عناوين/تخصصات/مهارات/جامعات سعودية موصى بها)
const CAREER_INFO = {
  renewable_energy: {
    title: "هندسة الطاقة المتجددة",
    majors: ["الهندسة الكهربائية", "هندسة الطاقة المتجددة", "الهندسة الميكانيكية"],
    skills: ["MATLAB/Simulink", "تحليل أنظمة القدرة الكهربائية", "أنظمة PLC/SCADA", "تحليل الاستدامة"],
    universities: ["جامعة الملك فهد للبترول والمعادن", "جامعة الملك عبدالله للعلوم والتقنية (كاوست)", "جامعة الملك سعود", "جامعة الملك عبدالعزيز"],
  },
  artificial_intelligence: {
    title: "الذكاء الاصطناعي",
    majors: ["علوم الحاسب", "الذكاء الاصطناعي", "علوم البيانات"],
    skills: ["لغة بايثون", "تعلّم الآلة", "الجبر الخطي", "أطر التعلم العميق"],
    universities: ["جامعة الملك عبدالله للعلوم والتقنية (كاوست)", "جامعة الملك فهد للبترول والمعادن", "جامعة الملك سعود", "جامعة الأمير سلطان"],
  },
  surgical_robotics: {
    title: "الروبوتات الجراحية",
    majors: ["هندسة الميكاترونكس", "الهندسة الطبية الحيوية", "هندسة الروبوتات"],
    skills: ["برمجة الروبوتات (ROS)", "أنظمة التحكم الدقيق", "الرؤية الحاسوبية", "معايير الأجهزة الطبية"],
    universities: ["جامعة الملك عبدالعزيز", "جامعة الملك سعود", "جامعة الفيصل", "جامعة الملك عبدالله للعلوم والتقنية (كاوست)"],
  },
};
// إحصاءات استرشادية لكل مسار: وظائف ورواتب متوقعة (ريال/شهرياً)، الشركات
// الأنسب، وتوزيع الطلب على المناطق بحلول 2030. أرقام تقديرية تقريبية
// لأغراض تعليمية وإرشادية (تُعرض مع تنويه بذلك أسفل القسم).
const CAREER_STATS = {
  artificial_intelligence: {
    jobs: [
      { title: "عالم بيانات", now: "18,000 – 26,000", future: "22,000 – 32,000", demand: 2 },
      { title: "مهندس ذكاء اصطناعي", now: "17,000 – 27,000", future: "20,000 – 30,000", demand: 2 },
      { title: "محلل بيانات أول", now: "13,000 – 21,000", future: "16,000 – 25,000", demand: 1 },
      { title: "مهندس تعلم آلي", now: "16,000 – 25,000", future: "19,000 – 29,000", demand: 1 },
    ],
    companies: ["NEOM Tech", "Aramco Digital", "STC", "سدايا SDAIA", "IBM", "Google Cloud KSA"],
    regions: [
      { name: "الرياض", pct: 34 },
      { name: "جدة", pct: 22 },
      { name: "الشرقية", pct: 18 },
      { name: "مكة المكرمة", pct: 12 },
      { name: "المدينة المنورة", pct: 7 },
      { name: "أخرى", pct: 7 },
    ],
  },
  renewable_energy: {
    jobs: [
      { title: "مهندس شبكات ذكية", now: "16,000 – 24,000", future: "20,000 – 30,000", demand: 2 },
      { title: "مهندس طاقة شمسية", now: "14,000 – 22,000", future: "18,000 – 27,000", demand: 2 },
      { title: "مهندس طاقة رياح", now: "15,000 – 23,000", future: "18,000 – 28,000", demand: 1 },
      { title: "محلل استدامة", now: "12,000 – 19,000", future: "15,000 – 23,000", demand: 1 },
    ],
    companies: ["ACWA Power", "NEOM (إينوا)", "أرامكو السعودية", "السعودية للكهرباء", "Desert Technologies", "مرافق"],
    regions: [
      { name: "الشرقية", pct: 28 },
      { name: "الرياض", pct: 24 },
      { name: "تبوك (نيوم)", pct: 20 },
      { name: "مكة المكرمة", pct: 12 },
      { name: "المدينة المنورة", pct: 8 },
      { name: "أخرى", pct: 8 },
    ],
  },
  surgical_robotics: {
    jobs: [
      { title: "أخصائي روبوتات جراحية", now: "16,000 – 25,000", future: "20,000 – 30,000", demand: 2 },
      { title: "مطور برمجيات طبية", now: "15,000 – 23,000", future: "18,000 – 28,000", demand: 2 },
      { title: "مهندس أجهزة طبية", now: "13,000 – 20,000", future: "16,000 – 24,000", demand: 1 },
      { title: "مهندس طبي حيوي", now: "12,000 – 19,000", future: "15,000 – 23,000", demand: 1 },
    ],
    companies: ["مستشفى الملك فيصل التخصصي", "مدينة الملك فهد الطبية", "صحة الافتراضية", "Medtronic KSA", "Philips Healthcare", "GE HealthCare"],
    regions: [
      { name: "الرياض", pct: 36 },
      { name: "جدة", pct: 20 },
      { name: "الشرقية", pct: 16 },
      { name: "مكة المكرمة", pct: 12 },
      { name: "عسير", pct: 8 },
      { name: "أخرى", pct: 8 },
    ],
  },
};

const KEY_TO_ID = { re: "renewable_energy", ai: "artificial_intelligence", sr: "surgical_robotics" };

/** يحسب نسب التوافق المئوية المرتبة من إجابات موزونة (منطق البوصلة). */
function computeCompassMatches(pickedOptions) {
  const raw = { re: 0, ai: 0, sr: 0 };
  pickedOptions.forEach((opt) => {
    Object.entries(opt.w || {}).forEach(([k, v]) => (raw[k] += v));
  });
  const total = raw.re + raw.ai + raw.sr || 1;
  return Object.entries(raw)
    .map(([k, v]) => ({
      id: KEY_TO_ID[k],
      title: CAREER_INFO[KEY_TO_ID[k]].title,
      percent: Math.round((v / total) * 100),
      score: v,
    }))
    .sort((a, b) => b.score - a.score);
}

// الحالة الداخلية لجلسة الاختبار الحالية.
const state = {
  currentQuestionIndex: 0,
  answers: [],        // نصوص الإجابات (تُرسل للخادم كما كان)
  pickedOptions: [],  // الخيارات الكاملة بأوزانها (لحساب نسب التوافق)
  isOpen: false,
  onRecommendation: null, // دالة رد نداء تُضبط من script.js
};

// مراجع عناصر DOM (تُجلب مرة واحدة عند التهيئة).
let elPanel, elText, elOptions, elModeBadge, elCloseBtn, elReopenBtn;
let elChatRow, elChatInput, elChatSendBtn, elSpeakBtn;

function cacheDom() {
  elPanel = document.getElementById("aria-panel");
  elText = document.getElementById("aria-text");
  elOptions = document.getElementById("aria-options");
  elModeBadge = document.getElementById("aria-mode-badge");
  elCloseBtn = document.getElementById("aria-close-btn");
  elReopenBtn = document.getElementById("aria-reopen-btn");
  elChatRow = document.getElementById("aria-chat-input-row");
  elChatInput = document.getElementById("aria-chat-input");
  elChatSendBtn = document.getElementById("aria-chat-send-btn");
  elSpeakBtn = document.getElementById("aria-speak-btn");
}

// آخر إجابة معروضة من سعود (لقراءتها صوتياً بزر 🔊 في رأس اللوحة).
let lastSpokenAnswer = "";

/** يسجّل نصاً كإجابة قابلة للقراءة الصوتية ويُظهر زر 🔊. */
function setSpeakableAnswer(text) {
  lastSpokenAnswer = text || "";
  if (elSpeakBtn) elSpeakBtn.hidden = !lastSpokenAnswer;
}

/** حركة "الكتابة الحية" لنص فقاعة حوار سعود. */
/**
 * يضبط صنف body.modal-open حسب وجود أي نافذة مفتوحة فعلاً — لا يزيله
 * إن كانت نافذة أخرى ما تزال مفتوحة (يمنع عودة الضبابية أثناء تراكبها).
 */
function syncModalOpen() {
  const anyOpen = Array.from(document.querySelectorAll(".modal")).some(
    (modal) => !modal.classList.contains("hidden")
  );
  document.body.classList.toggle("modal-open", anyOpen);
}

/**
 * ينظّف أي نص قبل عرضه: يزيل المحارف من كتابات لا علاقة لها بالمحتوى
 * (صينية/يابانية/كورية/سيريلية...) التي تُنتجها النماذج اللغوية أحياناً
 * كرموز شاردة، ويزيل المحارف البديلة اليتيمة ومحارف التحكم.
 *
 * القائمة بيضاء (whitelist) لا سوداء — أكثر أماناً: نُبقي فقط ما يُتوقع
 * ظهوره في هذا المشروع: العربية بكل نطاقاتها، اللاتينية (مصطلحات تقنية)،
 * الأرقام، علامات الترقيم العربية واللاتينية، المسافات، الرموز التعبيرية،
 * والأسهم/العلامات المستخدمة في الواجهة.
 */
function sanitizeArabicText(text) {
  if (!text) return "";
  const graphemes = Array.from(String(text)); // بنقاط الترميز (يحفظ الإيموجي)
  const kept = graphemes.filter((ch) => {
    const code = ch.codePointAt(0);
    // محارف تحكم (نُبقي السطر الجديد والمسافة الأفقية)
    if (code < 0x20) return ch === "\n" || ch === "\t";
    if (code === 0x7f) return false;
    // محارف بديلة يتيمة أو محرف الاستبدال
    if (code >= 0xd800 && code <= 0xdfff) return false;
    if (code === 0xfffd) return false;
    // اللاتينية الأساسية والممتدة + الأرقام + الترقيم
    if (code <= 0x024f) return true;
    // علامات الترقيم العامة والأسهم والرموز الرياضية والعلامات (✓ ✕ → …)
    if (code >= 0x2000 && code <= 0x2bff) return true;
    // العربية: الأساسي، الملحق، الممتد، أشكال العرض أ/ب
    if (code >= 0x0600 && code <= 0x06ff) return true;
    if (code >= 0x0750 && code <= 0x077f) return true;
    if (code >= 0x08a0 && code <= 0x08ff) return true;
    if (code >= 0xfb50 && code <= 0xfdff) return true;
    if (code >= 0xfe70 && code <= 0xfeff) return true;
    // الرموز التعبيرية (إيموجي) وملحقاتها
    if (code >= 0x1f000 && code <= 0x1faff) return true;
    if (code === 0x200d || code === 0xfe0f || code === 0x20e3) return true; // وصل/تنويع
    // ما عدا ذلك (CJK، كانا، هانغول، سيريلية، أشكال العرض الكاملة...) يُزال
    return false;
  });
  // تنظيف المسافات المزدوجة الناتجة عن الإزالة
  return kept.join("").replace(/[ \t]{2,}/g, " ").trim();
}

/**
 * يقسّم النص إلى «عناقيد محارف» (grapheme clusters) لا إلى وحدات UTF-16.
 *
 * سبب الإصلاح: charAt/[i] تقطع النص بوحدات UTF-16، والإيموجي (🧭 🚀 💼 …)
 * يتكوّن من وحدتين (زوج بديل - surrogate pair). عند عرض نصفه فقط أثناء
 * الكتابة الحية ينتج محرف بديل يتيم، فيلجأ المتصفح إلى خط احتياطي ويعرض
 * رمزاً غريباً (يظهر أحياناً كمحرف صيني أو مربع) في وسط النص العربي —
 * وهو تفسير «المحارف الأجنبية العشوائية» التي تظهر ثم تختفي.
 * كما أن التقطيع بالعناقيد يُبقي التشكيل العربي ملتصقاً بحرفه الأصلي.
 */
function splitGraphemes(text) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    try {
      const segmenter = new Intl.Segmenter("ar", { granularity: "grapheme" });
      return Array.from(segmenter.segment(text), (segment) => segment.segment);
    } catch (error) {
      /* المتصفحات القديمة: نكمل بالبديل أدناه */
    }
  }
  return Array.from(text); // Array.from تقسم بنقاط الترميز لا بوحدات UTF-16
}

// مؤقّت الكتابة الجاري ودالة إلغائه — عنصر الحوار واحد، فلا يجوز أن
// تكتب فيه عمليتان معاً.
let cancelTyping = null;

/**
 * يعرض نصاً بالكتابة الحية داخل فقاعة حوار «سعود».
 *
 * إصلاح جوهري: كانت كل استدعاءة تُنشئ مؤقّتاً مستقلاً يضيف محرفاً إلى
 * نفس العنصر (‎+=‎). فإذا انطلقت عمليتان في وقت واحد — مثل رسالة ترحيب
 * الاختبار مع رد المحادثة — تتناوب المؤقّتات على الإضافة فيتشابك النصان
 * حرفاً بحرف وينتج كلام غير مفهوم. الآن: أي كتابة جديدة تُلغي السابقة
 * فوراً، ويعود وعدها بـ false ليتوقف مسارها القديم بدل أن يستمر.
 *
 * @returns {Promise<boolean>} true إن اكتملت الكتابة، false إن أُلغيت.
 */
function typeText(fullText, speedMs = 18) {
  if (cancelTyping) cancelTyping(); // أنهِ أي كتابة جارية قبل البدء
  return new Promise((resolve) => {
    const clean = sanitizeArabicText(fullText);
    const graphemes = splitGraphemes(clean);
    elText.textContent = "";
    let i = 0;
    let interval = null;

    cancelTyping = () => {
      if (interval) clearInterval(interval);
      cancelTyping = null;
      resolve(false); // أُلغيت: المسار المستدعي يجب أن يتوقف
    };

    interval = setInterval(() => {
      // إضافة عنقود كامل في كل مرة (لا نصف محرف أبداً)
      elText.textContent += graphemes[i];
      i++;
      if (i >= graphemes.length) {
        clearInterval(interval);
        cancelTyping = null;
        resolve(true);
      }
    }, speedMs);
  });
}

/** يعرض أزرار خيارات الإجابة ويربطها بمعالجات النقر. */
function renderOptions(options, onPick) {
  elOptions.innerHTML = "";
  options.forEach((optionLabel) => {
    const btn = document.createElement("button");
    btn.className = "aria-option-btn";
    btn.textContent = optionLabel;
    btn.addEventListener("click", () => onPick(optionLabel));
    elOptions.appendChild(btn);
  });
}

/** شريط تقدم البوصلة أعلى الخيارات. */
function renderProgress() {
  const wrap = document.createElement("div");
  wrap.className = "compass-progress";
  const fill = document.createElement("div");
  fill.className = "compass-progress-fill";
  fill.style.width = `${Math.round((state.currentQuestionIndex / QUESTIONS.length) * 100)}%`;
  wrap.appendChild(fill);
  elOptions.appendChild(wrap);
}

/** يبدأ «البوصلة المهنية» بشاشة ترحيب ثم الأسئلة. */
async function startQuiz() {
  state.currentQuestionIndex = 0;
  state.answers = [];
  state.pickedOptions = [];

  elOptions.innerHTML = "";
  // إن ألغت رسالةٌ أحدث هذه الكتابة، نتوقف فوراً ولا نضيف أزراراً فوق
  // محتوى لم يعد يخصّنا (هذا ما كان ينتج تشابك النصوص والأزرار).
  if (!(await typeText(
    "🧭 أهلاً بك في «البوصلة المهنية»! سأطرح عليك ثمانية أسئلة قصيرة عن اهتماماتك ونقاط قوتك وقيمك، " +
      "ثم أحسب نسبة توافقك مع كل مسار من مسارات المعرض الثلاثة، وأقدّم لك توصية مفصلة بالتخصصات والمهارات والجامعات السعودية المناسبة."
  ))) return;
  const startBtn = document.createElement("button");
  startBtn.className = "aria-option-btn compass-start-btn";
  startBtn.textContent = "🚀 ابدأ البوصلة المهنية";
  startBtn.addEventListener("click", showQuestion);
  elOptions.appendChild(startBtn);
}

async function showQuestion() {
  const q = QUESTIONS[state.currentQuestionIndex];
  if (!q) {
    await finishQuiz();
    return;
  }
  elOptions.innerHTML = "";
  renderProgress();
  if (!(await typeText(`السؤال ${state.currentQuestionIndex + 1} من ${QUESTIONS.length}: ${q.text}`))) return;
  q.options.forEach((option) => {
    const btn = document.createElement("button");
    btn.className = "aria-option-btn";
    btn.textContent = option.label;
    btn.addEventListener("click", () => handleAnswer(option));
    elOptions.appendChild(btn);
  });
}

function handleAnswer(option) {
  state.answers.push(option.label);
  state.pickedOptions.push(option);
  state.currentQuestionIndex += 1;
  showQuestion();
}

/**
 * ينهي البوصلة: يحسب نسب التوافق محلياً (منطق حتمي شفاف)، ويطلب من
 * المزود المتصل (Groq) تفسيراً لغوياً مخصصاً، ثم يعرض النتائج
 * مرتبة بنسب مئوية داخل اللوحة وفي نافذة التوصية الكاملة.
 */
async function finishQuiz() {
  elOptions.innerHTML = "";
  if (!(await typeText("رائع! أحسب الآن نسب توافقك مع المسارات الثلاثة..."))) return;

  // 1) الترتيب والنسب: حساب محلي حتمي (لا يعتمد على الشبكة إطلاقاً)
  const matches = computeCompassMatches(state.pickedOptions);
  const top = matches[0];
  const info = CAREER_INFO[top.id];

  const localReasoning =
    `بحسب إجاباتك، مسار «${info.title}» هو الأعلى توافقاً معك بنسبة ${top.percent}٪، ` +
    `يليه «${matches[1].title}» (${matches[1].percent}٪) ثم «${matches[2].title}» (${matches[2].percent}٪). ` +
    `اهتماماتك ونقاط قوتك التي اخترتها تتقاطع مباشرة مع طبيعة العمل اليومي في هذا المجال.`;

  // 2) تفسير المزود المتصل (اختياري): يُستخدم فقط إذا اتفق مع الترتيب المحلي
  let reasoning = localReasoning;
  let mode = "offline";
  let result_provider = null;
  try {
    const response = await fetch(`${API_BASE}/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: state.answers }),
    });
    if (response.ok) {
      const server = await response.json();
      if (server.mode === "online") {
        mode = "online";
        result_provider = server.provider || "Groq";
        if (server.recommended_career_id === top.id && server.reasoning) {
          reasoning = sanitizeArabicText(server.reasoning);
        }
      }
    }
  } catch (err) {
    console.warn("[career_ai.js] تعذر الوصول إلى الخادم — النتيجة محلية بالكامل:", err);
  }

  const result = {
    recommended_career: info.title,
    recommended_career_id: top.id,
    reasoning,
    suggested_majors: info.majors,
    useful_skills: info.skills,
    universities: info.universities,
    matches,
    mode,
    provider: result_provider,
  };

  elModeBadge.textContent = mode === "online" ? `الوضع المتصل (${result_provider || "Groq"})` : "الوضع المحلي";
  setSpeakableAnswer(reasoning);
  if (!(await typeText(reasoning))) return;

  // 3) أعمدة نسب التوافق داخل اللوحة (بصمة تجربة البوصلة)
  const bars = document.createElement("div");
  bars.className = "compass-results";
  matches.forEach((m, i) => {
    const row = document.createElement("div");
    row.className = "compass-bar-row" + (i === 0 ? " is-top" : "");
    row.innerHTML =
      `<span class="compass-bar-label">${m.title}</span>` +
      `<span class="compass-bar-track"><span class="compass-bar-fill" style="width:${m.percent}%"></span></span>` +
      `<span class="compass-bar-value">${m.percent}٪</span>`;
    bars.appendChild(row);
  });
  elOptions.appendChild(bars);

  const goBtn = document.createElement("button");
  goBtn.className = "aria-option-btn";
  goBtn.textContent = `اذهب إلى غرفة ${info.title} ←`;
  goBtn.addEventListener("click", () => {
    if (typeof state.onRecommendation === "function") state.onRecommendation(result);
  });
  const retryBtn = document.createElement("button");
  retryBtn.className = "aria-option-btn";
  retryBtn.textContent = "🔄 أعد البوصلة";
  retryBtn.addEventListener("click", startQuiz);
  elOptions.appendChild(goBtn);
  elOptions.appendChild(retryBtn);

  showRecommendationModal(result);
}

/** يملأ نافذة التوصية الكاملة ويعرضها. */
function showRecommendationModal(result) {
  document.getElementById("rec-title").textContent = result.recommended_career;
  document.getElementById("rec-reasoning").textContent = result.reasoning;

  const majorsList = document.getElementById("rec-majors");
  majorsList.innerHTML = "";
  (result.suggested_majors || []).forEach((m) => {
    const li = document.createElement("li");
    li.textContent = m;
    majorsList.appendChild(li);
  });

  const skillsList = document.getElementById("rec-skills");
  skillsList.innerHTML = "";
  (result.useful_skills || []).forEach((s) => {
    const li = document.createElement("li");
    li.textContent = s;
    skillsList.appendChild(li);
  });

  const universitiesList = document.getElementById("rec-universities");
  if (universitiesList) {
    universitiesList.innerHTML = "";
    (result.universities || []).forEach((u) => {
      const li = document.createElement("li");
      li.textContent = u;
      universitiesList.appendChild(li);
    });
  }

  const matchesBox = document.getElementById("rec-matches");
  if (matchesBox) {
    matchesBox.innerHTML = "";
    (result.matches || []).forEach((m, i) => {
      const row = document.createElement("div");
      row.className = "compass-bar-row" + (i === 0 ? " is-top" : "");
      row.innerHTML =
        `<span class="compass-bar-label">${m.title}</span>` +
        `<span class="compass-bar-track"><span class="compass-bar-fill" style="width:${m.percent}%"></span></span>` +
        `<span class="compass-bar-value">${m.percent}٪</span>`;
      matchesBox.appendChild(row);
    });
  }

  // قسم الإحصاءات (وظائف ورواتب + شركات + مناطق) للمسار الموصى به.
  const statsBox = document.getElementById("rec-stats");
  if (statsBox) {
    const stats = CAREER_STATS[result.recommended_career_id];
    statsBox.innerHTML = "";
    if (stats) {
      const demandPill = (level) =>
        level === 2
          ? '<span class="stat-pill stat-pill-hot">مرتفع جدًا ↑</span>'
          : '<span class="stat-pill">مرتفع ↑</span>';

      const jobsRows = stats.jobs
        .map(
          (job) => `
          <div class="stat-row">
            <span class="stat-job">${job.title}</span>
            <span class="stat-salary">${job.now}</span>
            <span class="stat-salary">${job.future}</span>
            <span class="stat-demand">${demandPill(job.demand)}</span>
          </div>`
        )
        .join("");

      const companyChips = stats.companies
        .map((company) => `<span class="stat-chip">${company}</span>`)
        .join("");

      const regionRows = stats.regions
        .map(
          (region) => `
          <div class="stat-region">
            <div class="stat-region-head"><span>${region.name}</span><b>${region.pct}%</b></div>
            <div class="stat-region-track"><span style="width:${region.pct * 2.5}%"></span></div>
          </div>`
        )
        .join("");

      statsBox.innerHTML = `
        <div class="stat-card stat-card-wide">
          <h3>💼 الوظائف المتوقعة والرواتب</h3>
          <div class="stat-row stat-head">
            <span class="stat-job">الوظيفة</span>
            <span class="stat-salary">الراتب الحالي (ريال)</span>
            <span class="stat-salary">راتب 2030 (متوقع)</span>
            <span class="stat-demand">مستوى الطلب</span>
          </div>
          ${jobsRows}
        </div>
        <div class="stat-grid">
          <div class="stat-card">
            <h3>📍 المناطق الأعلى طلبًا (2030)</h3>
            ${regionRows}
            <div class="stat-footnote">أعلى تركيز للفرص في: <b>${stats.regions[0].name}</b></div>
          </div>
          <div class="stat-card">
            <h3>🏢 الشركات الأنسب لك</h3>
            <div class="stat-chips">${companyChips}</div>
          </div>
        </div>
        <div class="stat-disclaimer">أرقام استرشادية تقريبية لأغراض تعليمية — تختلف الرواتب الفعلية حسب الخبرة وجهة العمل.</div>`;
    }
  }

  const modal = document.getElementById("recommendation-modal");
  modal.classList.remove("hidden");
  syncModalOpen(); // يوقف تراكم طبقات الضبابية

  document.getElementById("rec-goto-room-btn").onclick = () => {
    modal.classList.add("hidden");
    syncModalOpen();
    if (typeof state.onRecommendation === "function") {
      state.onRecommendation(result);
    }
  };
  document.getElementById("rec-explore-btn").onclick = () => {
    modal.classList.add("hidden");
    syncModalOpen();
  };
}

/** يرسل رسالة حرة إلى نقطة ‎/chat‎ الخاصة بسعود (للأسئلة داخل الغرف). */
async function askAria(message, history = []) {
  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
    });
    if (!response.ok) throw new Error(`استجاب الخادم بالرمز ${response.status}`);
    return await response.json();
  } catch (err) {
    console.warn("[career_ai.js] تعذر الوصول إلى /chat:", err);
    return { reply: "تعذر الوصول إلى قاعدة معارفي حالياً، لكن لا تتردد في مواصلة الاستكشاف!", mode: "offline" };
  }
}

/** يفتح لوحة سعود ويبدأ الاختبار. */
function openAria() {
  state.isOpen = true;
  elPanel.classList.remove("hidden");
  elReopenBtn.classList.add("hidden");
  elChatRow.classList.add("hidden");
  elOptions.classList.remove("hidden");
  startQuiz();
}

function closeAria() {
  state.isOpen = false;
  elPanel.classList.add("hidden");
  elReopenBtn.classList.remove("hidden");
}

/**
 * يفتح لوحة سعود في وضع "محادثة حرة" (بدل الاختبار المتسلسل) — يُستدعى
 * عند نقر الزائر على المرافق الروبوتي ثلاثي الأبعاد «سعود» في المشهد.
 * يعرض صندوق إدخال نصي حر بدل أزرار الاختيارات.
 */
let chatHistory = [];
async function openAriaChat(greeting) {
  state.isOpen = true;
  elPanel.classList.remove("hidden");
  elReopenBtn.classList.add("hidden");
  elOptions.innerHTML = "";
  elOptions.classList.add("hidden");
  elChatRow.classList.remove("hidden");
  chatHistory = [];
  // هذه الرسالة هي أحد طرفَي التشابك الذي كان يحدث: فتح محادثة «سعود»
  // أثناء انطلاق رسالة البوصلة (أو العكس). الحارس يمنع استمرار المسار
  // القديم بعد أن تتولّى رسالة أحدث عنصر الحوار.
  if (!(await typeText(
    greeting ||
      "أهلاً بك مجدداً! أنا «سعود». اسألني عن أي معروض، تخصص هندسي، أو أي موضوع تعليمي تريد معرفة المزيد عنه."
  ))) return;
  elChatInput.value = "";
  elChatInput.focus();
}

async function sendChatMessage() {
  const message = elChatInput.value.trim();
  if (!message) return;
  elChatInput.value = "";
  elChatInput.disabled = true;
  elChatSendBtn.disabled = true;
  try {
    await typeText("...", 60);
    const result = await askAria(message, chatHistory);
    chatHistory.push({ role: "user", content: message });
    chatHistory.push({ role: "assistant", content: result.reply });
    elModeBadge.textContent = result.mode === "online" ? `الوضع المتصل (${result.provider || "Groq"})` : "الوضع المحلي";
    result.reply = sanitizeArabicText(result.reply);
    setSpeakableAnswer(result.reply);
    await typeText(result.reply);
  } finally {
    // مهم: استعادة حالة الإدخال في كل الأحوال — حتى لو أُلغيت الكتابة أو
    // فشل الطلب — حتى لا يبقى حقل الكتابة معطّلاً إلى الأبد.
    elChatInput.disabled = false;
    elChatSendBtn.disabled = false;
    elChatInput.focus();
  }
}

/** المُهيئ العام — يُستدعى مرة واحدة من script.js بعد جاهزية DOM. */
function initCareerAI({ onRecommendation } = {}) {
  cacheDom();
  state.onRecommendation = onRecommendation;

  elCloseBtn.addEventListener("click", closeAria);
  if (elSpeakBtn) {
    elSpeakBtn.addEventListener("click", () => {
      if (!lastSpokenAnswer) return;
      // نفس خط أنابيب الصوت في المعرض: صوت Groq الطبيعي ثم صوت المتصفح.
      const voice = window.ExhibitVoice;
      if (voice) {
        const started = voice.toggle(lastSpokenAnswer);
        elSpeakBtn.textContent = started ? "⏹" : "🔊";
        if (started) {
          // إعادة الأيقونة عند انتهاء التشغيل تلقائياً.
          const watcher = setInterval(() => {
            if (!voice.isPlaying()) {
              elSpeakBtn.textContent = "🔊";
              clearInterval(watcher);
            }
          }, 500);
        }
      }
    });
  }
  elReopenBtn.addEventListener("click", openAria);
  elChatSendBtn.addEventListener("click", sendChatMessage);
  elChatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChatMessage();
  });
}

// كشف واجهة برمجية صغيرة ليستخدمها script.js
window.CareerAI = {
  init: initCareerAI,
  open: openAria,
  close: closeAria,
  ask: askAria,
  isOpen: () => state.isOpen,
  openChat: openAriaChat,
};
