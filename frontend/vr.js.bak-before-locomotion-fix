/**
 * vr.js — وضع الاستكشاف بالواقع الافتراضي (WebXR)
 * ------------------------------------------------
 * طبقة إضافية بالكامل: لا تُعدّل شيئاً في تجربة سطح المكتب. إن لم يدعم
 * الجهاز الواقع الافتراضي، لا يظهر الزر ولا يتغير أي سلوك.
 *
 * ما يوفّره هذا الوضع:
 *   - الدخول إلى المعرض بنظارة الواقع الافتراضي (Quest وغيرها) بزر واحد.
 *   - النظر الحر بحركة الرأس (يتولاها الجهاز).
 *   - التنقل بعصا التحكم اليسرى (انزلاق سلس) + الدوران القفزي بعصا اليمنى
 *     (Snap turn — أقل إثارة للدوار)، مع نفس منطق التصادم (WALKABLE_REGIONS).
 *   - شعاع ليزر من كل يد + التقاط المعروضات بزر الزناد (Trigger).
 *   - لوحة معلومات عربية ثلاثية الأبعاد داخل المشهد (بديل بطاقة HTML التي
 *     لا يمكن أن تظهر داخل جلسة WebXR)، تعرض: الاسم، الغرض، كيف يعمل،
 *     التطبيقات، التطورات المستقبلية — مع زرَّي «استمع» و«إغلاق».
 *
 * متطلب تشغيل مهم: WebXR يحتاج HTTPS (أو localhost). لتجربته من النظارة
 * على الشبكة المحلية استخدم نفقاً آمناً (مثل ngrok) أو شهادة SSL.
 */

import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";

// إعدادات الحركة داخل الواقع الافتراضي
const VR_MOVE_SPEED = 2.6; // م/ث — أبطأ من سرعة سطح المكتب (أريح للرأس)
const VR_SNAP_ANGLE = Math.PI / 6; // 30 درجة لكل قفزة دوران
const STICK_DEADZONE = 0.2;

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
    return { update() {}, supported: false };
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
  const headPos = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const rightVec = new THREE.Vector3();
  const upAxis = new THREE.Vector3(0, 1, 0);
  let snapCooldown = false;

  /** يدوّر المنصة حول رأس الزائر (لا حول نقطة الأصل) لتفادي الانزلاق. */
  function snapTurn(angle) {
    camera.getWorldPosition(headPos);
    const offset = dolly.position.clone().sub(headPos);
    offset.applyAxisAngle(upAxis, angle);
    dolly.position.copy(headPos).add(offset);
    dolly.rotation.y += angle;
  }

  /** هل موضع الرأس الجديد داخل مناطق المشي المسموحة؟ */
  function headWalkableAt(offsetX, offsetZ) {
    camera.getWorldPosition(headPos);
    return isWalkable(headPos.x + offsetX, headPos.z + offsetZ);
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

  // عدّاد إطارات: تُنفَّذ فحوص الأشعة (وهي الأغلى في VR لأنها تجتاز كل
  // المعروضات) كل إطارين بدل كل إطار — التوفير كبير والفرق غير محسوس
  // (تحديث بمعدل ≥45 مرة/ثانية على نظارة تعمل بـ90Hz).
  let frameCount = 0;

  function update(delta) {
    const session = renderer.xr.getSession();
    if (!session) return;

    frameCount += 1;
    if (frameCount % 2 === 0) updateRayFeedback();
    if (teleport.active) updateTeleportMarker();

    let moveX = 0;
    let moveZ = 0;
    let turn = 0;

    for (const source of session.inputSources) {
      const pad = source.gamepad;
      if (!pad || !pad.axes) continue;
      // المحوران 2 و3 هما عصا التحكم في معظم أجهزة WebXR (وإلا 0 و1).
      const ax = pad.axes.length >= 4 ? pad.axes[2] : pad.axes[0] || 0;
      const ay = pad.axes.length >= 4 ? pad.axes[3] : pad.axes[1] || 0;

      if (source.handedness === "right") {
        if (Math.abs(ax) > 0.7) turn = Math.sign(ax);
      } else {
        if (Math.abs(ax) > STICK_DEADZONE) moveX += ax;
        if (Math.abs(ay) > STICK_DEADZONE) moveZ += ay;
      }
    }

    // الدوران القفزي (خطوة واحدة لكل إمالة — أقل إثارة للدوار من الدوران السلس)
    if (turn !== 0 && !snapCooldown) {
      snapTurn(-turn * VR_SNAP_ANGLE);
      snapCooldown = true;
    } else if (turn === 0) {
      snapCooldown = false;
    }

    const moving = moveX !== 0 || moveZ !== 0;
    setMoving(moving);
    if (!moving) return;

    // الاتجاه محسوب من نظر الزائر (المشي حيث ينظر) على المستوى الأفقي.
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) return;
    forward.normalize();
    rightVec.set(forward.z, 0, -forward.x); // اليمين = دوران 90° عن الأمام

    const step = VR_MOVE_SPEED * delta;
    const dx = (rightVec.x * moveX - forward.x * moveZ) * step;
    const dz = (rightVec.z * moveX - forward.z * moveZ) * step;

    // فحص كل محور على حدة → انزلاق ناعم على الجدران (نفس سلوك سطح المكتب).
    if (headWalkableAt(dx, 0)) dolly.position.x += dx;
    if (headWalkableAt(0, dz)) dolly.position.z += dz;
  }

  // -------------------------------------------------------------------
  // بدء/إنهاء الجلسة: نقل الكاميرا بين المشهد والمنصة
  // -------------------------------------------------------------------
  const desktopPos = new THREE.Vector3();

  renderer.xr.addEventListener("sessionstart", () => {
    desktopPos.copy(camera.position); // موضع الزائر على سطح المكتب
    dolly.position.set(desktopPos.x, 0, desktopPos.z);
    dolly.rotation.y = camera.rotation.y;

    camera.position.set(0, 0, 0);
    camera.rotation.set(0, 0, 0);
    dolly.add(camera); // من الآن: الجهاز يقود الكاميرا داخل المنصة

    document.body.classList.add("in-vr");
    vrButton.textContent = "🥽 الخروج من الواقع الافتراضي";
  });

  renderer.xr.addEventListener("sessionend", () => {
    // إعادة الكاميرا إلى المشهد بنفس الموضع الذي انتهت عنده الجولة.
    scene.add(camera);
    camera.position.set(dolly.position.x, playerHeight, dolly.position.z);
    camera.rotation.set(0, dolly.rotation.y, 0);

    closePanel();
    setMoving(false);
    teleportMarker.visible = false;
    reticles.forEach((r) => (r.visible = false));
    document.body.classList.remove("in-vr");
    vrButton.textContent = "🥽 ادخل الواقع الافتراضي";
  });

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

  return { update, supported: true };
}
