/**
 * assets.js — نظام إدارة الأصول (Asset Management System)
 * ---------------------------------------------------------
 * وحدة مركزية لإدارة جميع أصول المشروع (نماذج GLB/GLTF، صور، أيقونات، فيديو).
 *
 * المسؤوليات:
 *   - "سجل الأصول" (MODEL_MANIFEST): يربط كل جسم تفاعلي في الغرف بملف
 *     النموذج ثلاثي الأبعاد الخاص به، مع مقاس الهدف والدوران والإزاحة.
 *   - التحميل التلقائي لكل النماذج عبر GLTFLoader.
 *   - ضبط الحجم تلقائياً (حسب أكبر بُعد)، ووضع النموذج على الأرض بشكل طبيعي.
 *   - تفعيل الظلال وتحسين الأداء لكل شبكة (Mesh) داخل النموذج.
 *   - في حال فشل تحميل نموذج: يبقى الشكل البديل (placeholder) ظاهراً،
 *     ويُطبع تحذير في وحدة تحكم المتصفح، ويستمر تحميل بقية الأصول.
 *
 * لإضافة نموذج جديد: ضع الملف في المجلد المناسب داخل assets/models/
 * ثم أضف سطراً واحداً في MODEL_MANIFEST أدناه — لا حاجة لتعديل script.js.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// جذر مجلد الأصول (نسبي إلى index.html)
export const ASSET_ROOT = "assets/";

// -----------------------------------------------------------------------
// سجل النماذج ثلاثية الأبعاد
// المفتاح الأول = معرف الغرفة (categoryId)، والثاني = معرف الجسم (objectId).
//   path       : مسار ملف .glb
//   targetSize : أكبر بُعد مطلوب للنموذج بالمتر (يُحسب مقياس التصغير تلقائياً)
//   rotY       : دوران حول المحور الرأسي (بالراديان) ليواجه النموذج الزائر
//   yOffset    : رفع إضافي عن الأرض (مثلاً للأجسام المعروضة على منصة)
// -----------------------------------------------------------------------
export const MODEL_MANIFEST = {
  renewable_energy: {
    // اللوح الشمسي: yOffset سالب يُنزل النموذج حتى يستقر على الأرض مباشرة
    // (لأن قاعدة/حامل النموذج ترفعه بصرياً). زِد السالب لمزيد من الإنزال.
    solar_panel: { path: "assets/models/renewable/solar_panel.glb", targetSize: 3.2, rotY: 0, yOffset: -0.5 },
    wind_turbine: { path: "assets/models/renewable/wind_turbine.glb", targetSize: 6.0, rotY: 0, yOffset: 0 },
    battery_storage: { path: "assets/models/renewable/battery_storage.glb", targetSize: 3.0, rotY: 0, yOffset: 0 },
    transformer: { path: "assets/models/renewable/transformer.glb", targetSize: 2.6, rotY: 0, yOffset: 0 },
    control_room: { path: "assets/models/renewable/control_room.glb", targetSize: 4.5, rotY: Math.PI, yOffset: 0 },

    // ---- نماذج المستخدم للمعروضات الأربعة الجديدة (أُضيفت بناءً على طلبه) ----
    green_hydrogen: { path: "assets/models/renewable/green_hydrogen.glb", targetSize: 2.4, rotY: 0, yOffset: 0 },
    ev_charger: { path: "assets/models/renewable/ev_charger.glb", targetSize: 2.2, rotY: 0, yOffset: 0 },
    smart_grid: { path: "assets/models/renewable/smart_grid.glb", targetSize: 2.8, rotY: 0, yOffset: 0 },
    concentrated_solar: { path: "assets/models/renewable/concentrated_solar.glb", targetSize: 3.2, rotY: 0, yOffset: 0 },
  },
  ee_student: {
    // أجهزة صغيرة: تُعرض مرفوعة فوق الشكل البديل نفسه (يبقى كمنصة — keepBase)
    oscilloscope: { path: "assets/models/ee_student/oscilloscope.glb", targetSize: 0.9, rotY: 0, yOffset: 1.0, keepBase: true },
    multimeter: { path: "assets/models/ee_student/multimeter.glb", targetSize: 0.55, rotY: 0, yOffset: 1.25, keepBase: true },
    circuit_lab: { path: "assets/models/ee_student/circuit_lab.glb", targetSize: 1.1, rotY: 0, yOffset: 0.22, keepBase: true },
    microprocessor_kit: { path: "assets/models/ee_student/microprocessor_kit.glb", targetSize: 0.8, rotY: 0, yOffset: 0.15, keepBase: true },
    // أجهزة بحجم الغرفة: تحل محل الشكل البديل مباشرة على الأرض
    electric_machine: { path: "assets/models/ee_student/electric_machine.glb", targetSize: 1.7, rotY: 0, yOffset: 0 },
    plc_panel: { path: "assets/models/ee_student/plc_panel.glb", targetSize: 1.6, rotY: 0, yOffset: 0 },
  },
};

// نموذج خريطة المملكة العربية السعودية — يُستخدم كأيقونة لكل أكشاك
// "الرؤية المستقبلية" في الغرف الثلاث (بحسب طلب المشروع).
export const PERSPECTIVE_ICON_MODEL = { path: "assets/models/saudi_arabia.glb", targetSize: 2.2 };

// نموذج المساعد الذكي الإنساني «سعود» المرافق — النموذج الذي رفعه المستخدم
// (روبوت كرتوني - cartoon_robot). القياس هنا بالارتفاع فقط (sizeAxis: "y")
// بحيث يطابق طول المرافق طول الزائر تماماً (PLAYER_HEIGHT في script.js =
// 1.7م)، بصرف النظر عن اتساع وضعية النموذج أو ذراعيه.
// ملاحظة: rotY يضبط الاتجاه الذي "يُعتبر" أمام النموذج داخل منطق الدوران في
// script.js (updateAriaCompanion يواجه به الزائر تلقائياً). إن ظهر المرافق
// وهو يدير ظهره للزائر بدل وجهه، غيّر القيمة إلى 0 بدل Math.PI (أو جرّب
// Math.PI / 2 أو -Math.PI / 2 حسب اتجاه النموذج الأصلي في ملف GLB).
export const ARIA_COMPANION_MODEL = {
  path: "assets/models/companion/aria_companion.glb",
  targetSize: 1.7,
  sizeAxis: "y",
  rotY: Math.PI,
};

// -----------------------------------------------------------------------
// سجل الصور — تُستخدم في بطاقات المعلومات (النوافذ المنبثقة) وكملصقات
// جدارية / شاشات عرض رقمية داخل الغرف. تُعرض الصور مع الحفاظ على نسبة
// الأبعاد تلقائياً (object-fit في CSS، وحساب النسبة في اللوحات الجدارية).
// -----------------------------------------------------------------------
export const OBJECT_IMAGES = {
  substation: "assets/images/renewable/substation.jpg",
};

// -----------------------------------------------------------------------
// معرض الصور لكل معروض (4 صور لكل جسم)
// ---------------------------------------------------------------------
// المصدر: ويكيميديا كومنز (Wikimedia Commons) — ملفات بتراخيص حرة
// (المشاع الإبداعي / الملكية العامة) آمنة من ناحية حقوق النشر.
//
// تُبنى الروابط عبر Special:FilePath مع تحديد العرض (width)، فيعيد الخادم
// نسخة مصغّرة مناسبة للعرض — أخف وأسرع من الصورة الأصلية (أداء أفضل).
// الصور تُحمَّل بكسل (lazy) عند فتح بطاقة المعروض فقط — لا شيء يُحمَّل مسبقاً.
//
// ترتيب الصور الأربع لكل جسم يتبع نفس المنطق:
//   1) الجهاز نفسه   2) تطبيق واقعي   3) الاستخدام العملي   4) بيئة عمل مهنية
//
// لتغيير أي صورة: بدّل اسم الملف (كما هو في كومنز) أو ضع مساراً محلياً
// داخل assets/images/ — كلاهما مدعوم.
// -----------------------------------------------------------------------
const COMMONS_FILE_PATH = "https://commons.wikimedia.org/wiki/Special:FilePath/";

/** يبني رابط صورة من ويكيميديا كومنز باسم الملف مع عرض مناسب. */
export function commonsImage(fileName, width = 900) {
  return `${COMMONS_FILE_PATH}${encodeURIComponent(fileName)}?width=${width}`;
}

export const OBJECT_GALLERIES = {
  // ---------------- غرفة هندسة الطاقة المتجددة ----------------
  // معارض المعروضات الأربعة الجديدة: صور واقعية حرّة الحقوق من ويكيميديا
  // كومنز، تُعرض داخل بطاقة معلومات كل معروض (مثل بقية النماذج).
  green_hydrogen: [
    { src: commonsImage("Hydrogen refueling.jpg"), caption: "الجهاز نفسه: محطة هيدروجين" },
    { src: commonsImage("Elektrolyse1.jpg"), caption: "المبدأ: التحليل الكهربائي للماء" },
    { src: commonsImage("Barrow Offshore wind turbines NR.jpg"), caption: "تطبيق واقعي: إنتاج الهيدروجين من الرياح" },
    { src: commonsImage("Hydrogen refueling.jpg"), caption: "بيئة مهنية: خزانات الهيدروجين" },
  ],
  ev_charger: [
    { src: commonsImage("Electric car charging station.jpg"), caption: "الجهاز نفسه: محطة شحن مركبات كهربائية" },
    { src: commonsImage("Electric vehicle charging.jpg"), caption: "الاستخدام العملي: شحن سيارة كهربائية" },
    { src: commonsImage("Tesla Supercharger.jpg"), caption: "تطبيق واقعي: شحن سريع فائق القدرة" },
    { src: commonsImage("Electric Vehicle Charging Point, Orange Street Car Park, Bradford - geograph.org.uk - 7390343.jpg"), caption: "بيئة مهنية: مواقف شحن عامة" },
  ],
  smart_grid: [
    { src: commonsImage("Electricity grid simple- North America.svg"), caption: "المبدأ: تخطيط الشبكة الذكية" },
    { src: commonsImage("Intelligenter zaehler- Smart meter.jpg"), caption: "الجهاز نفسه: عدّاد ذكي" },
    { src: commonsImage("Pylon ds.jpg"), caption: "تطبيق واقعي: خطوط نقل الكهرباء" },
    { src: commonsImage("Power plant control room.jpg"), caption: "بيئة مهنية: مركز التحكم بالشبكة" },
  ],
  concentrated_solar: [
    { src: commonsImage("PS10 solar power tower.jpg"), caption: "الجهاز نفسه: برج طاقة شمسية مركّزة" },
    { src: commonsImage("Solar Two 2003.jpg"), caption: "المبدأ: مرايا تركّز أشعة الشمس" },
    { src: commonsImage("Ivanpah Solar Power Facility Online.jpg"), caption: "تطبيق واقعي: محطة شمسية حرارية كبرى" },
    { src: commonsImage("Solar troughs in the Negev desert of Israel.jpg"), caption: "بيئة مهنية: أحواض شمسية مكافئة" },
  ],
  solar_panel: [
    { src: commonsImage("Giant photovoltaic array.jpg"), caption: "الجهاز نفسه: مصفوفة ألواح كهروضوئية" },
    { src: commonsImage("Bruce A. Henry Solar Farm.jpg"), caption: "تطبيق واقعي: محطة طاقة شمسية واسعة النطاق" },
    { src: commonsImage("Installing Solar Panels (7336033672).jpg"), caption: "الاستخدام العملي: تركيب الألواح في الموقع" },
    { src: commonsImage("Solar panels on a roof.jpg"), caption: "بيئة مهنية: أنظمة شمسية على أسطح المباني" },
  ],
  wind_turbine: [
    { src: commonsImage("Barrow Offshore wind turbines NR.jpg"), caption: "الجهاز نفسه: توربينات رياح عملاقة" },
    { src: commonsImage("Windfarm off the Kent coast (26339012935).jpg"), caption: "تطبيق واقعي: مزرعة رياح بحرية" },
    { src: commonsImage("Attaching Turbine Blade - geograph.org.uk - 1007203.jpg"), caption: "الاستخدام العملي: تركيب شفرة التوربين" },
    { src: commonsImage("Installing Gearbox Assembly at Turbine No 11 - geograph.org.uk - 1007245.jpg"), caption: "بيئة مهنية: تركيب صندوق التروس والمولد" },
  ],
  battery_storage: [
    { src: commonsImage("BESS Rens.jpg"), caption: "الجهاز نفسه: حاوية تخزين بطاريات (BESS)" },
    { src: commonsImage("Applications of Household Solar Energy Storage Systems.jpg"), caption: "تطبيق واقعي: تخزين طاقة شمسية منزلية" },
    { src: commonsImage("Household battery storage.png"), caption: "الاستخدام العملي: وحدة تخزين متصلة بالشبكة" },
    { src: commonsImage("BESS (battery energy storage system).svg"), caption: "بيئة مهنية: مخطط منظومة تخزين الطاقة" },
  ],
  transformer: [
    { src: commonsImage("Elfmorgenbruch 220kV-Transformator.jpg"), caption: "الجهاز نفسه: محول قدرة بجهد 220 كيلوفولت" },
    { src: commonsImage("Transformator (ABB) in Umspannwerk - DSCF0998.JPG"), caption: "تطبيق واقعي: محول داخل محطة تحويل" },
    { src: commonsImage("Cooling fans in transformer.jpg"), caption: "الاستخدام العملي: منظومة تبريد المحول" },
    { src: commonsImage("Electricity Sub-Station AC Transformer.jpg"), caption: "بيئة مهنية: محولات شبكة التوزيع" },
  ],
  substation: [
    { src: "assets/images/renewable/substation.jpg", caption: "الجهاز نفسه: محطة كهربائية فرعية" },
    { src: commonsImage("Substation at sunset 2017.jpg"), caption: "تطبيق واقعي: ربط التوليد بالشبكة الوطنية" },
    { src: commonsImage("Switchgear HV.jpg"), caption: "الاستخدام العملي: قواطع ومفاتيح الجهد العالي" },
    { src: commonsImage("Outdoor power substation.jpg"), caption: "بيئة مهنية: ساحة محطة فرعية خارجية" },
  ],
  control_room: [
    { src: commonsImage("Power plant control room.jpg"), caption: "الجهاز نفسه: غرفة تحكم محطة توليد" },
    { src: commonsImage("Altbach Power Plant Control Room.JPG"), caption: "تطبيق واقعي: مراقبة الإنتاج لحظياً" },
    { src: commonsImage("NEWater S.C.A.D.A. room.jpg"), caption: "الاستخدام العملي: منظومة SCADA للتحكم" },
    { src: commonsImage("ESOC control room ESA382584.jpg"), caption: "بيئة مهنية: مركز عمليات وتحكم متقدم" },
  ],

  // ---------------- غرفة «الهندسة الكهربائية كطالب» ----------------
  // أجهزة يستخدمها طالب القسم فعلاً في المختبرات — صور حرّة الحقوق.
  study_plan_board: [
    { src: commonsImage("Gantt chart example.png"), caption: "المبدأ: خطة منظمة عبر الزمن" },
    { src: commonsImage("5th Floor Lecture Hall.jpg"), caption: "بيئة الدراسة: قاعات المحاضرات" },
    { src: commonsImage("5th Floor Lecture Hall.jpg"), caption: "العمل الجماعي بين الطلاب" },
    { src: commonsImage("Library study area.jpg"), caption: "بيئة مهنية: الدراسة والمراجعة" },
  ],
  senior_design: [
    { src: commonsImage("University of Texas at Arlington Mechanical Engineering students (not identified) win First Place trophy with race car and $1,000 (10002858).jpg"), caption: "فريق مشروع التخرج" },
    { src: commonsImage("Breadboard counter.jpg"), caption: "النموذج الأولي للمشروع" },
    { src: commonsImage("5th Floor Lecture Hall.jpg"), caption: "عرض المشروع والدفاع عنه" },
    { src: commonsImage("University of Texas at Arlington Mechanical Engineering students (not identified) win First Place trophy with race car and $1,000 (10002858).jpg"), caption: "بيئة مهنية: مسابقات الهندسة" },
  ],
  oscilloscope: [
    { src: commonsImage("Oscilloscope.jpg"), caption: "الجهاز نفسه: راسم الإشارة" },
    { src: commonsImage("Sine waves different frequencies.svg"), caption: "المبدأ: عرض الموجات كهربائياً" },
    { src: commonsImage("Oscilloscope.jpg"), caption: "الاستخدام العملي في المختبر" },
    { src: commonsImage("Oscilloscope.jpg"), caption: "بيئة مهنية: تشخيص الدوائر" },
  ],
  multimeter: [
    { src: commonsImage("Digital Multimeter Aka.jpg"), caption: "الجهاز نفسه: القياس المتعدد" },
    { src: commonsImage("Fluke87-V Multimeter.jpg"), caption: "الاستخدام: قياس الجهد" },
    { src: commonsImage("Analog multimeter.jpg"), caption: "النسخة التماثلية الكلاسيكية" },
    { src: commonsImage("Digital Multimeter Aka.jpg"), caption: "بيئة مهنية: فحص الدوائر" },
  ],
  circuit_lab: [
    { src: commonsImage("Breadboard complex.jpg"), caption: "الجهاز نفسه: لوحة التجارب" },
    { src: commonsImage("Breadboard counter.jpg"), caption: "بناء دائرة حقيقية" },
    { src: commonsImage("3 Resistors.jpg"), caption: "المكوّنات: مقاومات وعناصر" },
    { src: commonsImage("Breadboard complex.jpg"), caption: "بيئة مهنية: مختبر الدوائر" },
  ],
  microprocessor_kit: [
    { src: commonsImage("Arduino Uno - R3.jpg"), caption: "الجهاز نفسه: لوحة معالج تعليمية" },
    { src: commonsImage("KL Intel D8086.jpg"), caption: "المعالج 8086 الذي تدرسه في EE233" },
    { src: commonsImage("Arduino Uno - R3.jpg"), caption: "مشروع بنظام مدمج" },
    { src: commonsImage("Embedded World 2014 Arch Pro Developer Board (03).jpg"), caption: "بيئة مهنية: تطوير الأنظمة المدمجة" },
  ],
  electric_machine: [
    { src: commonsImage("Stator and rotor by Zureks.JPG"), caption: "الجهاز نفسه: ملفات المحرك" },
    { src: commonsImage("TMW 50906 Schnittmodell einer Drehstrommaschine (Asynchronmaschine).jpg"), caption: "المبدأ: محرك حثّي مقطوع" },
    { src: commonsImage("TMW 50906 Schnittmodell einer Drehstrommaschine (Asynchronmaschine).jpg"), caption: "مختبر الآلات الكهربائية" },
    { src: commonsImage("TMW 50906 Schnittmodell einer Drehstrommaschine (Asynchronmaschine).jpg"), caption: "بيئة مهنية: محركات صناعية" },
  ],
  plc_panel: [
    { src: commonsImage("Siemens PLC S7-200 CPU.jpg"), caption: "الجهاز نفسه: متحكم منطقي مبرمج" },
    { src: commonsImage("Siemens PLC S7-200 CPU.jpg"), caption: "لوحة تحكم صناعية كاملة" },
    { src: commonsImage("KUKA Industrial Robots IR.jpg"), caption: "تطبيق واقعي: أتمتة مصنع" },
    { src: commonsImage("Power plant control room.jpg"), caption: "بيئة مهنية: غرفة تحكم SCADA" },
  ],
};

// ملصقات جدارية لكل غرفة: { image, width } — الارتفاع يُحسب من نسبة أبعاد الصورة.
export const ROOM_POSTERS = {
  renewable_energy: [
    { image: "assets/images/renewable/substation.jpg", width: 7 },
    { image: "assets/images/renewable/substation.jpg", width: 7 },
  ],
};

// -----------------------------------------------------------------------
// المُحمِّل — نسخة واحدة مشتركة من GLTFLoader مع ذاكرة تخزين مؤقت
// حتى لا يُحمَّل نفس الملف مرتين (مثل نموذج السعودية المكرر في 3 غرف).
// -----------------------------------------------------------------------
const gltfLoader = new GLTFLoader();
const modelCache = new Map(); // path -> Promise<THREE.Group>

/**
 * يُحمّل ملف GLB ويعيد Promise بمشهد النموذج (يُخزَّن مؤقتاً حسب المسار).
 */
export function loadModel(path) {
  if (!modelCache.has(path)) {
    modelCache.set(
      path,
      new Promise((resolve, reject) => {
        gltfLoader.load(
          path,
          (gltf) => resolve(gltf.scene),
          undefined,
          (error) => reject(error)
        );
      })
    );
  }
  // نعيد نسخة (clone) في كل مرة حتى يمكن استخدام النموذج في أكثر من مكان.
  return modelCache.get(path).then((scene) => scene.clone(true));
}

/**
 * يُطبِّع النموذج: يضبط حجمه (حسب أكبر بُعد افتراضياً، أو حسب الارتفاع
 * فقط إن كان sizeAxis="y" — مفيد للمرافق الإنساني حتى يطابق طوله طول
 * الزائر تماماً بصرف النظر عن اتساع وضعية النموذج)، ويُمركِزه أفقياً،
 * ويضعه فوق الأرض مباشرة، ويفعّل الظلال. تُعاد مجموعة (Group) جاهزة
 * للإضافة إلى المشهد عند الموضع المطلوب.
 */
export function normalizeModel(model, { targetSize = 2, rotY = 0, yOffset = 0, sizeAxis = "max" } = {}) {
  // 1) حساب الصندوق المحيط لتحديد مقياس التصغير/التكبير المناسب.
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const dim = sizeAxis === "y" ? size.y : Math.max(size.x, size.y, size.z);
  const scale = targetSize / (dim || 1);
  model.scale.setScalar(scale);

  // 2) إعادة حساب الصندوق بعد التحجيم ثم تمركز النموذج فوق نقطة الأصل.
  const scaledBox = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  scaledBox.getCenter(center);
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= scaledBox.min.y; // قاع النموذج يلامس الأرض تماماً
  model.position.y += yOffset;

  // 3) تفعيل الظلال وتحسين الأداء لكل شبكة داخل النموذج.
  model.updateMatrixWorld(true);
  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      child.frustumCulled = true; // تخطي رسم ما هو خارج مجال الرؤية
      if (child.material) {
        child.material.side = THREE.FrontSide; // رسم الوجه الأمامي فقط (أسرع)
      }
    }
    // تحسين مهم للأداء: النماذج المعروضة ثابتة ولا تُشغَّل حركاتها في
    // المشروع، وبعضها يحوي أكثر من مئة عقدة داخلية — تجميد مصفوفاتها
    // يوفّر إعادة حسابها كلها في كل إطار (توفير كبير في المعالج).
    if (child !== model) {
      child.updateMatrix();
      child.matrixAutoUpdate = false;
    }
  });

  // 4) لفّ النموذج داخل مجموعة مع الدوران المطلوب — يسهل تحريكها كوحدة واحدة.
  const wrapper = new THREE.Group();
  wrapper.rotation.y = rotY;
  wrapper.add(model);
  return wrapper;
}

/**
 * تحميل صورة كقوام (Texture) مع Promise — تُستخدم للملصقات الجدارية.
 */
const textureLoader = new THREE.TextureLoader();
export function loadTexture(path) {
  return new Promise((resolve, reject) => {
    textureLoader.load(path, resolve, undefined, reject);
  });
}
