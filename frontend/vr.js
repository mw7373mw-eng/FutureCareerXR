/**
 * vr.js — وضع الاستكشاف بالواقع الافتراضي (WebXR)
 * ------------------------------------------------
 * طبقة إضافية بالكامل: لا تُعدّل شيئاً في تجربة سطح المكتب. إن لم يدعم
 * الجهاز الواقع الافتراضي، لا يظهر الزر ولا يتغير أي سلوك.
 *
 * ما يوفّره هذا الوضع:
 *   - الدخول إلى المعرض بنظارة الواقع الافتراضي (Quest وغيرها) بزر واحد.
 *   - النظر الحر بحركة الرأس (يتولاها الجهاز).
 *   - التنقل بعصا التحكم اليسرى (انزلاق سلس نسبةً لاتجاه الرأس الأفقي) +
 *     الدوران القفزي 30° بعصا اليمنى (Snap turn — أقل إثارة للدوار)، مع نفس
 *     منطق التصادم (WALKABLE_REGIONS). الحركة تُطبَّق على منصة الزائر (dolly)
 *     وليس على الكاميرا — وضعية الرأس يقودها تتبع WebXR وحده.
 *   - تشخيص وحدات التحكم داخل النظارة: أضف ?vrdebug=1 إلى الرابط.
 *   - شعاع ليزر من كل يد + التقاط المعروضات بزر الزناد (Trigger).
 *   - لوحة معلومات عربية ثلاثية الأبعاد داخل المشهد (بديل بطاقة HTML التي
 *     لا يمكن أن تظهر داخل جلسة WebXR)، تعرض: الاسم، الغرض، كيف يعمل،
 *     التطبيقات، التطورات المستقبلية — مع زرَّي «استمع» و«إغلاق».
 *
 * متطلب تشغيل مهم: WebXR يحتاج HTTPS (أو localhost). لتجربته من النظارة
 * على الشبكة المحلية استخدم نفقاً آمناً (مثل ngrok) أو شهادة SSL.
 */

import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";

// إعدادات الحركة داخل الواقع الافتراضي (ثوابت قابلة للضبط)
const VR_MOVE_SPEED = 1.8; // م/ث — سرعة مريحة داخل النظارة (سطح المكتب أسرع)
const VR_SNAP_ANGLE = Math.PI / 6; // 30 درجة لكل قفزة دوران
const VR_SNAP_COOLDOWN = 0.3; // ثانية — أقل زمن بين قفزتي دوران متتاليتين
const VR_SNAP_TRIGGER = 0.7; // إمالة العصا اليمنى اللازمة لتنفيذ قفزة
const VR_SNAP_RELEASE = 0.3; // يجب أن تعود العصا دون هذا الحد قبل القفزة التالية
const STICK_DEADZONE = 0.18; // منطقة ميتة دائرية — تمنع الانجراف من ضجيج العصا

// تشخيص وحدات التحكم: افتح الصفحة بـ ?vrdebug=1 لإظهار لوحة داخل النظارة
// تعرض handedness وgamepad.axes وgamepad.buttons لكل يد (أو من الطرفية:
// window.XRDev.vrDebug(true)). مطفأة افتراضياً — لا طباعة لكل إطار.
const VR_DEBUG = new URLSearchParams(window.location.search).has("vrdebug");
const VR_BUILD = "locomotion-2026-09-22b"; // يظهر في لوحة التشخيص للتأكد من تحميل النسخة الجديدة

// لوحة المعلومات ثلاثية الأبعاد
const PANEL_WIDTH = 1.5; // متر
const PANEL_HEIGHT = 1.05;
const PANEL_CANVAS_W = 1024;
const PANEL_CANVAS_H = 716;
const PANEL_DISTANCE = 1.9; // مسافة ظهور اللوحة أمام الزائر

export function initVR(ctx) {
  const {
    THREE,
    renderer,
    scene,
    camera,
    playerHeight,
    isWalkable,
    interactiveObjects,
    findInteractiveRoot,
    getObjectData,
    getPerspective,
    categoryRoomNames,
    speak,
    stopSpeaking,
    setMoving,
  } = ctx;

  // إن كان المتصفح لا يعرف WebXR أصلاً: لا شيء يتغير.
  if (!navigator.xr) {
    return { update() {}, setDebug() {}, supported: false };
  }

  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local-floor"); // الأرضية الحقيقية = أرضية المعرض
  // Foveation: دقة كاملة في مركز النظر وأخف في الأطراف — مكسب أداء كبير
  // على النظارات المستقلة (Quest 2/3/3S وPico) بلا فرق بصري يُذكر.
  if (renderer.xr.setFoveation) renderer.xr.setFoveation(1.0);

  // -------------------------------------------------------------------
  // منصة الحركة (dolly): الكاميرا تصبح ابناً لها داخل الجلسة، فتحريك
  // المنصة = تحريك الزائر (الجهاز يتكفل بحركة الرأس داخل مساحة اللعب).
  // -------------------------------------------------------------------
  const dolly = new THREE.Group();
  dolly.name = "vr-dolly";
  scene.add(dolly);

  const controllerModelFactory = new XRControllerModelFactory();
  const controllers = [];
  const rays = [];
  const reticles = [];

  // حالة الانتقال الفوري (وضع تنقل اختياري إلى جانب الحركة السلسة)
  const teleport = { active: false, controller: null, valid: false, point: new THREE.Vector3() };

  const rayGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1),
  ]);

  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);
    controller.addEventListener("selectstart", () => onSelect(controller));
    dolly.add(controller);
    controllers.push(controller);

    // شعاع الليزر (يُقصَّر عند إصابة جسم تفاعلي ويتغير لونه عند التحويم)
    const ray = new THREE.Line(
      rayGeometry,
      new THREE.LineBasicMaterial({ color: 0x3ea6ff, transparent: true, opacity: 0.85 })
    );
    ray.scale.z = 5;
    controller.add(ray);
    rays.push(ray);

    // نقطة التصويب: كرة صغيرة تظهر عند نقطة إصابة الشعاع لجسم تفاعلي.
    const reticle = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x9fe0ff })
    );
    reticle.visible = false;
    scene.add(reticle);
    reticles.push(reticle);

    // أحداث الانتقال الفوري (Teleport) بزر القبضة (Grip/Squeeze):
    // اضغط باستمرار لعرض مؤشر الوجهة على الأرض، وأفلت للانتقال إليها.
    controller.addEventListener("squeezestart", () => {
      teleport.active = true;
      teleport.controller = controller;
    });
    controller.addEventListener("squeezeend", () => {
      if (teleport.controller === controller) executeTeleport();
    });

    // نموذج اليد/الجهاز الحقيقي
    const grip = renderer.xr.getControllerGrip(i);
    grip.add(controllerModelFactory.createControllerModel(grip));
    dolly.add(grip);
  }

  // -------------------------------------------------------------------
  // لوحة المعلومات العربية ثلاثية الأبعاد
  // (Canvas يدعم تشكيل الحروف العربية واتجاه RTL أصلاً في المتصفح)
  // -------------------------------------------------------------------
  const panelCanvas = document.createElement("canvas");
  panelCanvas.width = PANEL_CANVAS_W;
  panelCanvas.height = PANEL_CANVAS_H;
  const panelCtx = panelCanvas.getContext("2d");
  const panelTexture = new THREE.CanvasTexture(panelCanvas);
  panelTexture.anisotropy = 4;

  const panel = new THREE.Group();
  panel.visible = false;

  const panelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(PANEL_WIDTH, PANEL_HEIGHT),
    new THREE.MeshBasicMaterial({ map: panelTexture, transparent: true })
  );
  panel.add(panelMesh);

  /** يبني زر لوحة (نص عربي على Canvas صغير) ويسجّل إجراءه. */
  function makePanelButton(label, color, action, offsetX) {
    const canvas = document.createElement("canvas");
    canvas.width = 384;
    canvas.height = 96;
    const c = canvas.getContext("2d");
    c.fillStyle = color;
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.direction = "rtl";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = "#ffffff";
    c.font = "bold 44px 'Cairo', 'Tajawal', sans-serif";
    c.fillText(label, canvas.width / 2, canvas.height / 2 + 2);

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.44, 0.11),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true })
    );
    mesh.position.set(offsetX, -PANEL_HEIGHT / 2 - 0.09, 0.001);
    mesh.userData.vrAction = action;
    panel.add(mesh);
    return mesh;
  }

  let panelText = ""; // النص العربي المعروض حالياً (هو نفسه المنطوق)

  const panelButtons = [
    makePanelButton("🔊 استمع إلى الوصف", "#1d5fa8", "listen", 0.32),
    makePanelButton("⏹ إيقاف الصوت", "#3a4356", "stop", -0.16),
    makePanelButton("✕ إغلاق", "#7a2f3c", "close", -0.62),
  ];

  scene.add(panel);

  /** لفّ نص عربي طويل إلى أسطر تناسب عرض اللوحة. */
  function wrapArabic(text, maxWidth) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (panelCtx.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  /** يرسم محتوى اللوحة (عنوان + أقسام) بالعربية من اليمين إلى اليسار. */
  function drawPanel(title, eyebrow, sections) {
    const W = PANEL_CANVAS_W;
    const H = PANEL_CANVAS_H;
    const pad = 40;
    const right = W - pad;

    // خلفية زجاجية داكنة بنفس هوية المعرض
    const grad = panelCtx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "rgba(9, 18, 38, 0.96)");
    grad.addColorStop(1, "rgba(6, 12, 26, 0.96)");
    panelCtx.clearRect(0, 0, W, H);
    panelCtx.fillStyle = grad;
    panelCtx.fillRect(0, 0, W, H);
    panelCtx.strokeStyle = "rgba(62, 166, 255, 0.55)";
    panelCtx.lineWidth = 4;
    panelCtx.strokeRect(2, 2, W - 4, H - 4);

    panelCtx.direction = "rtl";
    panelCtx.textAlign = "right";
    panelCtx.textBaseline = "top";

    let y = pad;

    // اسم الغرفة
    panelCtx.font = "500 24px 'Tajawal', sans-serif";
    panelCtx.fillStyle = "#7fc4ff";
    panelCtx.fillText(eyebrow || "", right, y);
    y += 38;

    // العنوان
    panelCtx.font = "bold 46px 'Cairo', sans-serif";
    panelCtx.fillStyle = "#ffffff";
    panelCtx.fillText(title, right, y);
    y += 66;

    // الأقسام
    sections.forEach(({ heading, body }) => {
      if (!body) return;
      panelCtx.font = "bold 26px 'Cairo', sans-serif";
      panelCtx.fillStyle = "#4fd0c0";
      panelCtx.fillText(heading, right, y);
      y += 36;

      panelCtx.font = "400 26px 'Tajawal', sans-serif";
      panelCtx.fillStyle = "rgba(226, 236, 250, 0.92)";
      wrapArabic(body, W - pad * 2).forEach((line) => {
        if (y > H - 50) return; // لا نتجاوز حدود اللوحة
        panelCtx.fillText(line, right, y);
        y += 34;
      });
      y += 14;
    });

    panelTexture.needsUpdate = true;
  }

  /** يظهر اللوحة أمام الزائر مباشرة وبمستوى نظره. */
  function placePanelInFront() {
    const head = new THREE.Vector3();
    camera.getWorldPosition(head);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();

    panel.position.copy(head).addScaledVector(dir, PANEL_DISTANCE);
    panel.position.y = Math.max(1.2, head.y - 0.1);
    panel.lookAt(head.x, panel.position.y, head.z);
    panel.visible = true;
  }

  /** يفتح لوحة معروض (نفس نصوص بطاقة سطح المكتب حرفياً). */
  function openObjectPanel(categoryId, objectId) {
    const data = getObjectData(categoryId, objectId);
    if (!data) return;

    const sections = [
      { heading: "الغرض", body: data.purpose },
      { heading: "كيف يعمل", body: data.how_it_works },
      { heading: "التطبيقات الواقعية", body: data.applications },
      { heading: "التطورات المستقبلية", body: data.future },
    ];

    drawPanel(data.name, categoryRoomNames[categoryId] || "", sections);
    // النص المنطوق مطابق تماماً للنص المعروض على اللوحة.
    panelText = [data.name, data.purpose, data.how_it_works, data.applications, data.future]
      .filter(Boolean)
      .join(" ");
    placePanelInFront();
  }

  /** يفتح لوحة «الرؤية المستقبلية» عند النقر على كشك الغرفة. */
  function openPerspectivePanel(categoryId) {
    const perspective = getPerspective(categoryId);
    if (!perspective) return;
    const points = (perspective.points || []).slice(0, 5);
    drawPanel(perspective.title, "الرؤية المستقبلية", [
      { heading: "أبرز النقاط", body: points.join(" ") },
    ]);
    panelText = [perspective.title, ...points].join(" ");
    placePanelInFront();
  }

  /** لوحة تعريفية عند النقر على المرافق «سعود» (المحادثة النصية على سطح المكتب). */
  function openAriaPanel() {
    const message =
      "أنا «سعود»، مساعدك الذكي للإرشاد المهني. في وضع الواقع الافتراضي وجّه الشعاع نحو أي معروض واضغط الزناد لعرض معلوماته والاستماع إليها. للمحادثة النصية معي، اخلع النظارة وتابع من وضع سطح المكتب.";
    drawPanel("سعود — المساعد الذكي", "المرافق الافتراضي", [{ heading: "مرحباً بك", body: message }]);
    panelText = message;
    placePanelInFront();
  }

  function closePanel() {
    panel.visible = false;
    stopSpeaking();
  }

  // -------------------------------------------------------------------
  // التفاعل بالشعاع + الزناد
  // -------------------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const tempMatrix = new THREE.Matrix4();

  function rayFrom(controller) {
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
    return raycaster;
  }

  function onSelect(controller) {
    const caster = rayFrom(controller);

    // 1) أزرار اللوحة أولاً (لها الأولوية عندما تكون ظاهرة)
    if (panel.visible) {
      const buttonHit = caster.intersectObjects(panelButtons, false)[0];
      if (buttonHit) {
        const action = buttonHit.object.userData.vrAction;
        if (action === "listen") speak(panelText);
        else if (action === "stop") stopSpeaking();
        else if (action === "close") closePanel();
        return;
      }
    }

    // 2) المعروضات في المشهد
    const hit = caster.intersectObjects(interactiveObjects, true)[0];
    if (!hit || hit.distance > 12) return;

    const root = findInteractiveRoot(hit.object);
    if (!root) return;

    if (root.userData.isAriaCompanion) openAriaPanel();
    else if (root.userData.isPerspectiveKiosk) openPerspectivePanel(root.userData.categoryId);
    else if (root.userData.interactive) openObjectPanel(root.userData.categoryId, root.userData.objectId);
  }

  // -------------------------------------------------------------------
  // الحركة بعصا التحكم + التصادم
  // -------------------------------------------------------------------
  // البنية: dolly (منصة الزائر) ← الكاميرا/النظارة + وحدتا التحكم.
  // لا نكتب أبداً فوق وضعية الكاميرا (يقودها تتبع WebXR)، بل نحرّك وندوّر
  // المنصة فقط — فيبقى المشي الفعلي داخل حدود Guardian طبيعياً تماماً.
  const headPos = new THREE.Vector3();
  const headQuat = new THREE.Quaternion();
  const headEuler = new THREE.Euler(0, 0, 0, "YXZ");
  const upAxis = new THREE.Vector3(0, 1, 0);
  const snapOffset = new THREE.Vector3();
  const stick = { x: 0, y: 0 }; // ناتج قراءة العصا (يُعاد استخدامه — بلا تخصيص لكل إطار)
  let snapArmed = true; // تُسلَّح القفزة من جديد عند عودة العصا اليمنى للمنتصف
  let snapTimer = 0; // ثوانٍ متبقية على انتهاء مهلة القفزة

  /** اتجاه الرأس الأفقي فقط (Yaw) في العالم — بلا ميلان للأعلى/الأسفل. */
  function headYaw() {
    camera.getWorldQuaternion(headQuat);
    headEuler.setFromQuaternion(headQuat, "YXZ");
    return headEuler.y;
  }

  /**
   * يقرأ عصا التحكم من gamepad (ترتيب xr-standard في Quest):
   *   axes[0], axes[1] = لوحة لمس (غير موجودة في Quest → 0)
   *   axes[2], axes[3] = العصا (X: يمين موجب، Y: للأمام سالب)
   * احتياط: إن كانت 2/3 صفراً بينما 0/1 لا (بعض المتصفحات) نقرأ 0/1.
   * ثم منطقة ميتة دائرية مع إعادة قياس، فتبدأ الحركة ناعمة من الصفر.
   */
  function readStick(pad, out) {
    const a = pad.axes;
    let x = 0;
    let y = 0;
    const hasStick = a.length >= 4 && (a[2] !== 0 || a[3] !== 0);
    const hasPad = a.length >= 2 && (a[0] !== 0 || a[1] !== 0);
    if (hasStick || (a.length >= 4 && !hasPad)) {
      x = a[2];
      y = a[3];
    } else if (a.length >= 2) {
      x = a[0];
      y = a[1];
    }
    const len = Math.hypot(x, y);
    if (!(len > STICK_DEADZONE)) {
      out.x = 0;
      out.y = 0;
      return out;
    }
    const scale = Math.min(1, (len - STICK_DEADZONE) / (1 - STICK_DEADZONE)) / len;
    out.x = x * scale;
    out.y = y * scale;
    return out;
  }

  /** يدوّر المنصة حول رأس الزائر (لا حول نقطة الأصل) لتفادي الانزلاق. */
  function snapTurn(angle) {
    camera.getWorldPosition(headPos);
    snapOffset.copy(dolly.position).sub(headPos).applyAxisAngle(upAxis, angle);
    dolly.position.copy(headPos).add(snapOffset);
    dolly.rotation.y += angle;
    dolly.updateMatrixWorld(true);
  }

  /**
   * هل تُسمح إزاحة الرأس؟ (headPos محدَّث مسبقاً)
   * إن كان الرأس أصلاً خارج منطقة المشي — بسبب المشي الفعلي داخل غرفة
   * اللعب أو إزاحة أصل local-floor — نسمح بالحركة حتى لا يعلق الزائر إلى
   * الأبد (كان هذا أحد أسباب «التجمّد في مكان واحد»).
   */
  function canMoveHead(offsetX, offsetZ) {
    if (!isWalkable(headPos.x, headPos.z)) return true;
    return isWalkable(headPos.x + offsetX, headPos.z + offsetZ);
  }

  /** يضع رأس الزائر فوق نقطة البداية وباتجاه نظره على سطح المكتب. */
  function alignHeadToSpawn() {
    snapTurn(spawnYaw - headYaw());
    camera.getWorldPosition(headPos);
    dolly.position.x += spawnPos.x - headPos.x;
    dolly.position.z += spawnPos.z - headPos.z;
    dolly.updateMatrixWorld(true);
  }

  // مؤشر وجهة الانتقال الفوري: حلقة على الأرض (أخضر = وجهة صالحة).
  const teleportMarker = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.38, 32),
    new THREE.MeshBasicMaterial({ color: 0x39d98a, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  );
  teleportMarker.rotation.x = -Math.PI / 2;
  teleportMarker.visible = false;
  scene.add(teleportMarker);

  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const teleportHit = new THREE.Vector3();

  /** يحدّث مؤشر الانتقال أثناء ضغط زر القبضة (يُستدعى فقط عند تفعيله). */
  function updateTeleportMarker() {
    if (!teleport.active || !teleport.controller) {
      teleportMarker.visible = false;
      return;
    }
    const caster = rayFrom(teleport.controller);
    const hit = caster.ray.intersectPlane(floorPlane, teleportHit);
    teleport.valid = !!hit && hit.distanceTo(raycaster.ray.origin) < 12 && isWalkable(hit.x, hit.z);
    if (hit) {
      teleport.point.copy(hit);
      teleportMarker.position.set(hit.x, 0.03, hit.z);
      teleportMarker.material.color.set(teleport.valid ? 0x39d98a : 0xd9534f);
      teleportMarker.visible = true;
    } else {
      teleportMarker.visible = false;
    }
  }

  /** ينفّذ الانتقال الفوري عند إفلات زر القبضة (إن كانت الوجهة صالحة). */
  function executeTeleport() {
    if (teleport.valid) {
      camera.getWorldPosition(headPos);
      // نحرّك المنصة بحيث يهبط رأس الزائر فوق نقطة الوجهة تماماً.
      dolly.position.x += teleport.point.x - headPos.x;
      dolly.position.z += teleport.point.z - headPos.z;
    }
    teleport.active = false;
    teleport.controller = null;
    teleport.valid = false;
    teleportMarker.visible = false;
  }

  // كائنات قابلة للتحويم: أزرار اللوحة + كل المعروضات التفاعلية.
  const HOVER_COLOR = 0x86f7d3;
  const IDLE_COLOR = 0x3ea6ff;

  /** تغذية بصرية لكل إطار: تقصير الشعاع، تلوينه، وإظهار نقطة التصويب. */
  function updateRayFeedback() {
    // ملاحظة أداء: لا تُنشأ كائنات داخل هذه الحلقة (لا Vector3 ولا Matrix4)
    // — كلها معاد استخدامها من الأعلى، فلا ضغط على جامع القمامة أثناء VR.
    for (let i = 0; i < controllers.length; i++) {
      const caster = rayFrom(controllers[i]);
      let hit = null;
      if (panel.visible) hit = caster.intersectObjects(panelButtons, false)[0] || null;
      if (!hit) {
        const objHit = caster.intersectObjects(interactiveObjects, true)[0];
        if (objHit && objHit.distance <= 12 && findInteractiveRoot(objHit.object)) hit = objHit;
      }
      if (hit) {
        rays[i].scale.z = hit.distance;
        rays[i].material.color.set(HOVER_COLOR);
        reticles[i].position.copy(hit.point);
        reticles[i].visible = true;
      } else {
        rays[i].scale.z = 5;
        rays[i].material.color.set(IDLE_COLOR);
        reticles[i].visible = false;
      }
    }
  }

  // -------------------------------------------------------------------
  // تشخيص وحدات التحكم داخل النظارة (?vrdebug=1) — لوحة نصية صغيرة
  // مثبتة أسفل مجال الرؤية، تُحدَّث 5 مرات/ثانية فقط.
  // -------------------------------------------------------------------
  const debug = { enabled: VR_DEBUG, timer: 0, mesh: null, canvas: null, ctx: null, texture: null };

  function ensureDebugPanel() {
    if (debug.mesh) return;
    debug.canvas = document.createElement("canvas");
    debug.canvas.width = 640;
    debug.canvas.height = 360;
    debug.ctx = debug.canvas.getContext("2d");
    debug.texture = new THREE.CanvasTexture(debug.canvas);
    debug.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.56, 0.315),
      new THREE.MeshBasicMaterial({ map: debug.texture, transparent: true, depthTest: false })
    );
    debug.mesh.renderOrder = 999;
    debug.mesh.position.set(0, -0.22, -0.8); // أسفل مجال النظر قليلاً
    camera.add(debug.mesh);
  }

  function updateDebug(session, delta) {
    debug.timer -= delta;
    if (debug.timer > 0) return;
    debug.timer = 0.2;
    ensureDebugPanel();
    debug.mesh.visible = true;

    const c = debug.ctx;
    c.clearRect(0, 0, 640, 360);
    c.fillStyle = "rgba(0, 0, 0, 0.78)";
    c.fillRect(0, 0, 640, 360);
    c.direction = "ltr";
    c.textAlign = "left";
    c.textBaseline = "top";
    c.font = "20px monospace";
    c.fillStyle = "#9fe0ff";
    let y = 10;
    const line = (text, color) => {
      c.fillStyle = color || "#e6f0ff";
      c.fillText(text, 12, y);
      y += 24;
    };
    line(`build ${VR_BUILD}  moves=${moveCount}`, "#ffd479");
    if (lastError) line(`ERR: ${lastError}`.slice(0, 60), "#ff7b7b");
    line(`dolly x=${dolly.position.x.toFixed(2)} y=${dolly.position.y.toFixed(2)} z=${dolly.position.z.toFixed(2)} yaw=${((dolly.rotation.y * 180) / Math.PI).toFixed(0)}°`, "#9fe0ff");
    camera.getWorldPosition(headPos);
    line(`head  x=${headPos.x.toFixed(2)} y=${headPos.y.toFixed(2)} z=${headPos.z.toFixed(2)} walkable=${isWalkable(headPos.x, headPos.z)}`, "#9fe0ff");
    line(`refSpace=${renderer.xr.getReferenceSpace() ? currentRefType : "?"}  sources=${session.inputSources.length}`, "#9fe0ff");
    for (let si = 0; si < session.inputSources.length; si++) {
      const source = session.inputSources[si];
      const pad = source.gamepad;
      y += 6;
      line(`[${source.handedness}] ${source.profiles[0] || ""} map=${pad ? pad.mapping || "-" : "no gamepad"}`, "#86f7d3");
      if (!pad) continue;
      line(`axes: ${Array.from(pad.axes, (v) => v.toFixed(2)).join("  ")}`);
      const pressed = [];
      pad.buttons.forEach((b, i) => {
        if (b.pressed || b.touched || b.value > 0.05) pressed.push(`${i}:${b.value.toFixed(1)}${b.pressed ? "P" : "t"}`);
      });
      line(`buttons(${pad.buttons.length}): ${pressed.join(" ") || "-"}`);
    }
    debug.texture.needsUpdate = true;
  }

  function setDebug(on) {
    debug.enabled = !!on;
    if (debug.mesh) debug.mesh.visible = debug.enabled && renderer.xr.isPresenting;
    return `vrDebug=${debug.enabled}`;
  }

  // -------------------------------------------------------------------
  // حلقة كل إطار (تُستدعى من animate فقط عندما renderer.xr.isPresenting)
  // -------------------------------------------------------------------
  // عدّاد إطارات: تُنفَّذ فحوص الأشعة (وهي الأغلى في VR لأنها تجتاز كل
  // المعروضات) كل إطارين بدل كل إطار — التوفير كبير والفرق غير محسوس
  // (تحديث بمعدل ≥45 مرة/ثانية على نظارة تعمل بـ90Hz).
  let frameCount = 0;
  // بعد بدء الجلسة ننتظر وصول أول وضعية تتبع حقيقية للرأس، ثم نضع الرأس
  // فوق نقطة البداية (أصل local-floor في Quest ليس بالضرورة تحت الرأس).
  let alignFrames = 0;
  let moveCount = 0; // عدد إطارات الحركة الفعلية (يظهر في لوحة التشخيص)
  let lastError = "";

  /** ينفّذ جزءاً من الإطار؛ الخطأ يُسجَّل ويُعرض ولا يوقف الحركة ولا العرض. */
  function guard(fn) {
    try {
      fn();
    } catch (error) {
      const msg = String((error && error.message) || error);
      if (msg !== lastError) console.warn("[vr.js]", error);
      lastError = msg;
      debug.enabled = true; // أظهر اللوحة تلقائياً عند أول خطأ
    }
  }

  function update(delta) {
    guard(() => updateFrame(delta));
  }

  function updateFrame(delta) {
    const session = renderer.xr.getSession();
    if (!session) return;

    frameCount += 1;
    if (alignFrames > 0) {
      alignFrames -= 1;
      if (alignFrames === 0) alignHeadToSpawn();
    }

    guard(() => {
      if (frameCount % 2 === 0) updateRayFeedback();
      if (teleport.active) updateTeleportMarker();
    });
    if (debug.enabled) guard(() => updateDebug(session, delta));

    // قراءة وحدات التحكم من XRSession.inputSources مباشرة (لا لوحة مفاتيح
    // داخل النظارة): اليسرى = الحركة، اليمنى = الدوران. وحدة بلا handedness
    // ("none") تُعامل كيد حركة. الأيدي المتتبَّعة بلا gamepad تُتجاهل.
    let moveX = 0;
    let moveY = 0;
    let turnX = 0;
    let hasMover = false;
    const sources = session.inputSources;
    for (let si = 0; si < sources.length; si++) {
      const source = sources[si];
      const pad = source.gamepad;
      if (!pad || !pad.axes || pad.axes.length < 2) continue;
      readStick(pad, stick);
      if (source.handedness === "right") {
        turnX = stick.x;
      } else if (!hasMover) {
        moveX = stick.x;
        moveY = stick.y;
        hasMover = true;
      }
    }

    // الدوران القفزي: قفزة واحدة لكل إمالة، مع مهلة بين القفزات، ويجب أن
    // تعود العصا إلى المنتصف قبل القفزة التالية (أقل إثارة للدوار).
    snapTimer = Math.max(0, snapTimer - delta);
    if (Math.abs(turnX) < VR_SNAP_RELEASE) snapArmed = true;
    if (snapArmed && snapTimer === 0 && Math.abs(turnX) > VR_SNAP_TRIGGER) {
      snapTurn(-Math.sign(turnX) * VR_SNAP_ANGLE);
      snapArmed = false;
      snapTimer = VR_SNAP_COOLDOWN;
    }

    const moving = moveX !== 0 || moveY !== 0;
    setMoving(moving);
    if (!moving) return;

    // الاتجاه من Yaw الرأس فقط → الحركة موازية للأرض دائماً (النظر للأعلى
    // أو الأسفل لا يرفع الزائر ولا يُنزله)، ويتبع استدارة الرأس/الجسم.
    //   الأمام = (-sin, 0, -cos)   اليمين = (cos, 0, -sin)
    //   العصا للأمام تعطي y سالبة، لذا الأمام = -moveY.
    const yaw = headYaw();
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const step = VR_MOVE_SPEED * delta; // مستقلة عن معدل الإطارات
    const dx = (cos * moveX + sin * moveY) * step;
    const dz = (-sin * moveX + cos * moveY) * step;

    // فحص كل محور على حدة → انزلاق ناعم على الجدران (نفس سلوك سطح المكتب).
    camera.getWorldPosition(headPos);
    if (canMoveHead(dx, 0)) {
      dolly.position.x += dx;
      headPos.x += dx;
    }
    if (canMoveHead(0, dz)) dolly.position.z += dz;
    moveCount += 1;
  }

  // -------------------------------------------------------------------
  // بدء/إنهاء الجلسة: نقل الكاميرا بين المشهد والمنصة
  // -------------------------------------------------------------------
  const spawnPos = new THREE.Vector3();
  let spawnYaw = 0;
  let floorOffset = 0; // 0 مع local-floor؛ = طول الزائر مع 'local' الاحتياطي
  let currentRefType = "local-floor";

  renderer.xr.addEventListener("sessionstart", () => {
    // موضع الزائر واتجاه نظره الأفقي على سطح المكتب. PointerLockControls
    // تستخدم ترتيب YXZ، لذا نستخرج الـYaw بنفس الترتيب (camera.rotation.y
    // بترتيب XYZ الافتراضي لا يساوي اتجاه النظر إذا كان هناك ميلان).
    camera.getWorldPosition(spawnPos);
    headEuler.setFromQuaternion(camera.quaternion, "YXZ");
    spawnYaw = headEuler.y;

    dolly.position.set(spawnPos.x, floorOffset, spawnPos.z);
    dolly.rotation.set(0, spawnYaw, 0);

    camera.position.set(0, 0, 0);
    camera.quaternion.identity();
    dolly.add(camera); // من الآن: الجهاز يقود الكاميرا داخل المنصة
    dolly.updateMatrixWorld(true);

    frameCount = 0;
    alignFrames = 3; // وضعية الرأس الحقيقية تتوفر بعد أول عرض داخل الجلسة
    snapArmed = true;
    snapTimer = 0;

    document.body.classList.add("in-vr");
    vrButton.textContent = "🥽 الخروج من الواقع الافتراضي";
  });

  renderer.xr.addEventListener("sessionend", () => {
    // إعادة الكاميرا إلى المشهد بنفس موضع الرأس واتجاهه الأفقي عند الخروج.
    camera.getWorldPosition(headPos);
    const yaw = headYaw();
    if (!isWalkable(headPos.x, headPos.z)) headPos.copy(spawnPos); // لا نعيده خارج الجدران
    scene.add(camera);
    camera.position.set(headPos.x, playerHeight, headPos.z);
    camera.quaternion.setFromEuler(headEuler.set(0, yaw, 0, "YXZ"));
    camera.updateMatrixWorld(true);

    closePanel();
    setMoving(false);
    teleportMarker.visible = false;
    reticles.forEach((r) => (r.visible = false));
    if (debug.mesh) debug.mesh.visible = false;
    document.body.classList.remove("in-vr");
    vrButton.textContent = "🥽 ادخل الواقع الافتراضي";
  });

  /** سطر واحد في الطرفية عند كل تغيّر في وحدات التحكم (لا طباعة لكل إطار). */
  function logInputSources(session) {
    const list = Array.prototype.map.call(session.inputSources, (s) => {
      const pad = s.gamepad;
      return `${s.handedness}:${s.profiles[0] || "?"}${pad ? ` axes=${pad.axes.length} buttons=${pad.buttons.length} map=${pad.mapping || "-"}` : " (no gamepad)"}`;
    });
    console.log("[vr.js] وحدات التحكم:", list.join(" | ") || "لا شيء");
  }

  // -------------------------------------------------------------------
  // زر الدخول (عربي) — يظهر فقط إن كان الجهاز يدعم immersive-vr
  // -------------------------------------------------------------------
  const vrButton = document.createElement("button");
  vrButton.id = "vr-enter-btn";
  vrButton.textContent = "🥽 ادخل الواقع الافتراضي";
  vrButton.hidden = true;
  document.body.appendChild(vrButton);

  let currentSession = null;

  vrButton.addEventListener("click", async () => {
    if (currentSession) {
      currentSession.end();
      return;
    }
    try {
      const session = await navigator.xr.requestSession("immersive-vr", {
        optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking", "layers"],
      });
      // local-floor: أرضية النظارة الحقيقية = أرضية المعرض (y=0) فيظهر الزائر
      // بطوله الحقيقي. إن لم يُمنح (نادر) نعود إلى 'local' ونرفع المنصة بطول
      // الزائر حتى لا يولد تحت الأرض. (يجب ضبطه قبل setSession.)
      const features = session.enabledFeatures;
      const hasFloor = !features || features.includes("local-floor");
      currentRefType = hasFloor ? "local-floor" : "local";
      floorOffset = hasFloor ? 0 : playerHeight;
      renderer.xr.setReferenceSpaceType(currentRefType);

      session.addEventListener("inputsourceschange", () => logInputSources(session));
      currentSession = session;
      session.addEventListener("end", () => {
        currentSession = null;
      });
      await renderer.xr.setSession(session);
    } catch (error) {
      console.warn("[vr.js] تعذر بدء جلسة الواقع الافتراضي:", error);
      vrButton.textContent = "تعذر تشغيل الواقع الافتراضي";
    }
  });

  navigator.xr
    .isSessionSupported("immersive-vr")
    .then((supported) => {
      vrButton.hidden = !supported;
      if (supported) console.log("[vr.js] الجهاز يدعم الواقع الافتراضي — الزر ظاهر.");
    })
    .catch(() => {
      vrButton.hidden = true;
    });

  return { update, setDebug, supported: true };
}
