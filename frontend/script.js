/**
 * script.js
 * ---------
 * تطبيق Three.js الأساسي لمشروع «Fututor VR».
 *
 * المسؤوليات:
 *   - تسلسل الإقلاع (شاشة تحميل -> شاشة بدء -> دخول المبنى)
 *   - بناء البهو المستقبلي، 3 ممرات، و3 غرف مهنية:
 *       1) هندسة الطاقة المتجددة   2) الذكاء الاصطناعي   3) الروبوتات الجراحية
 *   - حركة الشخص الأول (WASD) + النظر بالفأرة (Pointer Lock) + التصادم
 *   - التفاعل بالنقر مع المعروضات عبر Raycasting (نقر -> نافذة معلومات)
 *   - جلب بيانات المهن من خادم Flask ‎(/careers)‎ مع بيانات احتياطية مدمجة
 *     حتى يعمل المشهد إذا لم يكن الخادم مشغّلاً.
 *   - تحميل نماذج GLB الحقيقية تلقائياً عبر نظام إدارة الأصول (assets.js):
 *     يُعرض شكل بديل فوراً، وعند اكتمال تحميل النموذج يحل محله؛ وإذا فشل
 *     التحميل يبقى البديل ويُطبع تحذير في وحدة التحكم ويستمر تحميل الباقي.
 */

import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
// نظام إدارة الأصول: سجل النماذج والصور + دوال التحميل والتطبيع
import {
  MODEL_MANIFEST,
  PERSPECTIVE_ICON_MODEL,
  ARIA_COMPANION_MODEL,
  OBJECT_IMAGES,
  OBJECT_GALLERIES,
  commonsImage,
  ROOM_POSTERS,
  loadModel,
  normalizeModel,
  loadTexture,
} from "./assets.js";
// وضع الواقع الافتراضي (WebXR) — طبقة إضافية لا تمسّ تجربة سطح المكتب.
// ?v= يكسر ذاكرة متصفح Quest المؤقتة حتى لا يُحمَّل إصدار قديم من vr.js.
import { initVR } from "./vr.js?v=20260922";
// أداة دمج الهندسات الثابتة (تقليل عدد نداءات الرسم) — من حزمة three الرسمية.
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// -----------------------------------------------------------------------
// 0. الثوابت وتخطيط العالم
// -----------------------------------------------------------------------
const API_BASE = ""; // نفس الأصل — انظر ملاحظات career_ai.js

// هل الجهاز لمسي؟ (جوال/لوحي/متصفح النظارة) — يُستخدم لتعطيل قفل مؤشر
// الفأرة الذي لا وجود له على هذه الأجهزة، وتفعيل أدوات التحكم باللمس.
const IS_TOUCH_DEVICE =
  typeof window !== "undefined" &&
  ("ontouchstart" in window || (navigator.maxTouchPoints || 0) > 0);

// ثيم "Galaxy Blue" — الأرضيات والجدران بدرجات أزرق مجرّي موحّدة في كل
// أنحاء المعرض، مع الحفاظ على ألوان النيون المميزة لكل غرفة (للتوجيه فقط).
const COLORS = {
  floor: 0x0a1636, // أزرق مجرّي عميق (بدلاً من الرمادي الداكن السابق)
  floorAccent: 0x1c3f8f, // لمعان أزرق إضافي على الحواف العاكسة
  wallGlass: 0x3f7dff, // زجاج بلون أزرق مجرّي ساطع (بدلاً من السماوي الفاتح)
  neon: 0x3ea6ff,
  renewable: 0x38d39f,
  ai: 0x7c8cff,
  surgical: 0x36e0c8, // (تاريخي — يُستخدم في بيانات البوصلة فقط)
  eeStudent: 0x38d39f, // غرفة «الهندسة الكهربائية كطالب»: نفس ثيم/لون غرفة الطاقة المتجددة (بطلب المستخدم)
};

// مستطيلات محاذية للمحاور (في مستوى XZ) تحدد أين يستطيع الزائر المشي.
// الصيغة: { minX, maxX, minZ, maxZ }
const WALKABLE_REGIONS = [
  // مُحدَّثة بعد التوسعة والإغلاق (كانت سبب «الجدران غير المرئية»):
  //  • غرفة الطاقة المتجددة على أبعادها الموسّعة الحقيقية (26×46).
  //  • أُزيلت مناطق غرفة الذكاء وممرّها الشرقي نهائياً (لا مشي نحو الفراغ).
  //  • الممر الشمالي يقود الآن لغرفة «الهندسة الكهربائية كطالب».
  { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }, // البهو
  { minX: -30, maxX: -10, minZ: -3, maxZ: 3 }, // ممر -> الطاقة المتجددة (غرب)
  { minX: -52.4, maxX: -27.6, minZ: -22.4, maxZ: 22.4 }, // غرفة الطاقة المتجددة (موسّعة)
  { minX: -3, maxX: 3, minZ: -30.5, maxZ: -10 }, // ممر -> الهندسة الكهربائية (شمال)
  // مهم: منطقة الغرفة تتداخل مع منطقة الممر (كان بينهما شريط ميت 0.6م
  // يجعل عبور الباب مستحيلاً مع هامش التصادم — سبب «لا أستطيع الدخول»)
  { minX: -14.4, maxX: 14.4, minZ: -49.4, maxZ: -29.5 }, // غرفة الهندسة الكهربائية كطالب
];

// أسماء المناطق المعروضة في شريط الواجهة (HUD) — كلها بالعربية.
const ROOM_LABELS = [
  { name: "غرفة هندسة الطاقة المتجددة", minX: -53, maxX: -27, minZ: -23, maxZ: 23 },
  { name: "غرفة الهندسة الكهربائية كطالب", minX: -15, maxX: 15, minZ: -50, maxZ: -30 },
  { name: "الممر الغربي", minX: -30, maxX: -10, minZ: -3, maxZ: 3 },
  { name: "الممر الشمالي", minX: -3, maxX: 3, minZ: -30, maxZ: -10 },
  { name: "البهو الرئيسي", minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
];

// بيانات احتياطية تُستخدم فقط إذا تعذر الوصول إلى ‎/careers‎.
// نسخة مختصرة تعكس backend/careers.json
const FALLBACK_CAREERS = {
  renewable_energy: {
    title: "هندسة الطاقة المتجددة",
    future_perspective: {
      title: "مستقبل الطاقة المتجددة",
      points: [
        "تستهدف رؤية السعودية 2030 توليد نحو نصف كهرباء المملكة من مصادر متجددة.",
        "مشروع الهيدروجين الأخضر في نيوم من الأكبر عالمياً.",
        "محطات الطاقة الشمسية وطاقة الرياح واسعة النطاق تتوسع بسرعة في المملكة.",
      ],
    },
    objects: {
      solar_panel: { name: "اللوح الشمسي", purpose: "يحوّل ضوء الشمس إلى كهرباء.", how_it_works: "الخلايا الكهروضوئية تحرر الإلكترونات عند اصطدام الفوتونات بها.", applications: "محطات الطاقة الشمسية وأسطح المنازل والمنشآت.", future: "خلايا البيروفسكايت ترفع الكفاءة إلى مستويات أعلى.", careers: ["مهندس أنظمة شمسية", "مصمم أنظمة كهروضوئية"] },
      wind_turbine: { name: "توربين الرياح", purpose: "يحوّل حركة الرياح إلى كهرباء.", how_it_works: "الشفرات تدير مولداً عبر دوّار وصندوق تروس.", applications: "مزارع الرياح البرية والبحرية.", future: "التوربينات البحرية العائمة تفتح مواقع جديدة.", careers: ["فني توربينات رياح", "مهندس ميكانيكي"] },
      battery_storage: { name: "وحدة تخزين البطاريات", purpose: "تخزّن فائض الطاقة.", how_it_works: "خلايا كيميائية تخزن الطاقة وتطلقها عند الطلب.", applications: "استقرار الشبكات الكهربائية ومحطات الشحن.", future: "بطاريات الحالة الصلبة تخفض التكاليف.", careers: ["مهندس أنظمة بطاريات", "محلل تخزين طاقة"] },
    },
    saudi_universities: [
      { name: "جامعة الملك فهد للبترول والمعادن (KFUPM)", college: "كلية الهندسة الكهربائية والحاسوبية", why: "من الأقوى إقليمياً في هندسة القدرة والطاقة المتجددة." },
      { name: "جامعة الملك سعود (KSU)", college: "قسم الهندسة الكهربائية", why: "برنامج راسخ في هندسة القدرة والطاقة المتجددة." },
      { name: "جامعة الملك عبدالله للعلوم والتقنية (KAUST)", college: "برامج الطاقة المستدامة", why: "أبحاث متقدمة في الطاقة الشمسية والمواد شبه الموصلة." },
    ],
  },
  artificial_intelligence: {
    title: "الذكاء الاصطناعي",
    future_perspective: {
      title: "مستقبل مهن الذكاء الاصطناعي",
      points: [
        "الوظائف المرتبطة بالذكاء الاصطناعي تنمو في كل الصناعات تقريباً.",
        "الذكاء الاصطناعي التوليدي يعيد تشكيل صناعة المحتوى والبرمجة والتصميم.",
        "الذكاء الاصطناعي الصحي والصناعي من أهم مجالات النمو.",
      ],
    },
    objects: {
      robot: { name: "الروبوت", purpose: "يعرض الذكاء الاصطناعي المتجسد.", how_it_works: "حساسات تغذي نماذج ذكية تُصدر أوامر حركية.", applications: "المستودعات والمصانع والخدمات.", future: "الروبوتات البشرية تدخل أماكن العمل الحقيقية.", careers: ["مهندس روبوتات", "مهندس أنظمة تحكم"] },
      gpu_server: { name: "خادم معالجات الرسوميات", purpose: "يشغّل تدريب التعلم العميق.", how_it_works: "أنوية متوازية تسرّع عمليات المصفوفات.", applications: "مراكز البيانات ومنصات الحوسبة السحابية.", future: "شرائح ذكاء اصطناعي متخصصة تكمّل المعالجات الرسومية.", careers: ["مهندس بنية تحتية لتعلم الآلة"] },
      neural_network: { name: "الشبكة العصبية", purpose: "تعالج البيانات عبر طبقات متعلمة.", how_it_works: "اتصالات موزونة تستخرج سمات مجردة.", applications: "التعرف على الصور والكلام والترجمة.", future: "معماريات المحولات تتطور باستمرار.", careers: ["باحث تعلم عميق"] },
    },
    saudi_universities: [
      { name: "جامعة الملك عبدالله للعلوم والتقنية (KAUST)", college: "كلية الحاسوب والذكاء الاصطناعي", why: "مركز أبحاث ذكاء اصطناعي عالمي المستوى." },
      { name: "جامعة الملك سعود (KSU)", college: "كلية علوم الحاسب والمعلومات", why: "مسارات متخصصة في الذكاء الاصطناعي وتعلم الآلة." },
      { name: "جامعة الأميرة نورة بنت عبدالرحمن", college: "كلية علوم الحاسب والمعلومات", why: "برنامج قوي في الذكاء الاصطناعي وعلوم البيانات." },
    ],
  },
  surgical_robotics: {
    title: "الروبوتات الجراحية",
    future_perspective: {
      title: "مستقبل الروبوتات الجراحية",
      points: [
        "الجراحة بمساعدة الروبوت تجعل العمليات أقل توغلاً وأسرع تعافياً.",
        "الجراحة عن بُعد ستتيح وصول الخبرات الجراحية إلى المناطق النائية.",
        "رؤية السعودية 2030 تستثمر بقوة في الرعاية الصحية الرقمية والتقنيات الطبية.",
      ],
    },
    objects: {
      surgical_robot: { name: "الروبوت الجراحي", purpose: "يساعد الجراحين في العمليات الدقيقة.", how_it_works: "أذرع روبوتية بترشيح للرعشة وتوجيه بالكاميرات.", applications: "جراحات المسالك والقلب والأورام طفيفة التوغل.", future: "توجيه بالذكاء الاصطناعي وخياطة شبه ذاتية.", careers: ["مهندس روبوتات جراحية"] },
      operating_table: { name: "طاولة العمليات", purpose: "منصة متحركة تُوضِّع المريض بدقة.", how_it_works: "محركات كهربائية تضبط الارتفاع والميلان بتزامن مع الروبوت.", applications: "غرف العمليات الحديثة والمؤتمتة.", future: "طاولات ذكية تتكامل مع أنظمة الملاحة الجراحية.", careers: ["مهندس أجهزة طبية"] },
      medical_monitors: { name: "الشاشات الطبية", purpose: "تعرض المؤشرات الحيوية وصور الجراحة لحظياً.", how_it_works: "تجمع بيانات الحساسات والكاميرات في عرض موحد.", applications: "متابعة العمليات والعناية المركزة.", future: "لوحات بذكاء اصطناعي تتنبأ بالمضاعفات مبكراً.", careers: ["مهندس معلوماتية صحية"] },
    },
    saudi_universities: [
      { name: "جامعة الملك فهد للبترول والمعادن (KFUPM)", college: "الهندسة الميكانيكية / الميكاترونكس", why: "برامج قوية في الروبوتات وأنظمة التحكم الدقيقة." },
      { name: "جامعة الملك سعود بن عبدالعزيز للعلوم الصحية", college: "كلية العلوم الصحية التطبيقية", why: "ارتباط مباشر بمستشفيات متقدمة وأنظمة جراحية روبوتية حقيقية." },
      { name: "جامعة الملك عبدالله للعلوم والتقنية (KAUST)", college: "الهندسة الحيوية والروبوتات", why: "أبحاث متقدمة في الروبوتات الطبية والتحكم الدقيق." },
    ],
  },
};

let careerData = FALLBACK_CAREERS;

// -----------------------------------------------------------------------
// 1. مراجع DOM
// -----------------------------------------------------------------------
const loadingScreen = document.getElementById("loading-screen");
const loadingBarFill = document.getElementById("loading-bar-fill");
const loadingStatus = document.getElementById("loading-status");
const startOverlay = document.getElementById("start-overlay");
const startBtn = document.getElementById("start-btn");
const hud = document.getElementById("hud");
const hudRoomLabel = document.getElementById("hud-room-label");
const sceneContainer = document.getElementById("scene-container");
const muteBtn = document.getElementById("mute-btn");
const ariaReopenBtn = document.getElementById("aria-reopen-btn");
const exitRoomBtn = document.getElementById("exit-room-btn");

const sfxAmbient = document.getElementById("sfx-ambient");
const sfxClick = document.getElementById("sfx-click");
const sfxDoor = document.getElementById("sfx-door");

let soundEnabled = true;

/** يشغّل مؤثراً صوتياً بأمان (يتجاهل قيود التشغيل التلقائي والأخطاء). */
function playSfx(el) {
  if (!soundEnabled || !el) return;
  try {
    el.currentTime = 0;
    el.play().catch(() => {
      /* قيود التشغيل التلقائي أو ملف مفقود — آمن للتجاهل */
    });
  } catch (e) {
    /* لا شيء */
  }
}

// -----------------------------------------------------------------------
// 2. تسلسل الإقلاع — شريط تقدم ثم شاشة البدء
// -----------------------------------------------------------------------
function runLoadingSequence() {
  // خطوات التحميل المعروضة للزائر — بالعربية
  const steps = [
    "جارٍ تهيئة المعرض...",
    "جارٍ بناء البهو الرئيسي...",
    "جارٍ إنشاء الغرف المهنية...",
    "جارٍ تحميل النماذج ثلاثية الأبعاد...",
    "جارٍ معايرة المساعد الذكي «سعود»...",
    "جارٍ صقل الزجاج والإضاءة...",
    "اكتمل التجهيز.",
  ];
  let progress = 0;
  let stepIndex = 0;
  loadingStatus.textContent = steps[0];

  const interval = setInterval(() => {
    progress += Math.random() * 18 + 6;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      setTimeout(() => {
        loadingScreen.classList.add("hidden");
        startOverlay.classList.remove("hidden");
      }, 400);
    }
    loadingBarFill.style.width = `${progress}%`;
    stepIndex = Math.min(steps.length - 1, Math.floor((progress / 100) * steps.length));
    loadingStatus.textContent = steps[stepIndex];
  }, 260);
}

// بدء التحميل فور تشغيل الوحدة.
runLoadingSequence();

// جلب بيانات المهن الحقيقية في الخلفية (يتراجع بصمت عند الخطأ).
// جلب بيانات المعروضات: نجرّب واجهة الخادم أولاً (تشغيل محلي بـ Flask)،
// وإن لم تتوفر (استضافة ثابتة مثل GitHub Pages بلا بايثون) نقرأ نفس
// البيانات كاملةً من الملف الثابت frontend/careers.json — فيبقى المحتوى
// التعليمي كاملاً في الحالتين بدل الاكتفاء بالبيانات الاحتياطية المختصرة.
const fetchCareers = () =>
  fetch(`${API_BASE}/careers`).then((response) => {
    if (!response.ok) throw new Error(`careers ${response.status}`);
    return response;
  }).catch(() => fetch("./careers.json"));

fetchCareers()
  .then((res) => {
    if (!res.ok) throw new Error(`الرمز ${res.status}`);
    return res.json();
  })
  .then((data) => {
    careerData = data;
    console.log("[script.js] تم تحميل بيانات المهن من الخادم.");
  })
  .catch((err) => {
    console.warn("[script.js] تعذر تحميل /careers، سيتم استخدام البيانات الاحتياطية:", err);
  });

// -----------------------------------------------------------------------
// 3. إعداد Three.js الأساسي
// -----------------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x03050a);
scene.fog = new THREE.Fog(0x03050a, 15, 90);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 1.7, 6); // ارتفاع عين الزائر ~1.7م، البداية في البهو

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  // يطلب من المتصفح صراحةً استخدام بطاقة الرسوميات عالية الأداء
  // (مهم في الحواسيب المحمولة ذات البطاقتين: مدمجة + منفصلة).
  powerPreference: "high-performance",
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// --- تشخيص بطاقة الرسوميات: هل العرض عتادي أم برمجي (SwiftShader)؟ ---
// إن كان تسريع العتاد معطلاً في المتصفح يتحول WebGL إلى معالج برمجي بطيء
// جداً. نكشف ذلك، نكتب اسم المعالج في الطرفية، ونخفض الإعدادات تلقائياً
// مع تنبيه عربي واضح للزائر بكيفية الإصلاح.
(function detectGPU() {
  try {
    const gl = renderer.getContext();
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const gpuName = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "غير معروف";
    console.log("[GPU] معالج الرسوميات المستخدم:", gpuName);

    const isSoftware = /swiftshader|software|llvmpipe|basic render/i.test(gpuName);
    if (!isSoftware) return;

    console.warn("[GPU] العرض برمجي (بدون بطاقة رسوميات)! فعّل تسريع العتاد في المتصفح.");
    // تخفيض تلقائي ليبقى المعرض قابلاً للاستخدام إلى أن يُصلح الإعداد:
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = false;

    const warning = document.createElement("div");
    warning.id = "gpu-warning";
    warning.dir = "rtl";
    warning.innerHTML =
      "⚠️ <b>المتصفح لا يستخدم بطاقة الرسوميات</b> (عرض برمجي بطيء).<br>" +
      "لإصلاح ذلك: افتح إعدادات المتصفح ← النظام ← فعّل «استخدام تسريع الرسومات عند توفره» ثم أعد تشغيل المتصفح. " +
      "وفي ويندوز: الإعدادات ← النظام ← شاشة العرض ← الرسومات ← أضف المتصفح واختر «أداء عالٍ».";
    document.body.appendChild(warning);
  } catch (e) {
    /* التشخيص اختياري — لا يوقف المعرض بأي حال */
  }
})();
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// خط أنابيب ألوان حديث: ACES Filmic يعطي تدرجات سينمائية غنية بدل القص
// الحاد للإضاءات الساطعة، وSRGB لعرض ألوان الخامات كما صُمّمت.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
sceneContainer.appendChild(renderer.domElement);

// تهدئة تغيير الحجم: أثناء سحب حافة النافذة يُطلق الحدث عشرات المرات
// وكل مرة تعيد بناء أهداف الرسم — ننفذها مرة واحدة بعد استقرار الحجم.
let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }, 120);
});

// -----------------------------------------------------------------------
// 4. الإضاءة
// -----------------------------------------------------------------------
// إضاءة نصف كروية أقوى قليلاً من الأصل لأن نماذج GLB الحقيقية (بخامات
// PBR غير باعثة) تحتاج إضاءة أعلى من الأشكال البديلة المتوهجة.
const hemiLight = new THREE.HemisphereLight(0xfff4e2, 0x8fa3c4, 1.7); // سماوي دافئ فاتح + انعكاس أرضي فاتح — سطوع عام أعلى
scene.add(hemiLight);

const lobbyLight = new THREE.PointLight(0xffe9c9, 5, 40, 2); // أبيض دافئ فندقي بدل الأزرق القاتم
lobbyLight.position.set(0, 8, 0);
// ملاحظة أداء حاسمة: ظل الضوء النقطي يعني رسم المشهد كاملاً 6 مرات إضافية
// (خريطة مكعبية) لكل ضوء! لذلك الظلال هنا من الضوء الموجّه الرئيسي فقط،
// والأضواء النقطية للإنارة والألوان بلا ظلال — فرق أداء هائل بلا فرق بصري
// يُذكر (اتجاه الظلال يبقى متسقاً من الضوء الرئيسي).
lobbyLight.castShadow = false;
scene.add(lobbyLight);

// ضوء موجّه رئيسي (كإضاءة قاعة علوية واقعية): يعطي ظلالاً ناعمة متسقة
// الاتجاه لكل المعرض ويبرز حجم النماذج ثلاثية الأبعاد.
const keyLight = new THREE.DirectionalLight(0xeaf4ff, 1.1);
keyLight.position.set(18, 26, 12);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -60;
keyLight.shadow.camera.right = 60;
keyLight.shadow.camera.top = 60;
keyLight.shadow.camera.bottom = -60;
keyLight.shadow.camera.far = 80;
keyLight.shadow.bias = -0.0004;
scene.add(keyLight);


function addRoomLight(x, z, color) {
  const light = new THREE.PointLight(color, 5, 45, 2);
  light.position.set(x, 7, z);
  light.castShadow = false; // الظلال من الضوء الموجّه الرئيسي فقط (انظر أعلاه)
  scene.add(light);
  // ضوء أبيض ناعم إضافي لإبراز تفاصيل نماذج GLB الحقيقية في كل غرفة
  const fill = new THREE.PointLight(0xffffff, 1.5, 40, 2);
  fill.position.set(x, 5, z);
  scene.add(fill);
  return light;
}

addRoomLight(-40, 0, COLORS.renewable);
addRoomLight(0, -40, COLORS.eeStudent);

// -----------------------------------------------------------------------
// 5. الخامات المشتركة (بأسلوب الزجاج الضبابي)
// -----------------------------------------------------------------------
const floorMaterial = new THREE.MeshStandardMaterial({
  color: COLORS.floor,
  metalness: 0.65,
  roughness: 0.12, // خشونة منخفضة -> أرضية عاكسة بلمعان مجرّي
  emissive: COLORS.floorAccent,
  emissiveIntensity: 0.08, // توهج أزرق خفيف جداً يحافظ على تباين واضح للنصوص والمعروضات
});

const glassWallMaterial = new THREE.MeshPhysicalMaterial({
  color: COLORS.wallGlass,
  transparent: true,
  opacity: 0.16, // شفافية عالية كافية تُبقي القراءة والتباين ممتازين خلف الجدران
  metalness: 0.1,
  roughness: 0.05,
  transmission: 0.55,
  side: THREE.DoubleSide,
});

// -----------------------------------------------------------------------
// 6. دوال البناء المساعدة — أرضيات، جدران، لافتات، أبواب، جسيمات
// -----------------------------------------------------------------------
function addFloor(centerX, centerZ, sizeX, sizeZ) {
  const geo = new THREE.PlaneGeometry(sizeX, sizeZ);
  const floor = new THREE.Mesh(geo, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(centerX, 0, centerZ);
  floor.receiveShadow = true;
  scene.add(floor);

  // شريط نيون رفيع حول حافة الأرضية لإحساس التوهج المستقبلي.
  const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(sizeX, 0.02, sizeZ));
  const edge = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: COLORS.neon }));
  edge.position.set(centerX, 0.02, centerZ);
  scene.add(edge);
}

function addGlassWalls(centerX, centerZ, sizeX, sizeZ, height = 6) {
  // أربعة جدران زجاجية رفيعة حول منطقة مستطيلة (مرئية فقط — التصادم
  // يُدار عبر WALKABLE_REGIONS للتبسيط).
  const positions = [
    { x: centerX, z: centerZ - sizeZ / 2, w: sizeX, h: height, rotY: 0 },
    { x: centerX, z: centerZ + sizeZ / 2, w: sizeX, h: height, rotY: 0 },
    { x: centerX - sizeX / 2, z: centerZ, w: sizeZ, h: height, rotY: Math.PI / 2 },
    { x: centerX + sizeX / 2, z: centerZ, w: sizeZ, h: height, rotY: Math.PI / 2 },
  ];
  positions.forEach((p) => {
    const geo = new THREE.PlaneGeometry(p.w, p.h);
    const wall = new THREE.Mesh(geo, glassWallMaterial);
    wall.position.set(p.x, p.h / 2, p.z);
    wall.rotation.y = p.rotY;
    scene.add(wall);
  });
}

/**
 * يضيف لافتة عائمة (مستوى متوهج بنص مرسوم على Canvas).
 * ملاحظة عربية: تشكيل الحروف العربية واتجاه RTL يعملان تلقائياً في Canvas؛
 * نستخدم خط Cairo (المُحمَّل في الصفحة) مع ‎ctx.direction = "rtl"‎ للأمان.
 */
function addSign(x, y, z, text, rotY = 0, color = "#3ea6ff") {
  const canvas = document.createElement("canvas");
  // عرض تلقائي: يُقاس النص أولاً فتتسع اللوحة للجملة كاملة مهما طالت
  // (مثل «هندسة الطاقة المتجددة» التي كانت أعرض من 640 بكسل فتُقتطع).
  // النصوص القصيرة تبقى بنفس العرض والمظهر السابقين تماماً.
  const measurer = document.createElement("canvas").getContext("2d");
  measurer.font = "bold 56px 'Cairo', 'Tajawal', Arial";
  const textWidth = measurer.measureText(text).width;
  canvas.width = Math.max(640, Math.ceil(textWidth) + 140); // هامش 70px لكل جهة
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(6, 10, 20, 0.0)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = "bold 56px 'Cairo', 'Tajawal', Arial";
  ctx.direction = "rtl"; // اتجاه النص من اليمين إلى اليسار
  // نص داكن عالي التباين (بدل الألوان الفاتحة السابقة التي ضعف تباينها
  // بعد تفتيح الغرف)، مع هالة بيضاء ناعمة تضمن القراءة من كل الاتجاهات
  // وعلى أي خلفية. الخط والحجم وسلوك المواجهة الدائمة كما هي تماماً.
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(255, 255, 255, 0.95)";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#1c2430"; // رمادي داكن جداً
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  ctx.shadowBlur = 0;
  // خط سفلي رفيع بلون التصنيف الأصلي — يحافظ على الترميز اللوني للغرف
  ctx.fillStyle = color;
  ctx.fillRect(canvas.width / 2 - 90, canvas.height / 2 + 34, 180, 5);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  // عرض اللوح ثلاثي الأبعاد يتبع نسبة أبعاد اللوحة (بلا تمديد ولا اقتطاع).
  const geometry = new THREE.PlaneGeometry(1.2 * (canvas.width / canvas.height), 1.2);
  const sign = new THREE.Mesh(geometry, material);
  sign.position.set(x, y, z);
  sign.rotation.y = rotY;
  sign.userData.isBillboard = true; // تُدار في حلقة التحريك لمواجهة الزائر دائماً
  scene.add(sign);
  billboardSigns.push(sign);
  return sign;
}

// كل اللافتات النصية (أسماء الغرف + أسماء المعروضات) — تُحدَّث دورانها كل
// إطار في حلقة التحريك حتى تواجه الزائر من أي زاوية (تأثير Billboard).
const billboardSigns = [];

/** يُدير دوران كل اللافتات حول المحور الرأسي فقط لمواجهة الكاميرا دائماً. */
// موضع الكاميرا في آخر تحديث للافتات — لتفادي إعادة حساب مئات الزوايا
// كل إطار بينما الزائر واقف مكانه (اللافتات لا تتغير حينها إطلاقاً).
const _lastBillboardPos = new THREE.Vector3(Infinity, Infinity, Infinity);

function updateBillboards() {
  // الموضع العالمي للكاميرا (يعمل أيضاً في VR حيث تكون الكاميرا ابناً للمنصة)
  const camPos = camera.getWorldPosition(_billboardCamPos);
  // عتبة صغيرة (2سم): أقل من ذلك لا يُحدث فرقاً مرئياً في زوايا اللافتات.
  if (_lastBillboardPos.distanceToSquared(camPos) < 0.0004) return;
  _lastBillboardPos.copy(camPos);
  for (let i = 0; i < billboardSigns.length; i++) {
    const s = billboardSigns[i];
    const dx = camPos.x - s.position.x;
    const dz = camPos.z - s.position.z;
    if (dx === 0 && dz === 0) continue;
    s.rotation.y = Math.atan2(dx, dz);
  }
}

const _billboardCamPos = new THREE.Vector3();

/** يضيف حقل جسيمات متحرك بسيط (غبار طافٍ / ومضات طاقة). */
function addParticles(centerX, centerZ, count, spread, color) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = centerX + (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = Math.random() * 5 + 0.5;
    positions[i * 3 + 2] = centerZ + (Math.random() - 0.5) * spread;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color, size: 0.05, transparent: true, opacity: 0.7 });
  const points = new THREE.Points(geometry, material);
  points.userData.isParticleField = true;
  scene.add(points);
  return points;
}

/**
 * يضيف باباً منزلقاً عند مدخل الممر. تنفتح الأبواب (تنزلق للأعلى)
 * عند اقتراب الزائر — تُدار في حلقة التحريك.
 */
const doors = [];
function addDoor(x, z, width = 5, rotY = 0) {
  const geo = new THREE.BoxGeometry(width, 4, 0.2);
  const mat = new THREE.MeshStandardMaterial({ color: 0x142033, metalness: 0.7, roughness: 0.3, emissive: 0x0a2a4a, emissiveIntensity: 0.3 });
  const door = new THREE.Mesh(geo, mat);
  door.position.set(x, 2, z);
  door.rotation.y = rotY;
  door.userData.closedY = 2;
  door.userData.openY = 6; // ينزلق للأعلى داخل السقف عند "الفتح"
  door.userData.isOpen = false;
  scene.add(door);
  doors.push({ mesh: door, triggerX: x, triggerZ: z, radius: 6 });
  return door;
}

/**
 * (جديد) يضيف ملصقاً جدارياً / شاشة عرض رقمية من صورة حقيقية.
 * يُحمَّل القوام بشكل غير متزامن ويُحسب ارتفاع اللوحة من نسبة أبعاد
 * الصورة تلقائياً (حفاظاً على النسبة). عند فشل التحميل: تحذير ومتابعة.
 */
function addPoster(x, y, z, rotY, imagePath, width = 7) {
  loadTexture(imagePath)
    .then((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      const aspect = texture.image.height / texture.image.width;
      const height = width * aspect; // الحفاظ على نسبة أبعاد الصورة
      // إطار خلفي رفيع يعطي شكل "شاشة عرض رقمية"
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.3, height + 0.3, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x0b1220, metalness: 0.7, roughness: 0.3, emissive: COLORS.neon, emissiveIntensity: 0.15 })
      );
      frame.position.set(x, y, z);
      frame.rotation.y = rotY;
      scene.add(frame);

      const poster = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({ map: texture })
      );
      poster.position.set(x, y, z);
      poster.rotation.y = rotY;
      // إزاحة صغيرة أمام الإطار لتجنب التداخل (z-fighting)
      poster.translateZ(0.06);
      scene.add(poster);
    })
    .catch((err) => {
      console.warn(`[assets] تعذر تحميل صورة الملصق "${imagePath}" — سيُتجاهل هذا الملصق:`, err);
    });
}

// -----------------------------------------------------------------------
// 7. سجل الأجسام التفاعلية
// -----------------------------------------------------------------------
// كل معروض قابل للنقر يُسجَّل هنا مع بياناته الوصفية المستخدمة للبحث
// في careerData عند النقر عليه.
const interactiveObjects = [];

function registerInteractive(object3d, categoryId, objectId) {
  object3d.userData.interactive = true;
  object3d.userData.categoryId = categoryId;
  object3d.userData.objectId = objectId;
  // تفعيل الظلال لكل الشبكات (يدعم المجموعات والنماذج المحمّلة)
  object3d.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  interactiveObjects.push(object3d);

  // توهج خفيف عبر نسخة أكبر قليلاً بوجوه خلفية (توهج زهيد التكلفة) —
  // يُطبق فقط على الشبكات البسيطة، لا على النماذج المحملة.
  if (object3d.isMesh && object3d.geometry) {
    const glowGeo = object3d.geometry.clone();
    const glowMat = new THREE.MeshBasicMaterial({ color: COLORS.neon, side: THREE.BackSide, transparent: true, opacity: 0.18 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.scale.multiplyScalar(1.08);
    object3d.add(glow);
  }
}

/**
 * يبني معروضاً: شكل بديل فوري + محاولة تحميل نموذج GLB حقيقي من سجل
 * الأصول (MODEL_MANIFEST في assets.js).
 *
 * سلوك التحميل التلقائي:
 *   - يوجد نموذج في السجل؟ يُحمَّل بالخلفية، يُضبط حجمه ودورانه وموضعه
 *     تلقائياً، تُفعَّل ظلاله، ثم يستبدل الشكل البديل.
 *   - فشل التحميل؟ يبقى الشكل البديل ظاهراً + تحذير في وحدة التحكم،
 *     ويستمر تحميل بقية الأصول دون توقف.
 */
// signHeight (اختياري): ارتفاع اللافتة يدوياً — يُستخدم عندما يكون نموذج GLB
// الحقيقي أطول بكثير من الشكل البديل، فتختفي اللافتة خلفه (مثل اللوح الشمسي).
function addExhibit({ x, z, geometry, color, categoryId, objectId, label, yOffset = 0, signHeight = null }) {
  const material = new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.35, emissive: color, emissiveIntensity: 0.08 });
  const mesh = new THREE.Mesh(geometry, material);
  const box = new THREE.Box3().setFromObject(mesh);
  const height = box.max.y - box.min.y || 1;
  mesh.position.set(x, height / 2 + yOffset, z);
  scene.add(mesh);
  registerInteractive(mesh, categoryId, objectId);
  addSign(x, signHeight !== null ? signHeight : height + yOffset + 1, z, label, 0, "#ffffff");

  // --- التحميل التلقائي لنموذج GLB الحقيقي (إن وُجد في السجل) ---
  const entry = MODEL_MANIFEST[categoryId] && MODEL_MANIFEST[categoryId][objectId];
  if (entry) {
    loadModel(entry.path)
      .then((raw) => {
        const model = normalizeModel(raw, entry);
        model.position.set(x, 0, z);
        scene.add(model);
        registerInteractive(model, categoryId, objectId);
        // إخفاء الشكل البديل بعد نجاح تحميل النموذج الحقيقي — إلا إذا كان
        // النموذج صغيراً ومطلوباً عرضه مرفوعاً فوق الشكل البديل نفسه
        // كمنصة عرض (keepBase في سجل النماذج).
        if (!entry.keepBase) {
          mesh.visible = false;
          const idx = interactiveObjects.indexOf(mesh);
          if (idx !== -1) interactiveObjects.splice(idx, 1);
        }
        console.log(`[assets] تم تحميل النموذج: ${entry.path}`);
      })
      .catch((err) => {
        // فشل التحميل: يبقى الشكل البديل + تحذير، وتستمر بقية الأصول.
        console.warn(`[assets] تعذر تحميل النموذج "${entry.path}" — سيبقى الشكل البديل ظاهراً:`, err);
      });
  }
  return mesh;
}

// -----------------------------------------------------------------------
// 8. بناء البهو الرئيسي
// -----------------------------------------------------------------------
function buildLobby() {
  addFloor(0, 0, 22, 22);
  addGlassWalls(0, 0, 22, 22, 7);
  addParticles(0, 0, 120, 20, 0x9fd3ff);

  // المجسم المركزي الدوّار (العنصر البصري المميز للبهو).
  // شكل بديل مؤقت (عقدة الطارة السابقة) يظهر فوراً، ثم يُستبدل تلقائياً
  // بنموذج البوابة ثلاثي الأبعاد (lobby_centerpiece.glb) فور اكتمال تحميله
  // — نفس الموضع والحجم التقريبي وسرعة الدوران واتجاهه.
  const logoGeo = new THREE.TorusKnotGeometry(1, 0.28, 120, 16);
  const logoMat = new THREE.MeshStandardMaterial({ color: COLORS.neon, emissive: COLORS.neon, emissiveIntensity: 0.5, metalness: 0.7, roughness: 0.2 });
  const logo = new THREE.Mesh(logoGeo, logoMat);
  logo.position.set(0, 3.2, 0);
  logo.userData.isLogo = true;
  scene.add(logo);

  loadModel("assets/models/lobby_centerpiece.glb")
    .then((model) => {
      // نفس الحجم البصري التقريبي لعقدة الطارة السابقة (~2.6م).
      // normalizeModel تُرسي قاع النموذج عند الصفر، بينما موضع المجسم
      // السابق كان بمركزه — لذا yOffset سالب بنصف الارتفاع حتى يقع مركز
      // البوابة في نفس نقطة مركز العقدة تماماً (0، 3.2، 0).
      normalizeModel(model, { targetSize: 2.6, rotY: 0, yOffset: -1.3 });
      const centerpiece = new THREE.Group();
      centerpiece.add(model);
      centerpiece.position.copy(logo.position); // نفس الموضع تماماً
      centerpiece.userData.isLogo = true;       // نفس حلقة الدوران وسرعتها
      // البوابة مجسم ذو اتجاه قائم واضح: تدور حول محورها الرأسي فقط
      // (بنفس سرعة واتجاه الدوران y السابقين) دون التقلب حول x الذي كان
      // مناسباً لعقدة الطارة المجردة لا لبوابة معمارية.
      centerpiece.userData.uprightLogo = true;
      scene.add(centerpiece);
      scene.remove(logo); // إزالة المجسم السابق بعد جاهزية البديل
      logo.geometry.dispose();
      logo.material.dispose();
    })
    .catch((err) => {
      console.warn("[assets] تعذر تحميل مجسم البهو المركزي — سيبقى الشكل السابق:", err);
    });

  addSign(0, 5.6, -9.5, "Fututor VR", 0, "#3ea6ff");

  // لافتات اتجاهية تشير إلى كل ممر.
  // (حُذفت اللافتات النصية الدوّارة عند البوابات — تغني عنها اللوحات
  // الإرشادية الثابتة بأسهم ↑ الموحّدة أدناه في upgradeEnvironment.)
}

// -----------------------------------------------------------------------
// 9. بناء الممرات
// -----------------------------------------------------------------------
/** يسدّ فتحة ممر ملغى في جدار البهو بجدار زجاجي مطابق (بلا فراغ مكشوف). */
function sealLobbyOpening(x, z, rotY) {
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(6.4, 5, 0.3),
    new THREE.MeshStandardMaterial({
      color: 0xf6f0e3, roughness: 0.65, metalness: 0.1,   // مطابق لألواح البهو
      transparent: true, opacity: 0.96,
    })
  );
  wall.position.set(x, 2.5, z);
  wall.rotation.y = rotY;
  markMergeable(wall);
  scene.add(wall);
}

function buildCorridor(centerX, centerZ, sizeX, sizeZ, color) {
  addFloor(centerX, centerZ, sizeX, sizeZ);
  addGlassWalls(centerX, centerZ, sizeX, sizeZ, 5);
  addParticles(centerX, centerZ, 40, Math.max(sizeX, sizeZ) * 0.8, color);
}

// أُغلقت غرفتا الذكاء الاصطناعي والروبوتات الجراحية (لتصغير الحجم وتسريع
// التحميل)؛ لم يبقَ سوى ممر الطاقة المتجددة الغربي. مدخلا الممرّين الآخرين
// يُسدّان بجدار زجاجي في البهو بدل فتحة مفتوحة على فراغ.
buildCorridor(-20, 0, 20, 6, COLORS.renewable); // -> الطاقة المتجددة (غرب)
buildCorridor(0, -20, 6, 20, COLORS.eeStudent); // -> الهندسة الكهربائية كطالب (شمال)
sealLobbyOpening(10, 0, Math.PI / 2); // مكان الممر الشرقي الملغى (جدار مطابق للبهو)

// بابا الغرفتين
addDoor(-10, 0, 5, Math.PI / 2);
addDoor(0, -10, 5, 0);

// -----------------------------------------------------------------------
// 10. بناء الغرفة 1 — هندسة الطاقة المتجددة
// -----------------------------------------------------------------------
function buildRenewableRoom() {
  // الغرفة الآن بحجم غرفتين: عمّقناها من 30 إلى 46م (بعد إغلاق الغرفتين
  // الأخريين اتّسع المكان). المعروضات موزّعة على منطقتين: القسم الأمامي
  // (المعروضات الحالية) والقسم الخلفي (فتحات جاهزة لنماذجك القادمة).
  const cx = -40, cz = 0;
  const ROOM_W = 26, ROOM_D = 46; // العرض والعمق الجديدان (كان 20×30)
  addFloor(cx, cz, ROOM_W, ROOM_D);
  addGlassWalls(cx, cz, ROOM_W, ROOM_D, 7);
  addParticles(cx, cz, 140, 30, COLORS.renewable); // جسيمات أكثر تملأ الحجم الأكبر
  addSign(cx, 6, cz + ROOM_D / 2 - 0.5, "هندسة الطاقة المتجددة", 0, "#38d39f");
  // إضاءة إضافية للنصف الخلفي حتى لا يبقى معتماً بعد التوسعة
  addRoomLight(cx, cz - 12, COLORS.renewable);

  // اللوح الشمسي — نموذج GLB حقيقي (البديل: صندوق مائل).
  // signHeight: 2.4 لأن النموذج الحقيقي يرتفع حتى ~1.4م، فاللافتة المحسوبة
  // من الشكل البديل المسطّح (1.15م) كانت تختفي خلف الألواح.
  addExhibit({
    x: cx - 6, z: cz - 8,
    geometry: new THREE.BoxGeometry(3, 0.15, 2),
    color: 0x1c3d7a, categoryId: "renewable_energy", objectId: "solar_panel", label: "اللوح الشمسي",
    signHeight: 2.4,
  });

  // توربين الرياح — نموذج GLB حقيقي.
  addExhibit({
    x: cx + 6, z: cz - 8,
    geometry: new THREE.CylinderGeometry(0.3, 0.4, 5, 16),
    color: 0xdfe6ee, categoryId: "renewable_energy", objectId: "wind_turbine", label: "توربين الرياح",
  });

  // وحدة تخزين البطاريات — نموذج GLB حقيقي (حاوية BESS).
  addExhibit({
    x: cx - 6, z: cz,
    geometry: new THREE.BoxGeometry(1.6, 2, 1),
    color: 0x2c9e6d, categoryId: "renewable_energy", objectId: "battery_storage", label: "وحدة تخزين البطاريات",
  });

  // المحول الكهربائي — نموذج GLB حقيقي (محول جهد عالٍ).
  addExhibit({
    x: cx + 6, z: cz,
    geometry: new THREE.CapsuleGeometry(0.6, 1.4, 4, 8),
    color: 0x8a8f99, categoryId: "renewable_energy", objectId: "transformer", label: "المحول الكهربائي",
  });

  // المحطة الفرعية — شكل بديل + صورة حقيقية في بطاقة المعلومات والملصق الجداري.
  addExhibit({
    x: cx - 6, z: cz + 8,
    geometry: new THREE.BoxGeometry(2.4, 1.6, 1.6),
    color: 0x4a5568, categoryId: "renewable_energy", objectId: "substation", label: "المحطة الفرعية",
  });

  // غرفة التحكم — نموذج GLB حقيقي.
  addExhibit({
    x: cx + 6, z: cz + 8,
    geometry: new THREE.BoxGeometry(2.2, 1.3, 0.15),
    color: 0x0a84ff, categoryId: "renewable_energy", objectId: "control_room", label: "غرفة التحكم",
  });

  // ---- القسم الخلفي الجديد: معروضات إضافية (فتحات جاهزة لنماذج GLB قادمة) ----
  // أشكال بديلة أنيقة تعمل فوراً، وتُستبدل تلقائياً بنماذجك حين تُضاف إلى
  // assets.js ومجلد assets/models/renewable/ بنفس objectId.
  addExhibit({
    x: cx - 7, z: cz - 14,
    geometry: new THREE.CylinderGeometry(1.4, 1.6, 0.5, 6),
    color: 0x2f9d6a, categoryId: "renewable_energy", objectId: "green_hydrogen", label: "الهيدروجين الأخضر",
  });
  addExhibit({
    x: cx + 7, z: cz - 14,
    geometry: new THREE.BoxGeometry(2.6, 1.4, 1.2),
    color: 0x3ea6ff, categoryId: "renewable_energy", objectId: "ev_charger", label: "شاحن المركبات الكهربائية",
  });

  // الشبكة الذكية والطاقة الشمسية المركّزة: نُقلتا إلى مقدّمة الغرفة مباشرةً
  // بعد كشك «الرؤية المستقبلية» (بطلب المستخدم) بدل القسم الخلفي.
  addExhibit({
    x: cx - 7, z: cz + 15,
    geometry: new THREE.ConeGeometry(1.2, 2.4, 4),
    color: 0xdfe6ee, categoryId: "renewable_energy", objectId: "smart_grid", label: "الشبكة الذكية",
  });
  addExhibit({
    x: cx + 7, z: cz + 15,
    geometry: new THREE.CylinderGeometry(0.9, 0.9, 2.2, 20),
    color: 0x59c98e, categoryId: "renewable_energy", objectId: "concentrated_solar", label: "الطاقة الشمسية المركّزة",
  });

  // ملصقان جداريان ملتصقان بالجدارين الغربي والشرقي (رجّعناهما للخلف تماماً).
  const posters = ROOM_POSTERS.renewable_energy || [];
  if (posters[0]) addPoster(cx - ROOM_W / 2 + 0.06, 3.4, cz, Math.PI / 2, posters[0].image, posters[0].width);
  if (posters[1]) addPoster(cx + ROOM_W / 2 - 0.06, 3.4, cz - 10, -Math.PI / 2, posters[1].image, posters[1].width);

  // كشك «الرؤية المستقبلية» في مقدّمة الغرفة.
  addPerspectiveKiosk(cx, cz + ROOM_D / 2 - 3, "renewable_energy", COLORS.renewable);
}

// -----------------------------------------------------------------------
// 11. بناء الغرفة 2 — الذكاء الاصطناعي
// -----------------------------------------------------------------------
/**
 * غرفة «الهندسة الكهربائية كطالب» — تحل محل غرفة الروبوتات الجراحية.
 *
 * تجربة الطالب في قسم الهندسة الكهربائية بجامعة الملك فيصل: الخطة
 * الدراسية، أجهزة المختبرات التي سيستخدمها فعلاً (راسم الإشارة، القياس،
 * لوحات التجارب، المعالجات، الآلات، التحكم الصناعي)، ومشروع التخرج.
 * المحتوى الأكاديمي من الخطة الدراسية الرسمية للقسم (معتمد ABET منذ 2012).
 *
 * كل المعروضات أشكال بديلة نظيفة تُستبدل تلقائياً بنماذج GLB حقيقية عند
 * إضافتها إلى assets/models/ee_student/ وتسجيلها في assets.js — نفس آلية
 * غرفة الطاقة المتجددة تماماً.
 */
function buildEEStudentRoom() {
  const cx = 0, cz = -40;
  const ROOM_W = 30, ROOM_D = 20;
  addFloor(cx, cz, ROOM_W, ROOM_D);
  addGlassWalls(cx, cz, ROOM_W, ROOM_D, 7);
  addParticles(cx, cz, 90, 24, COLORS.eeStudent);
  addSign(cx, 6, cz + ROOM_D / 2 - 0.5, "الهندسة الكهربائية كطالب", 0, "#38d39f");

  // ---- صف المدخل: خطتك الدراسية ووجهتك النهائية ----
  addExhibit({
    x: cx - 5, z: cz + 6.5,
    geometry: new THREE.BoxGeometry(2.6, 1.5, 0.15),
    color: 0x1c3d7a, categoryId: "ee_student", objectId: "study_plan_board", label: "الخطة الدراسية",
  });
  addExhibit({
    x: cx + 5, z: cz + 6.5,
    geometry: new THREE.IcosahedronGeometry(0.95, 0),
    color: 0xf0b429, categoryId: "ee_student", objectId: "senior_design", label: "مشروع التخرج",
  });

  // ---- الصف الأوسط: أجهزة مختبر الدوائر والإلكترونيات (سنتك الثانية) ----
  addExhibit({
    x: cx - 9, z: cz + 1,
    geometry: new THREE.BoxGeometry(1.4, 1.0, 0.8),
    color: 0x2c9e6d, categoryId: "ee_student", objectId: "oscilloscope", label: "راسم الإشارة",
  });
  addExhibit({
    x: cx - 3, z: cz + 1,
    geometry: new THREE.BoxGeometry(0.8, 1.25, 0.5),
    color: 0xd9534f, categoryId: "ee_student", objectId: "multimeter", label: "جهاز القياس المتعدد",
  });
  addExhibit({
    x: cx + 3, z: cz + 1,
    geometry: new THREE.BoxGeometry(2.0, 0.22, 1.4),
    color: 0x8a8f99, categoryId: "ee_student", objectId: "circuit_lab", label: "لوحة التجارب والدوائر",
  });
  addExhibit({
    x: cx + 9, z: cz + 1,
    geometry: new THREE.BoxGeometry(1.6, 0.16, 1.2),
    color: 0x0a84ff, categoryId: "ee_student", objectId: "microprocessor_kit", label: "لوحة المعالج الدقيق",
  });

  // ---- الصف الخلفي: القدرة والتحكم (سنتاك الثالثة والرابعة) ----
  addExhibit({
    x: cx - 6, z: cz - 5,
    geometry: new THREE.CylinderGeometry(0.85, 0.85, 1.6, 24),
    color: 0x4a5568, categoryId: "ee_student", objectId: "electric_machine", label: "الآلات الكهربائية",
  });
  addExhibit({
    x: cx + 6, z: cz - 5,
    geometry: new THREE.BoxGeometry(1.4, 2.0, 0.5),
    color: 0x36e0c8, categoryId: "ee_student", objectId: "plc_panel", label: "لوحة التحكم الصناعي (PLC)",
  });

  // كشك «الرؤية المستقبلية» على الجدار الشرقي للغرفة.
  addPerspectiveKiosk(cx + 13, cz, "ee_student", COLORS.eeStudent, -Math.PI / 2);
}

// -----------------------------------------------------------------------
// 13. كشك «الرؤية المستقبلية» (لكل غرفة)
// -----------------------------------------------------------------------
// يستخدم نموذج خريطة المملكة العربية السعودية (saudi_arabia.glb) كأيقونة
// عائمة دوّارة فوق الكشك في كل الغرف — بحسب متطلبات المشروع.
const perspectiveKiosks = [];
function addPerspectiveKiosk(x, z, categoryId, color, rotY = 0) {
  const geo = new THREE.BoxGeometry(1.2, 2, 0.3);
  const mat = new THREE.MeshStandardMaterial({ color: 0x0b1220, emissive: color, emissiveIntensity: 0.4, metalness: 0.5, roughness: 0.3 });
  const kiosk = new THREE.Mesh(geo, mat);
  kiosk.position.set(x, 1, z);
  kiosk.rotation.y = rotY;
  kiosk.userData.isPerspectiveKiosk = true;
  kiosk.userData.categoryId = categoryId;
  scene.add(kiosk);
  interactiveObjects.push(kiosk);
  addSign(x, 3.9, z, "الرؤية المستقبلية", rotY, "#ffffff");
  perspectiveKiosks.push(kiosk);

  // تحميل أيقونة خريطة السعودية العائمة فوق الكشك (تدور ببطء).
  loadModel(PERSPECTIVE_ICON_MODEL.path)
    .then((raw) => {
      const icon = normalizeModel(raw, { targetSize: PERSPECTIVE_ICON_MODEL.targetSize });
      icon.position.set(x, 2.3, z);
      icon.rotation.y = rotY;
      icon.userData.isPerspectiveIcon = true; // تُحرَّك في حلقة الرسوم
      // الأيقونة نفسها قابلة للنقر وتفتح نفس نافذة الرؤية المستقبلية
      icon.userData.isPerspectiveKiosk = true;
      icon.userData.categoryId = categoryId;
      scene.add(icon);
      interactiveObjects.push(icon);
    })
    .catch((err) => {
      console.warn(`[assets] تعذر تحميل أيقونة الرؤية المستقبلية (saudi_arabia.glb) — سيبقى الكشك القياسي:`, err);
    });
}

// بناء كل شيء.
buildLobby();
buildRenewableRoom();
buildEEStudentRoom(); // «الهندسة الكهربائية كطالب» (مكان الغرفة الجراحية سابقاً)

// -----------------------------------------------------------------------
// 14. الحركة — قفل المؤشر + WASD + التصادم مع WALKABLE_REGIONS
// -----------------------------------------------------------------------
const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(controls.getObject());

const moveState = { forward: false, backward: false, left: false, right: false };
const velocity = new THREE.Vector3();
const PLAYER_SPEED = 9.0;
const PLAYER_HEIGHT = 1.7;

document.addEventListener("keydown", (e) => {
  switch (e.code) {
    case "KeyW": case "ArrowUp": moveState.forward = true; break;
    case "KeyS": case "ArrowDown": moveState.backward = true; break;
    case "KeyA": case "ArrowLeft": moveState.left = true; break;
    case "KeyD": case "ArrowRight": moveState.right = true; break;
  }
});
document.addEventListener("keyup", (e) => {
  switch (e.code) {
    case "KeyW": case "ArrowUp": moveState.forward = false; break;
    case "KeyS": case "ArrowDown": moveState.backward = false; break;
    case "KeyA": case "ArrowLeft": moveState.left = false; break;
    case "KeyD": case "ArrowRight": moveState.right = false; break;
  }
});

/**
 * فحص إمكانية المشي — يحل مشكلة "الثغرة عند العتبات" التي كانت تمنع
 * الدخول/الخروج من غرفة الروبوتات الجراحية (ومن حيث المبدأ أي غرفة أخرى):
 *
 * التنفيذ القديم كان يُصغّر (inset) كل منطقة مشي بمقدار الهامش من كل
 * جهاتها الأربع على حدة. عند التقاء منطقتين متلاصقتين (مثل البهو وممر
 * الروبوتات الجراحية) كانت كل منطقة "تنكمش" بعيداً عن العتبة المشتركة،
 * فتنشأ ثغرة ميتة (~1.2م) عندها لا تُعتبر أي منطقة مشياً — يشعر الزائر
 * وكأن جداراً غير مرئي يمنعه عند كل باب.
 *
 * الحل: (1) النقطة نفسها يجب أن تقع داخل اتحاد (union) المناطق الخام
 * بلا أي هامش — لأن هذه المستطيلات الخام تتلاصق تماماً بلا ثغرات (تطابق
 * مواقع الأرضيات/الجدران الفعلية). (2) طبقة حماية إضافية ضد اختراق
 * الجدران: نفحص 4 نقاط استشعار على بعد "هامش" من النقطة في الاتجاهات
 * الأربعة — إن خرجت أي منها من الاتحاد بالكامل فهذا يعني أنها باتجاه
 * جدار خارجي حقيقي (وليس عتبة باب مشتركة بين منطقتين) فنمنع التقدم.
 * عند عتبة باب، تقع نقطة الاستشعار داخل المنطقة المجاورة فتبقى المشية
 * مسموحة بسلاسة تامة — بلا أي ثغرة.
 */
function insideAnyRegion(x, z) {
  return WALKABLE_REGIONS.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);
}

function isWalkable(x, z) {
  if (!insideAnyRegion(x, z)) return false;

  const margin = 0.55; // يمنع الزائر من الاقتراب أكثر من اللازم من جدار حقيقي (يمنع اختراقه بصرياً)
  return (
    insideAnyRegion(x - margin, z) &&
    insideAnyRegion(x + margin, z) &&
    insideAnyRegion(x, z - margin) &&
    insideAnyRegion(x, z + margin)
  );
}

// موضع الزائر في العالم — يعمل في الوضعين: على سطح المكتب الكاميرا في المشهد
// مباشرة، وفي الواقع الافتراضي الكاميرا ابن لمنصة الحركة (dolly)، لذا نأخذ
// الموضع العالمي دائماً بدل الموضع المحلي.
const _playerWorldPos = new THREE.Vector3();
function getPlayerWorldPosition() {
  return camera.getWorldPosition(_playerWorldPos);
}
// يرفعها vr.js أثناء الحركة بعصا التحكم (ليتبع المرافق «سعود» الزائر في VR).
let vrMoving = false;

function updateRoomLabel() {
  const pos = getPlayerWorldPosition();
  const match = ROOM_LABELS.find((r) => pos.x >= r.minX && pos.x <= r.maxX && pos.z >= r.minZ && pos.z <= r.maxZ);
  hudRoomLabel.textContent = match ? match.name : "استكشاف حر";
}

// -----------------------------------------------------------------------
// 14ب. المرافق الروبوتي الإنساني «سعود» — يتبع الزائر فقط عند الحركة
// الفعلية بمفاتيح WASD، يواجهه عند التوقف، ويفتح محادثة حرة عند النقر عليه.
// -----------------------------------------------------------------------
let ariaCompanion = null; // THREE.Group بعد اكتمال التحميل
let ariaBobPhase = Math.random() * Math.PI * 2;
// وضعية «مرشد المتحف»: أمام الزائر وإلى يمينه بزاوية 35° (ضمن نطاق
// 30-45° المطلوب) وعلى بعد 1.4م — يبدو وكأنه يقدّم المعروضات لا يسير
// بجواره فحسب، وبعيداً عن مركز الرؤية فلا يحجبها ولا يسد الطريق.
const ARIA_GUIDE_ANGLE = (35 * Math.PI) / 180;
const ARIA_GUIDE_DISTANCE = 1.4;
const ARIA_FOLLOW_DISTANCE_SIDE = Math.sin(ARIA_GUIDE_ANGLE) * ARIA_GUIDE_DISTANCE; // المركّبة الجانبية
const ARIA_FOLLOW_DISTANCE_BACK = -Math.cos(ARIA_GUIDE_ANGLE) * ARIA_GUIDE_DISTANCE; // سالبة = أمام الزائر
const ARIA_MOVE_SPEED = 5.5; // سرعة لحاق المرافق (أسرع قليلاً من الزائر)
const ariaTargetPos = new THREE.Vector3();
const ariaLastPos = new THREE.Vector3();
// اتجاها "أمام/يمين" مرجعيان يُحدَّثان فقط أثناء حركة WASD الفعلية —
// تجميدهما أثناء الوقوف يمنع أي انجراف أو اهتزاز عند تحريك الفأرة فقط
// للنظر حول المشهد (وهو بالضبط الخلل الذي طُلب إصلاحه).
const ariaRefForward = new THREE.Vector3(0, 0, -1);
const ariaRefRight = new THREE.Vector3(1, 0, 0);
let ariaTargetInitialized = false;

loadModel(ARIA_COMPANION_MODEL.path)
  .then((raw) => {
    // القياس حسب الارتفاع فقط (وليس أكبر بُعد) حتى يطابق طول المرافق
    // طول الزائر (PLAYER_HEIGHT) تماماً بصرف النظر عن وضعية النموذج.
    const wrapper = normalizeModel(raw, ARIA_COMPANION_MODEL);
    // بدء موضع المرافق بجانب نقطة انطلاق الزائر في البهو.
    wrapper.position.set(1.3, 0, 1.5);
    wrapper.userData.isAriaCompanion = true;
    scene.add(wrapper);
    ariaCompanion = wrapper;
    ariaLastPos.copy(wrapper.position);
    ariaTargetPos.copy(wrapper.position);
    // المرافق تفاعلي أيضاً — النقر عليه يفتح محادثة حرة بدل بطاقة معروض.
    interactiveObjects.push(wrapper);
    // إضاءة نقطية خفيفة ملاصقة للمرافق لإبرازه في أي غرفة.
    const glow = new THREE.PointLight(COLORS.neon, 1.2, 6, 2);
    glow.position.set(0, 1.4, 0);
    wrapper.add(glow);
  })
  .catch((err) => {
    console.warn(`[assets] تعذر تحميل نموذج المرافق «سعود» (${ARIA_COMPANION_MODEL.path}):`, err);
  });

/** يحدّث موضع ودوران وحركة المرافق «سعود» في كل إطار. */
function updateAriaCompanion(delta) {
  if (!ariaCompanion) return;

  const playerPos = getPlayerWorldPosition();
  // مهم: الحركة الفعلية بمفاتيح WASD فقط — وليس مجرد تحريك الفأرة للنظر
  // حول المشهد. هذا هو الفرق الجوهري الذي يمنع الانجراف/الاهتزاز.
  // (في وضع VR: الحركة الفعلية بعصا التحكم — vrMoving.)
  const isMovingWASD = moveState.forward || moveState.backward || moveState.left || moveState.right;

  if (isMovingWASD || vrMoving || !ariaTargetInitialized) {
    // نحدّث اتجاهي "أمام/يمين" المرجعيين فقط أثناء الحركة الفعلية —
    // يبقيان مجمّدين تماماً أثناء الوقوف حتى لو دار الزائر بالفأرة.
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() > 1e-6) {
      forward.normalize();
      ariaRefForward.copy(forward);
      ariaRefRight.set(-forward.z, 0, forward.x);
    }

    ariaTargetPos.copy(playerPos);
    ariaTargetPos.addScaledVector(ariaRefRight, ARIA_FOLLOW_DISTANCE_SIDE);
    ariaTargetPos.addScaledVector(ariaRefForward, -ARIA_FOLLOW_DISTANCE_BACK);

    // تجنّب العوائق (الجدران): إن كانت نقطة الوجهة خارج مناطق المشي، اقترب
    // تدريجياً من الزائر نفسه بدل الانزلاق داخل الجدار — "تجنّب ناعم"
    // بلا حجب لمسار الزائر أبداً (الوجهة البديلة خلفه مباشرة، ليست أمامه).
    if (!isWalkable(ariaTargetPos.x, ariaTargetPos.z)) {
      ariaTargetPos.copy(playerPos);
      ariaTargetPos.addScaledVector(ariaRefForward, -0.9);
    }
    ariaTargetPos.y = 0;
    ariaTargetInitialized = true;
  }
  // عند الوقوف (بدون WASD): الوجهة المستهدفة تبقى ثابتة تماماً كما هي —
  // لا يُعاد حسابها إطلاقاً، فلا يتحرك المرافق قيد أنملة بسبب دوران الكاميرا.

  // حركة ناعمة نحو الوجهة (Lerp محدود بالسرعة القصوى) — تتوقف من تلقاء
  // نفسها فور الوصول، ولا تُستأنف إلا حين تتغيّر الوجهة (أي عند حركة حقيقية).
  const toTarget = new THREE.Vector3().subVectors(ariaTargetPos, ariaCompanion.position);
  const dist = toTarget.length();
  if (dist > 0.02) {
    const step = Math.min(dist, ARIA_MOVE_SPEED * delta);
    toTarget.normalize();
    ariaCompanion.position.addScaledVector(toTarget, step);
  }

  const traveled = ariaCompanion.position.distanceTo(ariaLastPos);
  const companionMoving = traveled > 0.005;

  if (!companionMoving) {
    // متوقف تماماً — يواجه الزائر بلطف (دون أي تغيير في الموضع).
    const dx = playerPos.x - ariaCompanion.position.x;
    const dz = playerPos.z - ariaCompanion.position.z;
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
      const targetYaw = Math.atan2(dx, dz);
      let yawDiff = targetYaw - ariaCompanion.rotation.y;
      yawDiff = Math.atan2(Math.sin(yawDiff), Math.cos(yawDiff)); // تطبيع الفرق إلى [-π, π]
      ariaCompanion.rotation.y += yawDiff * Math.min(1, delta * 4);
    }
    // اهتزاز وقوف هادئ (Idle) — ارتفاع طفيف بطيء.
    ariaBobPhase += delta * 1.6;
    ariaCompanion.position.y = Math.sin(ariaBobPhase) * 0.02;
  } else {
    // يواجه اتجاه حركته أثناء اللحاق بالزائر (بنفس الاتجاه العام للزائر تقريباً).
    const moveDir = new THREE.Vector3().subVectors(ariaCompanion.position, ariaLastPos);
    if (moveDir.lengthSq() > 1e-8) {
      const targetYaw = Math.atan2(moveDir.x, moveDir.z);
      let yawDiff = targetYaw - ariaCompanion.rotation.y;
      yawDiff = Math.atan2(Math.sin(yawDiff), Math.cos(yawDiff));
      ariaCompanion.rotation.y += yawDiff * Math.min(1, delta * 6);
    }
    // اهتزاز مشي أسرع وأوضح (Walk bob).
    ariaBobPhase += delta * 8;
    ariaCompanion.position.y = Math.abs(Math.sin(ariaBobPhase)) * 0.06;
  }

  ariaLastPos.copy(ariaCompanion.position);
}

// -----------------------------------------------------------------------
// 15. شاشة البدء -> تفعيل قفل المؤشر
// -----------------------------------------------------------------------
// ---------------------------------------------------------------------------
// تكامل «الرحلة الجامعية»: عملٌ جديد يسبق المعرض. عند التخرّج (أو الدخول
// المباشر) يُسلَّم اللاعب لغرفة الطاقة المتجددة القائمة — المكافأة (5A).
// لا يغيّر هذا المعرض نفسه إطلاقاً؛ فقط يبدأ الرحلة ثم يدخل المشهد.
// ---------------------------------------------------------------------------
function beginExhibition(intoReward) {
  startOverlay.classList.add("hidden");
  hud.classList.remove("hidden");
  document.getElementById("aria-reopen-btn").classList.remove("hidden");
  if (!IS_TOUCH_DEVICE) controls.lock();
  playSfx(sfxAmbient);
  if (intoReward) {
    // ضع اللاعب عند مدخل الممر الغربي متّجهاً إلى غرفة الطاقة المتجددة،
    // مع تمييز بصري بسيط للمكافأة.
    const player = controls.getObject ? controls.getObject() : camera;
    player.position.set(-9, 1.7, 0);   // فم الممر الغربي
    camera.rotation.set(0, Math.PI / 2, 0); // النظر غرباً نحو الغرفة
  }
}

if (window.Journey) {
  // عند إغلاق الرحلة: ادخل المعرض (وإلى المكافأة إن تخرّج).
  window.Journey.onGraduate = (info) => {
    beginExhibition(!!info && info.graduated);
  };
}

const startJourneyBtn = document.getElementById("start-journey-btn");
if (startJourneyBtn) {
  startJourneyBtn.addEventListener("click", () => {
    // إصلاح مُبلَّغ: يجب أن تختفي قائمة البداية فوراً عند الضغط —
    // كانت تبقى ظاهرة خلف/تحت واجهة الرحلة. تُخفى هنا مباشرة ولا يعيد
    // إظهارها أي شيء لاحقاً (beginExhibition يخفيها أصلاً عند العودة).
    startOverlay.classList.add("hidden");
    if (window.Journey) window.Journey.start();
    else beginExhibition(false); // احتياط: إن تعذّر تحميل الرحلة
  });
}

startBtn.addEventListener("click", () => {
  startOverlay.classList.add("hidden");
  hud.classList.remove("hidden");
  // قفل المؤشر غير مدعوم (ولا لازم) على الأجهزة اللمسية — التحكم هناك
  // بالعصا الافتراضية والسحب، فنتفادى طلبه لتجنّب أخطاء المتصفح.
  if (!IS_TOUCH_DEVICE) controls.lock();
  playSfx(sfxAmbient);

  // (بناءً على طلب المستخدم) لم تعد لوحة «سعود» تنبثق تلقائياً عند الدخول —
  // تُفتح فقط عند النقر على أيقونتها أو على سعود نفسه داخل المعرض.
  // نُظهر الأيقونة 💬 فور الدخول (كانت تظهر سابقاً بعد إغلاق اللوحة فقط).
  document.getElementById("aria-reopen-btn").classList.remove("hidden");
});

sceneContainer.addEventListener("click", () => {
  // إعادة قفل المؤشر إذا نقر الزائر على المشهد بعد فتح نافذة.
  if (!IS_TOUCH_DEVICE && !controls.isLocked && startOverlay.classList.contains("hidden") && !anyModalOpen()) {
    controls.lock();
  }
});

// -----------------------------------------------------------------------
// 16. التفاعل بالنقر (Raycasting لفحص المعروض أمام الزائر)
// -----------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0); // مركز الشاشة دائماً مع قفل المؤشر
const INTERACT_DISTANCE = 8;

/**
 * يصعد في سلسلة الآباء من الشبكة المصابة حتى يجد الجذر المسجل كتفاعلي —
 * ضروري لأن نماذج GLB مجموعات (Groups) والإصابة تقع على أبنائها الداخليين.
 */
function findInteractiveRoot(object) {
  let current = object;
  while (current) {
    if (current.userData && (current.userData.interactive || current.userData.isPerspectiveKiosk || current.userData.isAriaCompanion)) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

function tryInteract(pointer = null) {
  // pointer: إحداثيات نقطة اللمس (-1..1). بدونها نستخدم مركز الشاشة
  // (وضع سطح المكتب مع قفل المؤشر).
  if (!controls.isLocked && !pointer) return;
  raycaster.setFromCamera(pointer || screenCenter, camera);
  // recursive = true حتى تُلتقط الشبكات الداخلية لنماذج GLB
  const hits = raycaster.intersectObjects(interactiveObjects, true);
  if (hits.length === 0 || hits[0].distance > INTERACT_DISTANCE) return;

  const obj = findInteractiveRoot(hits[0].object);
  if (!obj) return;
  playSfx(sfxClick);

  if (obj.userData.isAriaCompanion) {
    // النقر على المرافق ثلاثي الأبعاد يفتح محادثة حرة (وليس بطاقة معروض).
    if (controls.isLocked) controls.unlock();
    window.CareerAI.openChat();
  } else if (obj.userData.isPerspectiveKiosk) {
    openPerspectiveModal(obj.userData.categoryId);
  } else if (obj.userData.interactive) {
    openObjectModal(obj.userData.categoryId, obj.userData.objectId);
  }
}

renderer.domElement.addEventListener("click", () => {
  if (controls.isLocked) tryInteract();
});

// -----------------------------------------------------------------------
// 17. النوافذ — معلومات الجسم + الرؤية المستقبلية
// -----------------------------------------------------------------------
const objectModal = document.getElementById("object-modal");
const perspectiveModal = document.getElementById("perspective-modal");
const recommendationModal = document.getElementById("recommendation-modal");

// إصلاح الخلل: كانت هذه الدالة تتجاهل حالة لوحة «سعود» (الاختبار/المحادثة)،
// فكان قفل المؤشر يُعاد فرضه فوق اللوحة ويمنع الزائر من الضغط على أزرارها
// أو من مغادرة الغرفة بشكل طبيعي. الآن تُحتسب لوحة سعود ضمن "أي نافذة مفتوحة".
function anyModalOpen() {
  const uiModalOpen = ![objectModal, perspectiveModal, recommendationModal].every((m) => m.classList.contains("hidden"));
  const ariaOpen = typeof window.CareerAI?.isOpen === "function" && window.CareerAI.isOpen();
  return uiModalOpen || ariaOpen;
}

/** يحدّث صنف body.modal-open (تستعمله CSS لإيقاف تراكم طبقات الضبابية). */
function syncModalOpenClass() {
  const anyOpen = Array.from(document.querySelectorAll(".modal")).some(
    (modal) => !modal.classList.contains("hidden")
  );
  document.body.classList.toggle("modal-open", anyOpen);
}

function openModal(modalEl) {
  modalEl.classList.remove("hidden");
  syncModalOpenClass();
  controls.unlock();
}
function closeModal(modalEl) {
  modalEl.classList.add("hidden");
  syncModalOpenClass();
  // إيقاف القراءة الصوتية وعرض الشرائح عند إغلاق بطاقة المعروض
  // (توفير للأداء + عدم استمرار الصوت بعد اختفاء النص).
  if (modalEl === objectModal) {
    stopNarration();
    stopGallery();
  }
}

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const modal = document.getElementById(btn.dataset.close);
    closeModal(modal);
  });
});

// أسماء الغرف بالعربية (تظهر أعلى نافذة معلومات الجسم)
const CATEGORY_ROOM_NAMES = {
  renewable_energy: "هندسة الطاقة المتجددة",
  artificial_intelligence: "الذكاء الاصطناعي",
  surgical_robotics: "الروبوتات الجراحية",
};

// مولّد صورة بديلة بسيط عبر تدرج لوني على Canvas — يُستخدم فقط للأجسام
// التي لا تملك صورة حقيقية في سجل الأصول (OBJECT_IMAGES في assets.js).
function generatePlaceholderImage(label, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 350;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 800, 350);
  gradient.addColorStop(0, "#0b1220");
  gradient.addColorStop(1, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 800, 350);
  ctx.font = "bold 40px 'Cairo', 'Tajawal', Arial";
  ctx.direction = "rtl";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.textAlign = "center";
  ctx.fillText(label, 400, 185);
  return canvas.toDataURL();
}

/**
 * يجلب بيانات معروض من قاعدة المهن. يدعم مخطط الخادم الكامل
 * (objects: مصفوفة) والمخطط الاحتياطي المبسط (objects: قاموس بالمفاتيح).
 * تستخدمها بطاقة سطح المكتب ولوحة الواقع الافتراضي معاً.
 */
function getObjectData(categoryId, objectId) {
  const category = careerData[categoryId];
  if (!category) return null;
  if (Array.isArray(category.objects)) {
    return category.objects.find((o) => o.id === objectId) || null;
  }
  return category.objects[objectId] || null;
}

function openObjectModal(categoryId, objectId) {
  const objectData = getObjectData(categoryId, objectId);
  if (!objectData) return;

  // إيقاف أي قراءة صوتية سابقة قبل عرض معروض جديد.
  stopNarration();

  document.getElementById("object-modal-room").textContent = CATEGORY_ROOM_NAMES[categoryId] || "";
  // النصوص تُكتب داخل «جُمل» قابلة للتظليل أثناء القراءة الصوتية
  // (setNarratableText) بدل textContent المباشر — نفس النص المعروض تماماً.
  setNarratableText(document.getElementById("object-modal-title"), objectData.name);
  setNarratableText(document.getElementById("object-modal-purpose"), objectData.purpose);
  setNarratableText(document.getElementById("object-modal-how"), objectData.how_it_works);
  setNarratableText(document.getElementById("object-modal-future"), objectData.future);

  // قسم «التطبيقات الواقعية» — يُخفى إذا لم تتوفر البيانات لهذا الجسم.
  const appsSection = document.getElementById("object-modal-applications-section");
  if (objectData.applications) {
    appsSection.style.display = "";
    setNarratableText(document.getElementById("object-modal-applications"), objectData.applications);
  } else {
    appsSection.style.display = "none";
    document.getElementById("object-modal-applications").textContent = "";
  }

  prepareNarration();

  const careersEl = document.getElementById("object-modal-careers");
  careersEl.innerHTML = "";
  (objectData.careers || []).forEach((c) => {
    const span = document.createElement("span");
    span.textContent = c;
    careersEl.appendChild(span);
  });

  // معرض الصور: يُبنى ويُحمَّل الآن فقط (تحميل كسول) — لا صور تُجلب قبل
  // فتح بطاقة المعروض، ولا استدعاءات شبكة زائدة.
  startGallery(objectId, objectData.name);

  openModal(objectModal);
}

function openPerspectiveModal(categoryId) {
  const category = careerData[categoryId];
  if (!category || !category.future_perspective) return;

  document.getElementById("perspective-title").textContent = category.future_perspective.title;
  const list = document.getElementById("perspective-points");
  list.innerHTML = "";
  category.future_perspective.points.forEach((point) => {
    const li = document.createElement("li");
    li.textContent = point;
    list.appendChild(li);
  });

  // قسم الجامعات السعودية الموصى بها لهذا التخصص (إن توفرت في البيانات).
  const uniSection = document.getElementById("perspective-universities-section");
  const uniContainer = document.getElementById("perspective-universities");
  uniContainer.innerHTML = "";
  const universities = category.saudi_universities || [];
  if (universities.length > 0) {
    uniSection.style.display = "";
    universities.forEach((u) => {
      const card = document.createElement("div");
      card.className = "university-card";
      card.innerHTML = `<span class="university-name">${u.name}</span><span class="university-college">${u.college || ""}</span><p class="university-why">${u.why || ""}</p>`;
      uniContainer.appendChild(card);
    });
  } else {
    uniSection.style.display = "none";
  }

  openModal(perspectiveModal);
}

// -----------------------------------------------------------------------
// 18. تكامل «سعود» — الانتقال إلى الغرفة بعد التوصية
// -----------------------------------------------------------------------
const ROOM_TARGET_POSITIONS = {
  // بعد إغلاق غرفتي الذكاء والجراحة، الغرفة الوحيدة هي الطاقة المتجددة —
  // فأيّ توصية من البوصلة تنتقل إليها. عند فتح غرف أخرى مستقبلاً تُعاد
  // إحداثياتها هنا.
  renewable_energy: new THREE.Vector3(-40, PLAYER_HEIGHT, 14),
  artificial_intelligence: new THREE.Vector3(-40, PLAYER_HEIGHT, 14),
  surgical_robotics: new THREE.Vector3(-40, PLAYER_HEIGHT, 14),
};

window.CareerAI.init({
  onRecommendation: (result) => {
    window.CareerAI.close();
    recommendationModal.classList.add("hidden");
    const target = ROOM_TARGET_POSITIONS[result.recommended_career_id];
    if (target) {
      controls.getObject().position.copy(target);
    }
    setTimeout(() => {
      if (!anyModalOpen()) controls.lock();
    }, 200);
  },
});

// -----------------------------------------------------------------------
// أداة مطورين صغيرة: انتقال فوري إلى غرفة معينة من وحدة تحكم المتصفح
// (مفيدة للعروض والاختبار). مثال: window.XRDev.goto("surgical_robotics")
// -----------------------------------------------------------------------
window.XRDev = {
  goto(roomId) {
    const target = ROOM_TARGET_POSITIONS[roomId];
    if (!target) return `غرفة غير معروفة: ${roomId}`;
    controls.getObject().position.copy(target);
    return `تم الانتقال إلى: ${roomId}`;
  },
  // تشخيص وحدات التحكم داخل النظارة: window.XRDev.vrDebug(true / false)
  vrDebug(on = true) {
    return vr.setDebug(on);
  },
  look(dirX, dirZ) {
    // توجيه الكاميرا نحو اتجاه أفقي معين
    const obj = controls.getObject();
    camera.lookAt(obj.position.x + dirX, PLAYER_HEIGHT, obj.position.z + dirZ);
    return "تم التوجيه";
  },
};

// -----------------------------------------------------------------------
// 19. زر كتم الصوت
// -----------------------------------------------------------------------
// -----------------------------------------------------------------------
// 19ب. زر "العودة للبهو" — يضمن إمكانية مغادرة أي غرفة (بما فيها الروبوتات
// الجراحية) والعودة للاستكشاف الحر في أي لحظة، بصرف النظر عن حالة الاختبار.
// -----------------------------------------------------------------------
exitRoomBtn.addEventListener("click", () => {
  controls.getObject().position.set(0, PLAYER_HEIGHT, 0);
  velocity.set(0, 0, 0);
  if (!anyModalOpen()) controls.lock();
});

muteBtn.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  muteBtn.textContent = soundEnabled ? "🔊" : "🔇";
  if (!soundEnabled) {
    sfxAmbient.pause();
  } else {
    playSfx(sfxAmbient);
  }
});

// -----------------------------------------------------------------------
// 20. حلقة التحريك
// -----------------------------------------------------------------------
const clock = new THREE.Clock();

function animateDoors(delta) {
  const playerPos = getPlayerWorldPosition();
  doors.forEach((d) => {
    const dist = Math.hypot(playerPos.x - d.triggerX, playerPos.z - d.triggerZ);
    const shouldOpen = dist < d.radius;
    const targetY = shouldOpen ? d.mesh.userData.openY : d.mesh.userData.closedY;
    if (shouldOpen !== d.mesh.userData.isOpen) {
      d.mesh.userData.isOpen = shouldOpen;
      if (shouldOpen) playSfx(sfxDoor);
    }
    d.mesh.position.y += (targetY - d.mesh.position.y) * Math.min(1, delta * 3);
  });
}

function animateParticles(delta) {
  scene.children.forEach((child) => {
    if (child.userData && child.userData.isParticleField) {
      child.rotation.y += delta * 0.02;
    }
    if (child.userData && child.userData.isLogo) {
      if (!child.userData.uprightLogo) child.rotation.x += delta * 0.3;
      child.rotation.y += delta * 0.4; // نفس سرعة واتجاه الدوران للمجسم الجديد
    }
    // دوران بطيء لأيقونات «الرؤية المستقبلية» (خريطة السعودية)
    if (child.userData && child.userData.isPerspectiveIcon) {
      child.rotation.y += delta * 0.5;
    }
  });
}

function updateMovement(delta) {
  // على الجوال/اللوحي لا يوجد «قفل مؤشر»، فالحركة تأتي من عصا اللمس.
  if (!controls.isLocked && !touchControls.active) return;

  const damping = Math.min(1, 10 * delta);
  velocity.x -= velocity.x * damping;
  velocity.z -= velocity.z * damping;

  // دمج مدخلات لوحة المفاتيح مع عصا اللمس التماثلية (قيم -1..1).
  const inputDir = new THREE.Vector3(
    Number(moveState.right) - Number(moveState.left) + touchControls.moveX,
    0,
    Number(moveState.backward) - Number(moveState.forward) + touchControls.moveY
  );
  if (inputDir.lengthSq() > 1) inputDir.normalize(); // لا تتجاوز السرعة القصوى

  velocity.x += inputDir.x * PLAYER_SPEED * delta * 10;
  velocity.z += inputDir.z * PLAYER_SPEED * delta * 10;

  const obj = controls.getObject();
  const prevX = obj.position.x;
  const prevZ = obj.position.z;

  // التحرك على المحور المحلي X (انزلاق جانبي) ثم Z (أمام/خلف)، مع فحص كل
  // محور على حدة حتى "ينزلق" الزائر على الجدران بدل التوقف الكامل.
  controls.moveRight(velocity.x * delta);
  if (!isWalkable(obj.position.x, obj.position.z)) {
    obj.position.x = prevX;
  }

  controls.moveForward(-velocity.z * delta);
  if (!isWalkable(obj.position.x, obj.position.z)) {
    obj.position.z = prevZ;
  }

  obj.position.y = PLAYER_HEIGHT;
}

function animate() {
  const delta = Math.min(0.05, clock.getDelta());

  // في وضع الواقع الافتراضي: الحركة تأتي من عصا التحكم (vr.js) بدل WASD،
  // والكاميرا يقودها الجهاز. بقية المشهد (الأبواب، الجسيمات، المرافق سعود)
  // يعمل كما هو في الوضعين.
  if (renderer.xr.isPresenting) {
    vr.update(delta);
  } else {
    updateMovement(delta);
  }

  animateDoors(delta);
  animateParticles(delta);
  ledPulse(delta);
  adaptiveQualityTick(delta);
  updateRoomLabel();
  updateBillboards();
  updateAriaCompanion(delta);

  renderer.render(scene, camera);
}

// -----------------------------------------------------------------------
// 21. تشغيل وضع الواقع الافتراضي (WebXR) — طبقة إضافية
// -----------------------------------------------------------------------
// تُفعَّل تلقائياً على النظارات الداعمة (Quest وغيرها)، ولا تغيّر شيئاً في
// تجربة سطح المكتب: زر «ادخل الواقع الافتراضي» يظهر فقط إن كان الجهاز
// يدعم immersive-vr.
const vr = initVR({
  THREE,
  renderer,
  scene,
  camera,
  playerHeight: PLAYER_HEIGHT,
  isWalkable,
  interactiveObjects,
  findInteractiveRoot,
  getObjectData,
  getPerspective: (categoryId) => (careerData[categoryId] || {}).future_perspective || null,
  categoryRoomNames: CATEGORY_ROOM_NAMES,
  speak: speakArabicText,
  stopSpeaking: () => {
    ttsAudio.pause();
    if (synth) synth.cancel();
  },
  setMoving: (moving) => {
    vrMoving = moving;
  },
});

// setAnimationLoop (بدل requestAnimationFrame) — شرط أساسي لعمل WebXR،
// ويتصرف تماماً مثل requestAnimationFrame خارج جلسة الواقع الافتراضي.
renderer.setAnimationLoop(animate);

// -----------------------------------------------------------------------
// 21. معرض صور المعروض (شرائح تلقائية) — إضافة جديدة
// -----------------------------------------------------------------------
// لكل معروض أربع صور (سجل OBJECT_GALLERIES في assets.js) من مصادر حرة
// الترخيص. المبادئ المتبعة للأداء:
//   - لا يُحمَّل أي شيء قبل فتح بطاقة المعروض (تحميل كسول تماماً).
//   - الصورة التالية فقط تُجهَّز مسبقاً (وليس كل الصور دفعة واحدة).
//   - ذاكرة تخزين مؤقت (galleryImageCache) تمنع إعادة تحميل صورة سبق عرضها.
//   - المؤقّت يتوقف تماماً عند إغلاق البطاقة (لا رسم ولا شبكة في الخلفية).
// -----------------------------------------------------------------------
const GALLERY_INTERVAL_MS = 4000; // بين 3 و5 ثوانٍ حسب المطلوب

const galleryLayers = [
  document.getElementById("object-modal-image"),
  document.getElementById("object-modal-image-next"),
];
const galleryCaptionEl = document.getElementById("object-gallery-caption");
const galleryDotsEl = document.getElementById("object-gallery-dots");
const galleryPrevBtn = document.getElementById("gallery-prev-btn");
const galleryNextBtn = document.getElementById("gallery-next-btn");
const galleryPlayBtn = document.getElementById("gallery-play-btn");
const galleryVideoPlaceholder = document.querySelector(".object-modal-media .video-placeholder");

// مسارات الصور التي اكتمل تحميلها بنجاح (تخزين مؤقت داخل الجلسة)
const galleryImageCache = new Set();

const gallery = {
  slides: [],
  index: 0,
  activeLayer: 0,
  timer: null,
  playing: true,
};

/** يجهّز صورة مسبقاً (ويسجلها في الذاكرة المؤقتة) دون عرضها. */
function preloadGalleryImage(url) {
  if (!url || galleryImageCache.has(url)) return;
  const img = new Image();
  img.decoding = "async";
  img.onload = () => galleryImageCache.add(url);
  img.src = url;
}

/** يعرض الشريحة رقم index بتلاشٍ سلس بين طبقتي الصور. */
function showGallerySlide(index) {
  if (!gallery.slides.length) return;
  const count = gallery.slides.length;
  gallery.index = ((index % count) + count) % count;
  const slide = gallery.slides[gallery.index];

  const nextLayer = galleryLayers[1 - gallery.activeLayer];
  const currentLayer = galleryLayers[gallery.activeLayer];

  nextLayer.alt = slide.caption || "";
  // إن فشل تحميل الصورة (رابط غير متاح أو انقطاع الشبكة) نستبدلها بصورة
  // مولّدة محلياً حتى لا تظهر شريحة فارغة أبداً.
  nextLayer.onerror = () => {
    nextLayer.onerror = null;
    nextLayer.src = generatePlaceholderImage(slide.caption || "", "#0a84ff");
  };
  nextLayer.onload = () => galleryImageCache.add(slide.src);
  nextLayer.src = slide.src;

  nextLayer.classList.add("is-active");
  currentLayer.classList.remove("is-active");
  gallery.activeLayer = 1 - gallery.activeLayer;

  galleryCaptionEl.textContent = slide.caption || "";
  Array.from(galleryDotsEl.children).forEach((dot, i) => {
    dot.classList.toggle("is-active", i === gallery.index);
  });

  // تجهيز الصورة التالية فقط (وليس كل الصور) — أداء أفضل وشبكة أقل.
  preloadGalleryImage(gallery.slides[(gallery.index + 1) % count].src);
}

function scheduleGalleryTick() {
  clearInterval(gallery.timer);
  if (!gallery.playing || gallery.slides.length < 2) return;
  gallery.timer = setInterval(() => showGallerySlide(gallery.index + 1), GALLERY_INTERVAL_MS);
}

function setGalleryPlaying(playing) {
  gallery.playing = playing;
  galleryPlayBtn.textContent = playing ? "⏸" : "▶";
  galleryPlayBtn.title = playing ? "إيقاف مؤقت للعرض التلقائي" : "متابعة العرض التلقائي";
  scheduleGalleryTick();
}

/** يبني معرض الصور لمعروض معيّن ويشغّله (يُستدعى عند فتح البطاقة فقط). */
function startGallery(objectId, objectName) {
  stopGallery();

  const registered = OBJECT_GALLERIES[objectId];
  gallery.slides = (registered && registered.length ? registered : [
    // احتياطي: الصورة المفردة القديمة، أو صورة مولّدة محلياً.
    { src: OBJECT_IMAGES[objectId] || generatePlaceholderImage(objectName, "#0a84ff"), caption: objectName },
  ]).slice(0, 4);

  // إخفاء موضع الفيديو التوضيحي عندما توجد صور حقيقية (لئلا يغطيها).
  if (galleryVideoPlaceholder) {
    galleryVideoPlaceholder.style.display = gallery.slides.length ? "none" : "";
  }

  // نقاط التنقل
  galleryDotsEl.innerHTML = "";
  gallery.slides.forEach((slide, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.title = `الصورة ${i + 1}`;
    dot.addEventListener("click", () => {
      showGallerySlide(i);
      scheduleGalleryTick(); // إعادة ضبط المؤقّت بعد تدخل الزائر
    });
    galleryDotsEl.appendChild(dot);
  });

  const showControls = gallery.slides.length > 1;
  [galleryPrevBtn, galleryNextBtn, galleryPlayBtn, galleryDotsEl].forEach((el) => {
    el.style.display = showControls ? "" : "none";
  });

  galleryLayers.forEach((layer) => layer.classList.remove("is-active"));
  gallery.activeLayer = 1; // ليبدأ العرض بالطبقة الأولى
  gallery.index = 0;
  showGallerySlide(0);
  setGalleryPlaying(true);
}

/** يوقف المعرض ويحرر مؤقّته (عند إغلاق البطاقة). */
function stopGallery() {
  clearInterval(gallery.timer);
  gallery.timer = null;
}

galleryPrevBtn.addEventListener("click", () => {
  showGallerySlide(gallery.index - 1);
  scheduleGalleryTick();
});
galleryNextBtn.addEventListener("click", () => {
  showGallerySlide(gallery.index + 1);
  scheduleGalleryTick();
});
galleryPlayBtn.addEventListener("click", () => setGalleryPlaying(!gallery.playing));

// -----------------------------------------------------------------------
// 22. قراءة الوصف العربي بصوت مسموع (Web Speech API) — إضافة جديدة
// -----------------------------------------------------------------------
// زر «🔊 استمع إلى الوصف» يقرأ النص العربي المعروض في البطاقة حرفياً
// (العنوان + الغرض + كيف يعمل + التطبيقات + المستقبل)، جملةً جملة، مع
// تظليل الجملة الجاري نطقها، وأزرار: إيقاف مؤقت / متابعة / إيقاف.
// القراءة جملة-بجملة تعطي: تظليلاً دقيقاً + نطقاً أكثر سلاسة + تفادياً
// لمشكلة انقطاع النطق في النصوص الطويلة ببعض المتصفحات.
// -----------------------------------------------------------------------
const synth = window.speechSynthesis;

// --- الصوت السحابي (معطّل بطلب المستخدم — انظر fetchServerSpeech) ---
// المسار المفضل: جلب WAV من ‎/tts‎ (صوت بشري طبيعي بنطق عربي صحيح).
// عند أي تعذر (لا مفتاح/لا خادم/لا إنترنت أول مرة): تراجع تلقائي صامت
// إلى صوت المتصفح (Web Speech) — الميزة لا تتعطل أبداً.
const ttsAudio = new Audio();
const ttsBlobCache = new Map(); // نص -> رابط Blob (ذاكرة الجلسة)

async function fetchServerSpeech(text) {
  // أُزيلت خدمة الصوت السحابي بناءً على طلب المستخدم (كانت تسبب بطئاً
  // عند أول توليد) — نفشل فوراً فينتقل السرد مباشرة إلى صوت المتصفح
  // دون أي انتظار شبكة. (صيغة fix1010 الصوتية).
  throw new Error("خدمة الصوت السحابي معطّلة");
  /* الشيفرة أدناه محفوظة للتفعيل مستقبلاً إن رُغب بإعادة الصوت السحابي:
  if (ttsBlobCache.has(text)) return ttsBlobCache.get(text);
  const response = await fetch("/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error(`tts ${response.status}`);
  const url = URL.createObjectURL(await response.blob());
  ttsBlobCache.set(text, url);
  return url;
  */
}

const narrateBtn = document.getElementById("narrate-btn");
const narratePauseBtn = document.getElementById("narrate-pause-btn");
const narrateResumeBtn = document.getElementById("narrate-resume-btn");
const narrateStopBtn = document.getElementById("narrate-stop-btn");
const narrationStatus = document.getElementById("narration-status");

const narration = {
  segments: [], // [{ el, text }]
  current: -1,
  speaking: false,
  voice: null,
  usingServerAudio: false, // true = صوت Gemini، false = صوت المتصفح الاحتياطي
  highlightPlan: [],       // حدود زمنية نسبية لتظليل الجمل مع صوت الخادم
};

/** يقسّم نصاً عربياً إلى جمل (مع الاحتفاظ بعلامات الترقيم). */
function splitArabicSentences(text) {
  const chunks = String(text || "").match(/[^.!؟?\n]+[.!؟?]*/g) || [];
  return chunks.map((chunk) => chunk.trim()).filter(Boolean);
}

/**
 * يكتب النص داخل العنصر مقسّماً إلى عناصر <span> لكل جملة، حتى يمكن
 * تظليل الجملة الجاري نطقها. النص المعروض مطابق تماماً للنص المنطوق.
 */
function setNarratableText(el, text) {
  el.innerHTML = "";
  const sentences = splitArabicSentences(text);
  if (!sentences.length) {
    el.textContent = text || "";
    return;
  }
  sentences.forEach((sentence, i) => {
    const span = document.createElement("span");
    span.className = "tts-sentence";
    span.textContent = sentence;
    el.appendChild(span);
    if (i < sentences.length - 1) el.appendChild(document.createTextNode(" "));
  });
}

/** يختار أفضل صوت عربي متاح في المتصفح (يفضّل الأصوات الطبيعية/السحابية). */
function pickBestArabicVoice() {
  const voices = synth ? synth.getVoices() : [];
  const arabicVoices = voices.filter((v) => (v.lang || "").toLowerCase().startsWith("ar"));
  if (!arabicVoices.length) return null;

  const scoreVoice = (v) => {
    const name = (v.name || "").toLowerCase();
    const lang = (v.lang || "").toLowerCase().replace("_", "-");
    let score = 0;
    if (name.includes("natural") || name.includes("neural")) score += 6; // أصوات عصبية عالية الجودة
    if (name.includes("google")) score += 5;
    if (name.includes("microsoft")) score += 2;
    if (!v.localService) score += 3; // الأصوات السحابية عادةً أوضح
    if (lang === "ar-sa") score += 4; // اللهجة الأقرب للجمهور المستهدف
    else if (["ar-xa", "ar-eg", "ar-ae", "ar-001"].includes(lang)) score += 2;
    else score += 1;
    return score;
  };

  return arabicVoices.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
}

if (synth) {
  // قائمة الأصوات تُحمَّل بشكل غير متزامن في أغلب المتصفحات.
  narration.voice = pickBestArabicVoice();
  synth.addEventListener("voiceschanged", () => {
    narration.voice = pickBestArabicVoice();
  });
}

function clearNarrationHighlight() {
  document.querySelectorAll(".tts-sentence.is-speaking").forEach((el) => el.classList.remove("is-speaking"));
}

function setNarrationUI(state) {
  // state: "idle" | "speaking" | "paused"
  narrateBtn.hidden = state !== "idle";
  narratePauseBtn.hidden = state !== "speaking";
  narrateResumeBtn.hidden = state !== "paused";
  narrateStopBtn.hidden = state === "idle";
}

/** يجمع جمل الوصف المعروضة بالترتيب، ويهيئ شريط الأزرار. */
function prepareNarration() {
  narration.segments = Array.from(
    document.querySelectorAll("#object-modal-title .tts-sentence, .object-modal-body .object-section p .tts-sentence")
  ).map((el) => ({ el, text: el.textContent }));
  narration.current = -1;

  setNarrationUI("idle");
  if (!synth) {
    narrateBtn.disabled = true;
    narrationStatus.textContent = "متصفحك لا يدعم القراءة الصوتية.";
    return;
  }
  narrateBtn.disabled = false;
  narrationStatus.textContent = "";
}

/** ينطق الجملة التالية في الطابور. */
function speakSegment(index) {
  if (!synth || index >= narration.segments.length) {
    stopNarration();
    return;
  }

  narration.current = index;
  const segment = narration.segments[index];

  const utterance = new SpeechSynthesisUtterance(segment.text);
  utterance.lang = (narration.voice && narration.voice.lang) || "ar-SA";
  if (narration.voice) utterance.voice = narration.voice;
  utterance.rate = 0.95; // إيقاع هادئ يناسب السرد التعليمي
  utterance.pitch = 1;
  utterance.volume = 1;

  utterance.onstart = () => {
    clearNarrationHighlight();
    segment.el.classList.add("is-speaking");
    narrationStatus.textContent = `جارٍ القراءة… (${index + 1}/${narration.segments.length})`;
  };
  utterance.onend = () => {
    segment.el.classList.remove("is-speaking");
    if (narration.speaking) speakSegment(index + 1);
  };
  utterance.onerror = () => {
    segment.el.classList.remove("is-speaking");
    if (narration.speaking) speakSegment(index + 1);
  };

  synth.speak(utterance);
}

async function startNarration() {
  if (!narration.segments.length) return;
  stopNarration();
  narration.speaking = true;
  setNarrationUI("speaking");

  // المسار المفضل: صوت Gemini الطبيعي من الخادم (نطق عربي بشري صحيح).
  const fullText = narration.segments.map((seg) => seg.text).join(" ");
  try {
    const url = await fetchServerSpeech(fullText);
    if (!narration.speaking) return; // أُوقف أثناء التجهيز

    // خطة تظليل الجمل: توزيع مدة الصوت على الجمل بنسبة أطوالها —
    // تقريب جيد جداً لأن سرعة النطق شبه ثابتة داخل الوصف الواحد.
    const totalChars = narration.segments.reduce((sum, seg) => sum + seg.text.length, 0) || 1;
    let acc = 0;
    narration.highlightPlan = narration.segments.map((seg) => {
      const start = acc / totalChars;
      acc += seg.text.length;
      return { start, end: acc / totalChars, el: seg.el };
    });

    narration.usingServerAudio = true;
    ttsAudio.src = url;
    ttsAudio.currentTime = 0;
    await ttsAudio.play();
    narrationStatus.textContent = "جارٍ القراءة… (صوت طبيعي)";
    return;
  } catch (err) {
    console.warn("[tts] تعذر صوت الخادم — تراجع إلى صوت المتصفح:", err);
  }

  // المسار الاحتياطي: صوت المتصفح كما كان.
  if (!synth) {
    stopNarration();
    narrationStatus.textContent = "متصفحك لا يدعم القراءة الصوتية.";
    return;
  }
  narration.usingServerAudio = false;
  if (!narration.voice) narration.voice = pickBestArabicVoice();
  speakSegment(0);
}

// تظليل الجملة الجارية أثناء تشغيل صوت الخادم + إنهاء نظيف عند الاكتمال.
ttsAudio.addEventListener("timeupdate", () => {
  if (!narration.usingServerAudio || !narration.speaking || !ttsAudio.duration) return;
  const progress = ttsAudio.currentTime / ttsAudio.duration;
  narration.highlightPlan.forEach((plan, i) => {
    const active = progress >= plan.start && progress < plan.end;
    plan.el.classList.toggle("is-speaking", active);
    if (active && narration.current !== i) {
      narration.current = i;
      narrationStatus.textContent = `جارٍ القراءة… (${i + 1}/${narration.highlightPlan.length})`;
    }
  });
});
ttsAudio.addEventListener("ended", () => {
  if (narration.usingServerAudio) stopNarration();
});

function stopNarration() {
  narration.speaking = false;
  narration.current = -1;
  narration.usingServerAudio = false;
  ttsAudio.pause();
  ttsAudio.currentTime = 0;
  if (synth) synth.cancel();
  clearNarrationHighlight();
  setNarrationUI("idle");
  if (narrationStatus) narrationStatus.textContent = "";
}

narrateBtn.addEventListener("click", startNarration);
narratePauseBtn.addEventListener("click", () => {
  if (narration.usingServerAudio) ttsAudio.pause();
  else if (synth) synth.pause();
  setNarrationUI("paused");
  narrationStatus.textContent = "متوقف مؤقتاً";
});
narrateResumeBtn.addEventListener("click", () => {
  if (narration.usingServerAudio) ttsAudio.play();
  else if (synth) synth.resume();
  setNarrationUI("speaking");
  narrationStatus.textContent = "جارٍ القراءة…";
});
narrateStopBtn.addEventListener("click", stopNarration);

/**
 * ينطق نصاً عربياً كاملاً (جملةً جملة، بأفضل صوت عربي متاح) دون تظليل —
 * تستخدمها لوحة المعلومات ثلاثية الأبعاد في وضع الواقع الافتراضي، حيث لا
 * وجود لعناصر HTML يمكن تظليلها.
 */
async function speakArabicText(text) {
  if (!text) return;
  ttsAudio.pause();
  if (synth) synth.cancel();
  // المسار المفضل: صوت Gemini الطبيعي.
  try {
    const url = await fetchServerSpeech(text);
    narration.usingServerAudio = false; // لوحة VR لا تظلل جملاً
    ttsAudio.src = url;
    ttsAudio.currentTime = 0;
    await ttsAudio.play();
    return;
  } catch (err) {
    console.warn("[tts] تعذر صوت الخادم في VR — تراجع إلى صوت المتصفح:", err);
  }
  if (!synth) return;
  if (!narration.voice) narration.voice = pickBestArabicVoice();
  splitArabicSentences(text).forEach((sentence) => {
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.lang = (narration.voice && narration.voice.lang) || "ar-SA";
    if (narration.voice) utterance.voice = narration.voice;
    utterance.rate = 0.95;
    synth.speak(utterance);
  });
}

/**
 * جسر عام: تشغيل/إيقاف قراءة نص عربي — تستخدمه لوحة «سعود» (career_ai.js)
 * لقراءة إجاباته صوتياً بنفس خط الأنابيب (صوت Groq الطبيعي ← صوت المتصفح).
 * نقرة أولى = قراءة، نقرة أثناء التشغيل = إيقاف.
 */
window.ExhibitVoice = {
  isPlaying: () => (!ttsAudio.paused && !ttsAudio.ended) || (synth && synth.speaking),
  stop: () => {
    ttsAudio.pause();
    ttsAudio.currentTime = 0;
    if (synth) synth.cancel();
  },
  toggle(text) {
    if (this.isPlaying()) {
      this.stop();
      return false; // توقّف
    }
    speakArabicText(text);
    return true; // بدأ
  },
};

// إيقاف الصوت عند مغادرة الصفحة (سلوك متوقع في المتصفحات).
window.addEventListener("beforeunload", () => {
  ttsAudio.pause();
  if (synth) synth.cancel();
});

// -----------------------------------------------------------------------
// 23. ترقية البيئة البصرية — طبقة تزيين إضافية (لا تمسّ أي وظيفة قائمة)
// -----------------------------------------------------------------------
// تضيف: صوراً تعليمية مؤطرة على الجدران، وحدات إضاءة سقفية، أشرطة LED،
// نباتات زينة، مقاعد، لوحات إرشادية، وحلقات إبراز تحت المعروضات — كلها
// أجسام خفيفة (خامات باعثة بدل أضواء حقيقية إضافية) حفاظاً على الأداء.
// -----------------------------------------------------------------------


/**
 * يسم شبكة كـ«زينة ثابتة قابلة للدمج»: تُدمج لاحقاً مع مثيلاتها التي
 * تشترك في الخامة نفسها في شبكة واحدة — فينخفض عدد نداءات الرسم
 * (draw calls) بشكل كبير دون أي تغيير في المظهر.
 */
function markMergeable(object) {
  object.traverse((child) => {
    if (child.isMesh) child.userData.mergeable = true;
  });
  return object;
}

const decorTextureLoader = new THREE.TextureLoader();
decorTextureLoader.setCrossOrigin("anonymous");

/**
 * صورة تعليمية مؤطرة على جدار: إطار معدني داكن + حاشية + الصورة نفسها.
 * الصورة تُحمَّل بشكل غير متزامن (بنسخة مصغّرة 640px من ويكيميديا كومنز —
 * تراخيص حرة) ولا توقف بناء المشهد؛ قبل اكتمال التحميل تظهر لوحة داكنة.
 */
// خامة مشتركة للوحة السماوية الفاتحة خلف كل صورة (قسم عرض مميز)
const pictureBackdropMaterial = new THREE.MeshStandardMaterial({
  color: 0xcfe6fa, // أزرق سماوي فاتح
  roughness: 0.6,
  metalness: 0.1,
  emissive: 0x9fccf0,
  emissiveIntensity: 0.12, // توهج خفيف يبرز الصورة دون مبالغة
});

function addFramedPicture(x, y, z, rotY, url, width = 2.2, height = 1.45) {
  const group = new THREE.Group();

  // لوحة خلفية سماوية فاتحة تحيط بالإطار (لا تغيّر الإطار ولا الصورة ولا
  // موضعهما — مجرد قسم عرض مميز خلفهما، متسق في كل الغرف).
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(width + 0.7, height + 0.6),
    pictureBackdropMaterial
  );
  backdrop.position.z = -0.035;
  markMergeable(backdrop);
  group.add(backdrop);

  // الإطار الخارجي (معدن داكن بحواف مشطوفة بصرياً عبر طبقتين)
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.14, height + 0.14, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x11161f, metalness: 0.85, roughness: 0.35 })
  );
  markMergeable(frame);
  group.add(frame);

  // حاشية داخلية فاتحة (Mat) كما في المعارض الحقيقية
  const mat = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.04, height + 0.04, 0.062),
    new THREE.MeshStandardMaterial({ color: 0xd8dee9, metalness: 0.1, roughness: 0.9 })
  );
  markMergeable(mat);
  group.add(mat);

  // لوحة الصورة — داكنة إلى أن تكتمل الصورة
  const pictureMaterial = new THREE.MeshStandardMaterial({ color: 0x1a2230, roughness: 0.6 });
  const picture = new THREE.Mesh(new THREE.PlaneGeometry(width, height), pictureMaterial);
  picture.position.z = 0.036;
  group.add(picture);

  // معالج نجاح موحّد (للمحاولة الأولى والاحتياطية): يطبق قصّ «التغطية»
  // الحافظ لنسبة الأبعاد — لا تمديد ولا تشويه، والإطار لا يتغير حجمه.
  const applyWallTexture = (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const frameAspect = width / height;
    const imgAspect = texture.image.width / texture.image.height;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    if (imgAspect > frameAspect) {
      // الصورة أعرض من الإطار: نعرض شريحتها الوسطى أفقياً
      texture.repeat.set(frameAspect / imgAspect, 1);
      texture.offset.set((1 - texture.repeat.x) / 2, 0);
    } else {
      // الصورة أطول من الإطار: نعرض شريحتها الوسطى رأسياً
      texture.repeat.set(1, imgAspect / frameAspect);
      texture.offset.set(0, (1 - texture.repeat.y) / 2);
    }
    pictureMaterial.map = texture;
    pictureMaterial.color.set(0xffffff);
    pictureMaterial.needsUpdate = true;
  };

  decorTextureLoader.load(
    url,
    applyWallTexture,
    undefined,
    () => {
      // محاولة ثانية: إن كان الفشل بسبب غياب وسيط /wallimg (استضافة ثابتة
      // بلا خادم بايثون) نجرّب رابط ويكيميديا المباشر قبل الاستسلام.
      const proxyMatch = /^\/wallimg\?f=([^&]+)&w=(\d+)/.exec(url);
      if (proxyMatch && !group.userData.retriedDirect) {
        group.userData.retriedDirect = true;
        const directUrl =
          "https://commons.wikimedia.org/wiki/Special:FilePath/" +
          proxyMatch[1] + "?width=" + proxyMatch[2];
        decorTextureLoader.load(
          directUrl,
          applyWallTexture, // نفس القصّ الحافظ للنسبة في المحاولة الثانية
          undefined,
          () => console.warn("[جدران] تعذر تحميل صورة الجدار:", url)
        );
        return;
      }
      // فشل التحميل نهائياً — لوحة بديلة أنيقة بدل فراغ.
      console.warn("[جدران] تعذر تحميل صورة الجدار:", url);
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 340;
      const c = canvas.getContext("2d");
      const grad = c.createLinearGradient(0, 0, 512, 340);
      grad.addColorStop(0, "#13233d");
      grad.addColorStop(1, "#0a1426");
      c.fillStyle = grad;
      c.fillRect(0, 0, 512, 340);
      c.font = "120px sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.globalAlpha = 0.45;
      c.fillText("🖼️", 256, 170);
      const fallback = new THREE.CanvasTexture(canvas);
      fallback.colorSpace = THREE.SRGBColorSpace;
      pictureMaterial.map = fallback;
      pictureMaterial.color.set(0xffffff);
      pictureMaterial.needsUpdate = true;
    }
  );

  // شريط LED خفيف أعلى الإطار (خامة باعثة — بلا ضوء حقيقي إضافي)
  const ledBar = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.7, 0.035, 0.035),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xbfe3ff, emissiveIntensity: 1.6 })
  );
  ledBar.position.set(0, height / 2 + 0.18, 0.05);
  markMergeable(ledBar);
  group.add(ledBar);

  group.position.set(x, y, z);
  group.rotation.y = rotY;
  scene.add(group);
  return group;
}

/** صف صور مؤطرة موزّعة بتباعد منتظم على جدار واحد. */
function addPictureRow(urls, wallX, wallZ, rotY, alongAxis, start, step, y = 2.6) {
  urls.forEach((url, i) => {
    const t = start + i * step;
    const x = alongAxis === "x" ? t : wallX;
    const z = alongAxis === "x" ? wallZ : t;
    addFramedPicture(x, y, z, rotY, url);
  });
}

/** وحدة إضاءة سقفية دائرية (قرص باعث + هالة) — عنصر بصري بلا كلفة إضاءة. */
function addCeilingFixture(x, z, y = 6.6, color = 0xdfefff) {
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.08, 24),
    new THREE.MeshStandardMaterial({ color: 0x0e1420, emissive: color, emissiveIntensity: 2.2, roughness: 0.4 })
  );
  disc.position.set(x, y, z);
  markMergeable(disc);
  scene.add(disc);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.03, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0x1a2432, metalness: 0.8, roughness: 0.3 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, y, z);
  markMergeable(ring);
  scene.add(ring);
}

/** شريط LED جداري ممتد (خامة باعثة). */
function addLedStrip(x, y, z, length, rotY, color) {
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.05, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x0b0f18, emissive: color, emissiveIntensity: 2.4 })
  );
  strip.position.set(x, y, z);
  strip.rotation.y = rotY;
  markMergeable(strip); // الخامة تبقى مشتركة فيظل خفقان LED يعمل بعد الدمج
  scene.add(strip);
  ledStrips.push(strip.material);
}
const ledStrips = []; // للخفقان الخفيف في حلقة التحريك

/** نبتة زينة إجرائية بسيطة: أصيص + أوراق مخروطية بأحجام متدرجة. */
function addPlant(x, z) {
  const group = new THREE.Group();
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.34, 0.45, 14),
    new THREE.MeshStandardMaterial({ color: 0x2a2f3a, metalness: 0.4, roughness: 0.5 })
  );
  pot.position.y = 0.225;
  pot.castShadow = true;
  group.add(pot);

  const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x1f7a4d, roughness: 0.8 });
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.85 - i * 0.08, 6), leafMaterial);
    const angle = (i / 5) * Math.PI * 2;
    leaf.position.set(Math.cos(angle) * 0.12, 0.75 + i * 0.05, Math.sin(angle) * 0.12);
    leaf.rotation.set(Math.cos(angle) * 0.35, 0, Math.sin(angle) * 0.35);
    leaf.castShadow = true;
    group.add(leaf);
  }
  group.position.set(x, 0, z);
  markMergeable(group);
  scene.add(group);
}

/** مقعد معرض عصري: قاعدة معدنية + سطح خشبي فاتح. */
function addBench(x, z, rotY = 0) {
  const group = new THREE.Group();
  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.1, 0.55),
    new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.6 })
  );
  seat.position.y = 0.48;
  seat.castShadow = true;
  group.add(seat);
  [-0.85, 0.85].forEach((dx) => {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.46, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x1a2028, metalness: 0.8, roughness: 0.3 })
    );
    leg.position.set(dx, 0.23, 0);
    group.add(leg);
  });
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  markMergeable(group);
  scene.add(group);
}

/** لوحة إرشادية ثابتة (سهم + اسم الغرفة بالعربية) — لا تدور مع الزائر. */
function addDirectionalSign(x, z, text, rotY) {
  const canvas = document.createElement("canvas");
  // عرض تلقائي حسب طول الجملة: يُقاس النص أولاً فتتسع اللوحة له كاملاً
  // («↑ غرفة هندسة الطاقة المتجددة» أعرض من 768 بكسل فكانت تُقتطع).
  const measurer = document.createElement("canvas").getContext("2d");
  measurer.font = "bold 62px 'Cairo', 'Tajawal', Arial";
  const textWidth = measurer.measureText(text).width;
  canvas.width = Math.max(768, Math.ceil(textWidth) + 160); // هامش 80px لكل جهة
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(10, 18, 34, 0.92)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(62, 166, 255, 0.8)";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#eaf2ff";
  ctx.font = "bold 62px 'Cairo', 'Tajawal', Arial";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4);

  const sign = new THREE.Mesh(
    // عرض اللوح يتبع نسبة أبعاد اللوحة — فلا اقتطاع ولا تمديد مهما طال النص.
    new THREE.PlaneGeometry(0.72 * (canvas.width / canvas.height), 0.72),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true })
  );
  sign.position.set(x, 3.4, z);
  sign.rotation.y = rotY;
  scene.add(sign);
}

/** حلقة إبراز أرضية تحت معروض (بديل أداءً لضوء Spot حقيقي لكل معروض). */
function addExhibitHighlight(x, z, color, radius = 1.15) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius, radius + 0.09, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.035, z);
  markMergeable(ring);
  scene.add(ring);
}

function upgradeEnvironment() {
  // ---------- 1) الصور التعليمية المؤطرة على جدران كل غرفة ----------
  // اختيار منسّق يدوياً من صور معارض معروضات كل غرفة (ويكيميديا كومنز —
  // تراخيص حرة): صور فوتوغرافية احترافية فقط (استُبعدت المخططات وSVG التي
  // لا تصلح كلوحات جدارية ولا تُفك كخامات WebGL)، بلا أي تكرار داخل
  // الغرفة الواحدة، وبأسلوب بصري متسق — كمتحف جامعي حقيقي.
  // ملاحظة: معارض بطاقات المعروضات نفسها لم تُمس إطلاقاً.
  // اختيار مصدر صور الجدران حسب بيئة الاستضافة:
  //   • تشغيل محلي (localhost أو عنوان شبكة خاصة) -> وسيط الخادم /wallimg
  //     (يخزّن الصور على القرص فتعمل العروض بلا إنترنت).
  //   • استضافة عامة ثابتة (Vercel / GitHub Pages...) -> رابط ويكيميديا
  //     المباشر فوراً، لأن الوسيط غير موجود هناك أصلاً — هذا سبب اختفاء
  //     صور الجدران على الاستضافة الثابتة سابقاً.
  const isLocalHost = (() => {
    const host = window.location.hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      /^192\.168\./.test(host) ||
      /^10\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    );
  })();
  const wallImg = (fileName) =>
    isLocalHost
      ? `/wallimg?f=${encodeURIComponent(fileName)}&w=640`
      : `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=640`;

  // غرفة الطاقة المتجددة: شمسي/رياح/تخزين/محولات/تحكم — بترتيب موضوعي
  const renewableWall = [
    wallImg("Giant photovoltaic array.jpg"),                  // مصفوفة كهروضوئية
    wallImg("Installing Solar Panels (7336033672).jpg"),      // تركيب الألواح
    wallImg("Bruce A. Henry Solar Farm.jpg"),                 // محطة شمسية
    wallImg("Barrow Offshore wind turbines NR.jpg"),          // توربينات بحرية
    wallImg("Windfarm off the Kent coast (26339012935).jpg"), // مزرعة رياح
    wallImg("Elfmorgenbruch 220kV-Transformator.jpg"),        // محول قدرة
    wallImg("Power plant control room.jpg"),                  // غرفة التحكم
  ];
  // مُحدَّثة لأبعاد الغرفة الموسّعة (26×46): الجدران الآن عند z=±23 و x=±53
  // بالنسبة لمركز الغرفة (-40). كانت الصور معلّقة في الهواء عند ±15 لأنها
  // بقيت على أبعاد الغرفة القديمة — الآن ملتصقة بالجدار تماماً وموزّعة على
  // طول الجدار الأعرض والأعمق.
  addPictureRow(renewableWall.slice(0, 3), null, -22.85, 0, "x", -48, 8);
  addPictureRow(renewableWall.slice(3, 6), null, 22.85, Math.PI, "x", -48, 8);
  // الجدار الغربي أعمق الآن (z من -23 إلى +23)؛ نضع الصورة السابعة في نصفه
  // الخلفي بعيداً عن ملصق الغرفة (ROOM_POSTERS) الذي يشغل المنتصف.
  addPictureRow(renewableWall.slice(6, 7), -52.85, null, Math.PI / 2, "z", -14, 0);

  // غرفة «الهندسة الكهربائية كطالب»: حياة الطالب الفعلية — مختبرات
  // الإلكترونيات والقياس والقدرة (الأسماء تُدقَّق آلياً في فحص الصور).
  const eeStudentWall = [
    wallImg("Oscilloscope.jpg"),                     // راسم الإشارة
    wallImg("Breadboard complex.jpg"),                                // لوحة تجارب
    wallImg("Digital Multimeter Aka.jpg"),                            // القياس المتعدد
    wallImg("Breadboard complex.jpg"),          // مختبر إلكترونيات
    wallImg("Arduino Uno - R3.jpg"),                                  // لوحة معالج
    wallImg("Stator and rotor by Zureks.JPG"),                     // آلات كهربائية
    wallImg("Siemens PLC S7-200 CPU.jpg"),                                // تحكم صناعي
  ];
  addPictureRow(eeStudentWall.slice(0, 3), null, -49.85, 0, "x", -6, 6);
  addPictureRow(eeStudentWall.slice(3, 5), -14.85, null, Math.PI / 2, "z", -44, 8);
  addPictureRow(eeStudentWall.slice(5, 7), 14.85, null, -Math.PI / 2, "z", -44, 8);

  // البهو: لوحتان جامعتان لروح المعرض (تدريب افتراضي + محاكاة صناعية)
  addPictureRow(
    [
      wallImg("ISS-50 Shane Kimbrough uses a virtual reality headset in the Destiny lab.jpg"),
      wallImg("Seabery AR Welding Simulator in use.jpg"),
    ],
    null, 10.85, Math.PI, "x", -3, 6
  );

  // ---------- 2) وحدات الإضاءة السقفية ----------
  [[0, 0], [0, 6], [0, -6], [6, 0], [-6, 0]].forEach(([x, z]) => addCeilingFixture(x, z));
  // الطاقة المتجددة (26×46): تغطية النصفين الأمامي والخلفي بعد التوسعة
  [[-40, -8], [-40, 0], [-40, 8], [-35, -4], [-45, 4], [-40, -16], [-40, 16], [-35, 12], [-45, -12]].forEach(([x, z]) => addCeilingFixture(x, z));
  // غرفة «الهندسة الكهربائية كطالب»
  [[-8, -40], [0, -40], [8, -40], [-4, -35], [4, -45]].forEach(([x, z]) => addCeilingFixture(x, z));

  // ---------- 3) أشرطة LED أعلى جدران كل غرفة ----------
  addLedStrip(-40, 6.4, -22.8, 25.6, 0, COLORS.renewable);
  addLedStrip(-40, 6.4, 22.8, 25.6, 0, COLORS.renewable);
  addLedStrip(0, 6.4, -49.8, 29.6, 0, COLORS.eeStudent);
  addLedStrip(-14.8, 6.4, -40, 19.6, Math.PI / 2, COLORS.eeStudent);
  addLedStrip(14.8, 6.4, -40, 19.6, Math.PI / 2, COLORS.eeStudent);
  addLedStrip(0, 6.4, 10.8, 21.6, 0, COLORS.neon);

  // ---------- 4) النباتات والمقاعد (في مواضع لا تعترض الممرات) ----------
  [[-8.5, 8.5], [8.5, 8.5], [-8.5, -8.5], [8.5, -8.5]].forEach(([x, z]) => addPlant(x, z));
  [[-48.5, -13.5], [-48.5, 13.5], [-48.5, -20.5], [-48.5, 20.5], [-13.5, -48.5], [13.5, -48.5]].forEach(([x, z]) => addPlant(x, z));
  addBench(0, 8.8, 0);
  addBench(-40, 13.5, Math.PI);
  addBench(13.2, -40, Math.PI / 2);

  // ---------- 5) اللوحات الإرشادية عند مخارج البهو ----------
  addDirectionalSign(-8.2, 0, "↑ غرفة هندسة الطاقة المتجددة", Math.PI / 2);
  addDirectionalSign(0, -8.2, "↑ غرفة الهندسة الكهربائية كطالب", 0);

  // ---------- 6) حلقات إبراز تحت المعروضات + ضوء Spot واحد لكل غرفة ----------
  // (Spot حقيقي واحد فقط للمعروض البطل في كل غرفة — توازن جودة/أداء)
  interactiveObjects.forEach((obj) => {
    if (!obj.userData || !obj.userData.interactive || !obj.userData.categoryId) return;
    const color = COLORS[
      { renewable_energy: "renewable", ee_student: "eeStudent" }[obj.userData.categoryId]
    ] || COLORS.neon;
    addExhibitHighlight(obj.position.x, obj.position.z, color);
  });

  const heroSpot = (x, z, targetY, color) => {
    const spot = new THREE.SpotLight(color, 55, 14, Math.PI / 7, 0.45, 1.6);
    spot.position.set(x, 7, z);
    spot.target.position.set(x, targetY, z);
    scene.add(spot);
    scene.add(spot.target);
  };
  heroSpot(-46, -8, 0.8, 0xffffff); // اللوح الشمسي
  heroSpot(-5, -33.5, 1.0, 0xffffff); // لوحة الخطة الدراسية (غرفة الهندسة الكهربائية)
}

upgradeEnvironment();

// خفقان خفيف جداً لأشرطة LED (حيوية بصرية بلا كلفة تُذكر) — يُحدَّث في
// حلقة التحريك عبر ledPulse().
let ledClock = 0;
function ledPulse(delta) {
  ledClock += delta;
  const pulse = 2.1 + Math.sin(ledClock * 1.6) * 0.5;
  for (let i = 0; i < ledStrips.length; i++) ledStrips[i].emissiveIntensity = pulse;
}

// -----------------------------------------------------------------------
// 24. جودة تكيفية — يضبط دقة العرض تلقائياً حسب معدل الإطارات الفعلي
// -----------------------------------------------------------------------
// يقيس FPS على نافذة متحركة؛ إن هبط الأداء يخفض دقة البكسل تدريجياً
// (ثم يطفئ الظلال في أدنى مستوى)، وإن ارتفع الأداء واستقر يرفعها مجدداً.
// النتيجة: تجربة سلسة على الأجهزة الضعيفة وجودة كاملة على القوية —
// دون أي تدخل من الزائر.
const adaptive = {
  levels: [
    { ratio: Math.min(window.devicePixelRatio, 2), shadows: true },  // جودة كاملة
    { ratio: 1.25, shadows: true },
    { ratio: 1.0, shadows: true },
    { ratio: 0.85, shadows: false },                                  // وضع الطوارئ
  ],
  current: 0,
  frames: 0,
  elapsed: 0,
  cooldown: 0,
};

function applyAdaptiveLevel(i) {
  adaptive.current = Math.max(0, Math.min(adaptive.levels.length - 1, i));
  const level = adaptive.levels[adaptive.current];
  renderer.setPixelRatio(level.ratio);
  renderer.shadowMap.enabled = level.shadows;
  // إجبار الخامات على الالتقاط عند تبديل حالة الظلال
  scene.traverse((o) => {
    if (o.material) o.material.needsUpdate = true;
  });
  console.log(`[أداء] مستوى الجودة: ${adaptive.current} (دقة ${level.ratio}${level.shadows ? "" : "، بلا ظلال"})`);
}

function adaptiveQualityTick(delta) {
  // داخل جلسة VR تتولى النظارة إدارة الدقة (foveation) — لا نتدخل.
  if (renderer.xr.isPresenting) return;
  adaptive.frames += 1;
  adaptive.elapsed += delta;
  adaptive.cooldown -= delta;
  if (adaptive.elapsed < 2) return; // قياس كل ثانيتين

  const fps = adaptive.frames / adaptive.elapsed;
  adaptive.frames = 0;
  adaptive.elapsed = 0;
  if (adaptive.cooldown > 0) return; // مهلة بين التبديلات لتفادي التذبذب

  if (fps < 40 && adaptive.current < adaptive.levels.length - 1) {
    applyAdaptiveLevel(adaptive.current + 1);
    adaptive.cooldown = 3;
  } else if (fps > 57 && adaptive.current > 0) {
    applyAdaptiveLevel(adaptive.current - 1);
    adaptive.cooldown = 6; // الرفع أبطأ من الخفض (حذر)
  }
}

// -----------------------------------------------------------------------
// 25. هوية بصرية مميزة لكل غرفة — ألوان وخامات الجدران والأرضيات والأسقف
// -----------------------------------------------------------------------
// طبقة تصميم داخلي إضافية بالكامل (لا تعديل على الدوال أو الوظائف القائمة):
// لكل غرفة لوحة ألوان تعكس تخصصها، بأسطح متعددة الخامات لا طلاءً واحداً:
//   - الطاقة المتجددة: أخضر مستدام + خشب طبيعي دافئ + أبيض فاتح.
//   - الذكاء الاصطناعي: كحلي عميق + أزرق كهربائي + لمسات بنفسجية معدنية.
//   - الروبوتات الجراحية: أبيض طبي + فولاذ مصقول + إضاءة زرقاء ناعمة.
//   - البهو: هوية المعرض (أزرق نيون على قاتم أنيق).
// كل الخامات مشتركة (instance واحد لكل خامة) وبلا ظلال إضافية — أداء آمن.
// -----------------------------------------------------------------------

function applyRoomThemes() {
  // ---------- الخامات المشتركة لكل ثيم ----------
  const M = {
    // الطاقة المتجددة (استدامة مشرقة: أبيض/أخضر/سماوي/خشب فاتح)
    renewFloor: new THREE.MeshStandardMaterial({ color: 0xf3efe4, roughness: 0.7, metalness: 0.05 }),
    renewBorder: new THREE.MeshStandardMaterial({ color: 0x59c98e, roughness: 0.5, emissive: 0x2f9d6a, emissiveIntensity: 0.35 }),
    renewWood: new THREE.MeshStandardMaterial({ color: 0xc9a97c, roughness: 0.55, metalness: 0.05 }),
    renewUpper: new THREE.MeshStandardMaterial({ color: 0xf6faf4, roughness: 0.9 }),
    renewCeil: new THREE.MeshStandardMaterial({ color: 0xfaf7ee, roughness: 0.9 }),
    // الذكاء الاصطناعي (أزرق فاتح نظيف: أبيض/أزرق سماوي/لمسات سيان — بلا كحلي داكن)
    aiFloor: new THREE.MeshStandardMaterial({ color: 0xe6f0fa, roughness: 0.35, metalness: 0.15 }),
    aiTrack: new THREE.MeshStandardMaterial({ color: 0xd8f4ff, emissive: 0x36c9ff, emissiveIntensity: 1.1 }),
    aiPanel: new THREE.MeshStandardMaterial({ color: 0xcfe3f5, roughness: 0.35, metalness: 0.35 }),
    aiUpper: new THREE.MeshStandardMaterial({ color: 0xf0f7fd, roughness: 0.8 }),
    aiAccent: new THREE.MeshStandardMaterial({ color: 0xdcf3ff, emissive: 0x49d6ff, emissiveIntensity: 0.8, metalness: 0.4, roughness: 0.35 }),
    aiCeil: new THREE.MeshStandardMaterial({ color: 0xf4f9fe, roughness: 0.9 }),
    // الروبوتات الجراحية (طبي مشرق: أبيض/فضي/أزرق ناعم)
    surgFloor: new THREE.MeshStandardMaterial({ color: 0xf0f4f8, roughness: 0.35, metalness: 0.1 }),
    surgSteel: new THREE.MeshStandardMaterial({ color: 0xd6dde4, roughness: 0.22, metalness: 0.85 }),
    surgUpper: new THREE.MeshStandardMaterial({ color: 0xfafcfe, roughness: 0.85 }),
    surgBlue: new THREE.MeshStandardMaterial({ color: 0xe7f2ff, emissive: 0x8fc3ff, emissiveIntensity: 0.8, roughness: 0.5 }),
    surgCeil: new THREE.MeshStandardMaterial({ color: 0xfbfdff, roughness: 0.9 }),
    // البهو والممرات (بهو فندق فاخر: رخام كريمي/أبيض دافئ/ذهبي شمبانيا)
    lobbyFloor: new THREE.MeshStandardMaterial({ color: 0xf2ead9, roughness: 0.25, metalness: 0.1 }),
    lobbyPanel: new THREE.MeshStandardMaterial({ color: 0xf6f0e3, roughness: 0.65, metalness: 0.1 }),
    lobbyGold: new THREE.MeshStandardMaterial({ color: 0xd8b878, roughness: 0.3, metalness: 0.8, emissive: 0x8a6a30, emissiveIntensity: 0.35 }),
    lobbyCeil: new THREE.MeshStandardMaterial({ color: 0xfaf5ea, roughness: 0.9 }),
  };

  // ---------- أدوات البناء ----------
  /** غطاء أرضية ملوّن فوق الأرضية العامة (بارتفاع طفيف يمنع التداخل). */
  function floorOverlay(cx, cz, sx, sz, material, y = 0.012) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cx, y, cz);
    mesh.receiveShadow = true;
    markMergeable(mesh);
    scene.add(mesh);
  }

  /** سقف مستوٍ للغرفة. */
  function ceiling(cx, cz, sx, sz, material, y = 7) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), material);
    mesh.rotation.x = Math.PI / 2; // وجهه للأسفل
    mesh.position.set(cx, y, cz);
    markMergeable(mesh);
    scene.add(mesh);
  }

  /** لوح جداري (يُستخدم للحزام السفلي والعلوي) — مستوٍ رفيع أمام الجدار. */
  function wallBand(cx, cz, len, rotY, material, y, h) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, h), material);
    mesh.position.set(cx, y, cz);
    mesh.rotation.y = rotY;
    markMergeable(mesh);
    scene.add(mesh);
  }

  /** عمود زخرفي رأسي في زوايا الغرفة. */
  function cornerPillar(x, z, material, h = 7) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, h, 0.4), material);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    markMergeable(mesh);
    scene.add(mesh);
  }

  /**
   * يكسو غرفة كاملة: حزام سفلي (Wainscot) + حزام علوي + أعمدة زوايا،
   * مع فجوة عند فتحة الباب. تعريف الجدار: {cx,cz,len,rotY,gapAt,gapHalf}
   * حيث gapAt إحداثي مركز الفتحة على محور امتداد الجدار (أو null).
   */
  function dressRoom(walls, lowerMat, upperMat, accentMat, inset = 0.08) {
    walls.forEach((w) => {
      const axis = w.rotY === 0 || w.rotY === Math.PI ? "x" : "z";
      const c = axis === "x" ? w.cx : w.cz;
      const segments = [];
      if (w.gapAt === null || w.gapAt === undefined) {
        segments.push([c - w.len / 2, c + w.len / 2]);
      } else {
        segments.push([c - w.len / 2, w.gapAt - w.gapHalf]);
        segments.push([w.gapAt + w.gapHalf, c + w.len / 2]);
      }
      segments.forEach(([a, b]) => {
        if (b - a < 0.5) return;
        const mid = (a + b) / 2;
        const len = b - a;
        const px = axis === "x" ? mid : w.cx;
        const pz = axis === "x" ? w.cz : mid;
        wallBand(px, pz, len, w.rotY, lowerMat, 0.55, 1.1);   // الحزام السفلي
        wallBand(px, pz, len, w.rotY, accentMat, 1.16, 0.06); // شريط فاصل مضيء
        wallBand(px, pz, len, w.rotY, upperMat, 5.55, 2.9);   // الحزام العلوي
      });
    });
  }

  /** ضوء أجواء خفيف بلون الثيم (بلا ظلال — كلفة شبه معدومة). */
  function moodLight(x, z, color, intensity, distance = 42) {
    const light = new THREE.PointLight(color, intensity, distance, 2);
    light.position.set(x, 5.5, z);
    scene.add(light);
  }

  const IN = 0.1; // مقدار إزاحة الألواح إلى داخل الجدار الزجاجي

  // ================= غرفة هندسة الطاقة المتجددة (موسّعة 26×46) =================
  floorOverlay(-40, 0, 25.6, 45.6, M.renewFloor);
  floorOverlay(-40, 0, 26, 46, M.renewBorder, 0.008); // إطار أخضر يظهر كحافة
  floorOverlay(-40, 0, 3.5, 45.6, M.renewWood, 0.016); // ممر خشبي دافئ في المنتصف
  ceiling(-40, 0, 26, 46, M.renewCeil);
  dressRoom(
    [
      { cx: -40, cz: -23 + IN, len: 26, rotY: 0, gapAt: null },
      { cx: -40, cz: 23 - IN, len: 26, rotY: Math.PI, gapAt: null },
      { cx: -53 + IN, cz: 0, len: 46, rotY: Math.PI / 2, gapAt: null },
      { cx: -27 - IN, cz: 0, len: 46, rotY: -Math.PI / 2, gapAt: 0, gapHalf: 3.2 },
    ],
    M.renewWood, M.renewUpper, M.renewBorder
  );
  [[-52.6, -22.6], [-52.6, 22.6], [-27.4, -22.6], [-27.4, 22.6]].forEach(([x, z]) => cornerPillar(x, z, M.renewWood));
  moodLight(-40, 0, 0xfff0d6, 2.2);       // دفء مشمس مشرق (أمامي)
  moodLight(-40, -14, 0xfff0d6, 2.0, 30); // النصف الخلفي الجديد

  // ===== غرفة «الهندسة الكهربائية كطالب» (30×20 عند 0,-40) =====
  // بنفس ثيم وخامات غرفة الطاقة المتجددة تماماً (بطلب المستخدم):
  // أرضية M.renewFloor بإطار أخضر وممر خشبي، سقف renewCeil، كسوة جدران
  // خشب/أخضر، أعمدة زوايا خشبية، وإضاءة مزاجية دافئة مطابقة.
  floorOverlay(0, -40, 29.6, 19.6, M.renewFloor);
  floorOverlay(0, -40, 30, 20, M.renewBorder, 0.008);
  floorOverlay(0, -40, 3.5, 19.6, M.renewWood, 0.016); // الممر الخشبي (بمحاذاة المدخل الشمالي)
  ceiling(0, -40, 30, 20, M.renewCeil);
  dressRoom(
    [
      { cx: 0, cz: -50 + IN, len: 30, rotY: 0, gapAt: null },
      { cx: -15 + IN, cz: -40, len: 20, rotY: Math.PI / 2, gapAt: null },
      { cx: 15 - IN, cz: -40, len: 20, rotY: -Math.PI / 2, gapAt: null },
      { cx: 0, cz: -30 - IN, len: 30, rotY: Math.PI, gapAt: 0, gapHalf: 3.2 },
    ],
    M.renewWood, M.renewUpper, M.renewBorder
  );
  [[-14.6, -49.6], [14.6, -49.6], [-14.6, -30.4], [14.6, -30.4]].forEach(([x, z]) => cornerPillar(x, z, M.renewWood));
  moodLight(0, -40, 0xfff0d6, 2.2); // نفس الدفء المشمس

  // ================= البهو (بهو فندق فاخر) =================
  floorOverlay(0, 0, 21.6, 21.6, M.lobbyFloor);          // رخام كريمي
  floorOverlay(0, 0, 22, 22, M.lobbyGold, 0.008);        // إطار ذهبي حول الرخام
  floorOverlay(0, 0, 7, 7, M.lobbyGold, 0.014);          // ميدالية ذهبية مركزية
  floorOverlay(0, 0, 6.2, 6.2, M.lobbyFloor, 0.02);      // قلب الميدالية رخامي
  ceiling(0, 0, 22, 22, M.lobbyCeil);
  dressRoom(
    [
      { cx: 0, cz: -11 + IN, len: 22, rotY: 0, gapAt: 0, gapHalf: 3.2 },
      { cx: 0, cz: 11 - IN, len: 22, rotY: Math.PI, gapAt: null },
      { cx: -11 + IN, cz: 0, len: 22, rotY: Math.PI / 2, gapAt: 0, gapHalf: 3.2 },
      { cx: 11 - IN, cz: 0, len: 22, rotY: -Math.PI / 2, gapAt: 0, gapHalf: 3.2 },
    ],
    M.lobbyPanel, M.lobbyPanel, M.lobbyGold
  );
  [[-10.6, -10.6], [10.6, -10.6], [-10.6, 10.6], [10.6, 10.6]].forEach(([x, z]) => cornerPillar(x, z, M.lobbyGold));
  moodLight(0, 0, 0xffe8c4, 3.2, 34);   // دفء فندقي ذهبي
  moodLight(0, 6, 0xfff3dd, 1.6, 24);   // تعبئة ناعمة تمنع الزوايا المعتمة

  // ================= الممرات الثلاثة (نفس فخامة البهو) =================
  [
    { cx: -20, cz: 0, sx: 20, sz: 6 },
    { cx: 20, cz: 0, sx: 20, sz: 6 },
    { cx: 0, cz: -20, sx: 6, sz: 20 },
  ].forEach(({ cx, cz, sx, sz }) => {
    floorOverlay(cx, cz, sx, sz, M.lobbyGold, 0.008);              // حافة ذهبية
    floorOverlay(cx, cz, sx - 0.5, sz - 0.5, M.lobbyFloor, 0.012); // رخام كريمي
    ceiling(cx, cz, sx, sz, M.lobbyCeil, 5);                        // سقف الممر
    moodLight(cx, cz, 0xffeccb, 2.2, 26);                           // إنارة دافئة
  });
}

applyRoomThemes();

// -----------------------------------------------------------------------
// 26. تحسينات الأداء — دمج الزينة الثابتة وتجميد مصفوفات الكائنات الساكنة
// -----------------------------------------------------------------------
// لا تغيّر هذه المرحلة المظهر إطلاقاً: نفس الخامات ونفس المواضع العالمية،
// لكنها تقلّل بشكل كبير:
//   1) عدد نداءات الرسم (draw calls) بدمج مئات شبكات الزينة المتشابهة
//      الخامة في شبكة واحدة لكل خامة.
//   2) عمل المعالج كل إطار، بإيقاف إعادة حساب مصفوفات الكائنات الثابتة.
// -----------------------------------------------------------------------

/** يدمج شبكات الزينة الموسومة حسب الخامة (تقليل نداءات الرسم). */
function mergeStaticDecor() {
  const buckets = new Map(); // uuid الخامة -> شبكات
  scene.traverse((object) => {
    if (object.isMesh && object.userData.mergeable && object.geometry && object.material) {
      const key = object.material.uuid;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(object);
    }
  });

  let mergedGroups = 0;
  let removed = 0;
  buckets.forEach((meshes) => {
    if (meshes.length < 2) return;
    const geometries = [];
    for (const mesh of meshes) {
      mesh.updateWorldMatrix(true, false);
      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld); // تثبيت الموضع العالمي
      // توحيد الخصائص: الدمج يتطلب مجموعة خصائص متطابقة.
      for (const name of Object.keys(geometry.attributes)) {
        if (!["position", "normal", "uv"].includes(name)) geometry.deleteAttribute(name);
      }
      geometries.push(geometry);
    }
    const merged = mergeGeometries(geometries, false);
    geometries.forEach((geometry) => geometry.dispose());
    if (!merged) return; // خصائص غير متوافقة — نُبقي الأصل كما هو

    const mesh = new THREE.Mesh(merged, meshes[0].material);
    mesh.castShadow = meshes[0].castShadow;
    mesh.receiveShadow = meshes[0].receiveShadow;
    mesh.matrixAutoUpdate = false; // ثابتة: لا إعادة حساب كل إطار
    mesh.updateMatrix();
    scene.add(mesh);

    for (const old of meshes) {
      if (old.parent) old.parent.remove(old);
      old.geometry.dispose();
      removed += 1;
    }
    mergedGroups += 1;
  });
  return { mergedGroups, removed };
}

/** يوقف إعادة حساب المصفوفات للكائنات الثابتة (كل ما لا يتحرك). */
function freezeStaticTransforms() {
  // الأبواب تتحرك (animateDoors) — تُستثنى هي وكل أبنائها.
  const doorMeshes = new Set();
  doors.forEach((door) => door.mesh && door.mesh.traverse((child) => doorMeshes.add(child)));
  let frozen = 0;
  scene.traverse((object) => {
    if (!object.isMesh && !object.isGroup) return;
    const data = object.userData || {};
    // استثناءات: كل ما يتحرك أو يدور أو يواجه الزائر أو يُتفاعل معه.
    if (
      data.isBillboard ||
      data.isLogo ||
      data.isAriaCompanion ||
      data.interactive ||
      data.isPerspectiveKiosk ||
      object === ariaCompanion ||
      doorMeshes.has(object)
    ) {
      return;
    }
    if (object.matrixAutoUpdate) {
      object.updateMatrix();
      object.matrixAutoUpdate = false;
      frozen += 1;
    }
  });
  return frozen;
}

// تشغيل مرحلة التحسين بعد اكتمال بناء المشهد.
try {
  const { mergedGroups, removed } = mergeStaticDecor();
  const frozen = freezeStaticTransforms();
  console.log(
    `[أداء] دُمجت ${removed} شبكة زينة في ${mergedGroups} شبكة، وجُمّدت مصفوفات ${frozen} كائناً ثابتاً.`
  );
} catch (error) {
  // الدمج تحسين اختياري — أي فشل فيه لا يعطّل المعرض إطلاقاً.
  console.warn("[أداء] تعذر دمج الزينة الثابتة، سيعمل المعرض بلا هذا التحسين:", error);
}

// -----------------------------------------------------------------------
// 27. أدوات التحكم باللمس (الجوال واللوحي) — إضافة جديدة
// -----------------------------------------------------------------------
// المشكلة: التنقل على الحاسب يعتمد WASD + قفل مؤشر الفأرة، وكلاهما غير
// متاح على الشاشات اللمسية — فكان الزائر عالقاً مكانه على الجوال، وكذلك
// داخل متصفح النظارة قبل الدخول إلى وضع الواقع الافتراضي.
//
// الحل: طبقة تحكم لمسية كاملة تظهر تلقائياً على الأجهزة اللمسية فقط:
//   • عصا افتراضية (أسفل يسار)      -> المشي بسرعة تماثلية.
//   • السحب على بقية الشاشة          -> النظر حول المشهد.
//   • نقرة قصيرة على معروض           -> فتح بطاقته (بدل النقر بالفأرة).
// تجربة سطح المكتب والواقع الافتراضي لم تتغير إطلاقاً.
// -----------------------------------------------------------------------
const touchControls = {
  active: false, // هل الجهاز لمسي؟
  moveX: 0, // -1..1 (يمين/يسار)
  moveY: 0, // -1..1 (خلف/أمام)
};

(function initTouchControls() {
  if (!IS_TOUCH_DEVICE) return;
  touchControls.active = true;

  // ---------- واجهة العصا الافتراضية ----------
  const stickBase = document.createElement("div");
  stickBase.id = "touch-stick";
  const stickKnob = document.createElement("div");
  stickKnob.id = "touch-stick-knob";
  stickBase.appendChild(stickKnob);
  document.body.appendChild(stickBase);

  const hint = document.createElement("div");
  hint.id = "touch-hint";
  hint.textContent = "اسحب العصا للمشي • اسحب الشاشة للنظر • انقر على معروض لفتحه";
  document.body.appendChild(hint);
  setTimeout(() => hint.classList.add("is-faded"), 7000);

  const STICK_RADIUS = 55; // نصف قطر حركة المقبض بالبكسل

  let stickTouchId = null;
  let stickCenter = { x: 0, y: 0 };

  function setKnob(dx, dy) {
    stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function resetStick() {
    stickTouchId = null;
    touchControls.moveX = 0;
    touchControls.moveY = 0;
    setKnob(0, 0);
    stickBase.classList.remove("is-active");
  }

  stickBase.addEventListener(
    "touchstart",
    (event) => {
      const touch = event.changedTouches[0];
      stickTouchId = touch.identifier;
      const rect = stickBase.getBoundingClientRect();
      stickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      stickBase.classList.add("is-active");
      event.preventDefault();
    },
    { passive: false }
  );

  window.addEventListener(
    "touchmove",
    (event) => {
      if (stickTouchId === null) return;
      for (const touch of event.changedTouches) {
        if (touch.identifier !== stickTouchId) continue;
        let dx = touch.clientX - stickCenter.x;
        let dy = touch.clientY - stickCenter.y;
        const distance = Math.hypot(dx, dy);
        if (distance > STICK_RADIUS) {
          dx = (dx / distance) * STICK_RADIUS;
          dy = (dy / distance) * STICK_RADIUS;
        }
        setKnob(dx, dy);
        // القيم التماثلية: كلما ابتعد الإصبع زادت السرعة (حتى الحد الأقصى)
        touchControls.moveX = dx / STICK_RADIUS;
        touchControls.moveY = dy / STICK_RADIUS;
        event.preventDefault();
      }
    },
    { passive: false }
  );

  const endStick = (event) => {
    for (const touch of event.changedTouches) {
      if (touch.identifier === stickTouchId) resetStick();
    }
  };
  window.addEventListener("touchend", endStick);
  window.addEventListener("touchcancel", endStick);

  // ---------- النظر بالسحب + النقر للتفاعل ----------
  // نستخدم نفس أسلوب PointerLockControls في تدوير الكاميرا (ترتيب YXZ)
  // حتى يبقى الإحساس مطابقاً لوضع سطح المكتب.
  const lookEuler = new THREE.Euler(0, 0, 0, "YXZ");
  const LOOK_SPEED = 0.004;
  const MAX_PITCH = Math.PI / 2 - 0.05;
  const TAP_SLOP = 12; // بكسل: أقل من ذلك تُعتبر نقرة لا سحباً
  const TAP_TIME = 350; // مللي ثانية

  let lookTouchId = null;
  let lastLook = { x: 0, y: 0 };
  let touchStart = { x: 0, y: 0, time: 0, moved: false };

  const canvas = renderer.domElement;

  canvas.addEventListener(
    "touchstart",
    (event) => {
      if (lookTouchId !== null) return;
      const touch = event.changedTouches[0];
      lookTouchId = touch.identifier;
      lastLook = { x: touch.clientX, y: touch.clientY };
      touchStart = { x: touch.clientX, y: touch.clientY, time: Date.now(), moved: false };
    },
    { passive: true }
  );

  canvas.addEventListener(
    "touchmove",
    (event) => {
      if (lookTouchId === null) return;
      for (const touch of event.changedTouches) {
        if (touch.identifier !== lookTouchId) continue;
        const dx = touch.clientX - lastLook.x;
        const dy = touch.clientY - lastLook.y;
        lastLook = { x: touch.clientX, y: touch.clientY };
        if (Math.hypot(touch.clientX - touchStart.x, touch.clientY - touchStart.y) > TAP_SLOP) {
          touchStart.moved = true;
        }
        lookEuler.setFromQuaternion(camera.quaternion);
        lookEuler.y -= dx * LOOK_SPEED;
        lookEuler.x -= dy * LOOK_SPEED;
        lookEuler.x = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, lookEuler.x));
        camera.quaternion.setFromEuler(lookEuler);
        event.preventDefault();
      }
    },
    { passive: false }
  );

  const endLook = (event) => {
    for (const touch of event.changedTouches) {
      if (touch.identifier !== lookTouchId) continue;
      // نقرة قصيرة بلا سحب = تفاعل مع المعروض عند نقطة اللمس.
      const quick = Date.now() - touchStart.time < TAP_TIME;
      if (quick && !touchStart.moved && !anyModalOpen()) {
        const pointer = new THREE.Vector2(
          (touch.clientX / window.innerWidth) * 2 - 1,
          -(touch.clientY / window.innerHeight) * 2 + 1
        );
        tryInteract(pointer);
      }
      lookTouchId = null;
    }
  };
  canvas.addEventListener("touchend", endLook, { passive: true });
  canvas.addEventListener("touchcancel", endLook, { passive: true });

  // إخفاء العصا أثناء فتح النوافذ أو داخل الواقع الافتراضي (لا حاجة لها).
  const updateStickVisibility = () => {
    const hide = anyModalOpen() || renderer.xr.isPresenting;
    stickBase.style.display = hide ? "none" : "";
    if (hide) resetStick();
  };
  setInterval(updateStickVisibility, 400);

  console.log("[لمس] تم تفعيل أدوات التحكم باللمس (عصا + سحب للنظر + نقر للتفاعل).");
})();
