/* =========================================================================
 * journey.js — «الرحلة الجامعية» (University Journey)
 * -------------------------------------------------------------------------
 * عملٌ جديد يُدرج قبل معرض المهن الحالي: يعيش الطالب رحلة الشهادة كاملة
 * (اختر التخصص ← الخطة الدراسية ← السنة ← الفصل ← المادة) ثم «يتخرّج»
 * فتُفتح غرفة الطاقة المتجددة القائمة كمكافأة.
 *
 * مبادئ التصميم المحفوظة:
 *  • لا يُعاد بناء أي شيء قائم — هذه طبقة HTML/SVG مستقلة فوق المشهد.
 *  • خفيفة على Quest 2: لا نماذج ثلاثية جديدة — أنماط بصرية SVG/Canvas.
 *  • ثنائية اللغة (عربي/إنجليزي)، أكواد المواد بالإنجليزية.
 *  • كل شيء مقاد بالبيانات (curriculum/kfu-ee.json) — منصة قابلة للترخيص.
 *
 * التكامل: window.Journey.start() يفتح الرحلة؛ عند التخرّج تستدعي
 * window.Journey.onGraduate() التي يوفّرها script.js لتسليم اللاعب لغرفة
 * الطاقة المتجددة.
 * ========================================================================= */

(function () {
  "use strict";

  // ------------------------------------------------------------------ اللغة
  let LANG = localStorage.getItem("fcxr_journey_lang") || "ar";
  const isAr = () => LANG === "ar";
  const t = (ar, en) => (isAr() ? ar : en);

  // نصوص الواجهة الثابتة (ثنائية اللغة)
  const UI = {
    chooseMajor: ["اختر تخصّصك", "Choose your major"],
    comingSoon: ["قريباً", "Coming soon"],
    studyPlan: ["الخطة الدراسية", "Study Plan"],
    yourJourney: ["رحلتك خلال ٤ سنوات. لنبدأ.", "Your 4-year journey. Let's begin."],
    begin: ["ابدأ الرحلة", "Begin the journey"],
    year: ["السنة", "Year"],
    semester: ["الفصل", "Semester"],
    progress: ["التقدّم", "Progress"],
    skills: ["ستكتسب:", "You'll gain:"],
    unlocks: ["يفتح:", "Unlocks:"],
    unlockNext: ["أجب لتفتح المادة التالية", "Answer to unlock the next course"],
    correct: ["أحسنت! المادة التالية مفتوحة.", "Correct! Next course unlocked."],
    tryAgain: ["حاول مجدداً", "Try again"],
    next: ["التالي", "Next"],
    learnMore: ["اعرف أكثر", "Learn more"],
    optional: ["مادة اختيارية — استكشف", "Optional — explore"],
    tapToRead: ["انقر للقراءة", "Tap to read"],
    yearComplete: ["اكتملت السنة", "Year complete"],
    branchReveal: ["مسارك يتفرّع الآن", "Your path now branches"],
    branchBody: ["الطاقة، التحكم، الاتصالات. مسارك يتبع الطاقة نحو مستقبل المملكة.",
                 "Power, Control, Communications. Your spine follows Power toward the Kingdom's future."],
    graduate: ["تخرّجت!", "You graduated!"],
    gradBody: ["أنت الآن مهندس كهربائي. ادخل غرفة الطاقة المتجددة — مكافأتك.",
               "You're an electrical engineer now. Enter the Renewable Energy room — your reward."],
    enterReward: ["🎓 ادخل غرفة المهنة", "🎓 Enter the career room"],
    skipToExhibit: ["تخطّي إلى المعرض", "Skip to exhibition"],
    resume: ["أكمل رحلتك", "Resume your journey"],
    restart: ["ابدأ من جديد", "Restart"],
    close: ["إغلاق", "Close"],
    spine: ["المسار الأساسي", "Core path"],
    of: ["من", "of"],
    graduationLocked: ["أكمل المسار الأساسي للتخرّج", "Complete the core path to graduate"],
  };
  const L = (k) => t(UI[k][0], UI[k][1]);

  // ------------------------------------------------------------- الحالة والتقدّم
  let DATA = null;
  // (بناءً على طلب المستخدم) حالة الاختبار لا تُحفَظ بين الجلسات: كل تحديث
  // للصفحة يبدأ الاختبار من الصفر — لا إجابات محفوظة ولا تقدّم ولا حالة
  // إكمال. يبقى محفوظاً فقط ما لا علاقة له بالاختبار: تفضيل اللغة،
  // ومعرّف الطالب المجهول (للتحليلات).
  const state = {
    completed: new Set(),      // يبدأ فارغاً دائماً
    optionalRead: new Set(),   // يبدأ فارغاً دائماً
    graduated: false,          // يبدأ غير متخرّج دائماً
    studentId: localStorage.getItem("fcxr_student") || genId(),
  };
  // تنظيف أي حالة قديمة مخزّنة من نسخ سابقة (مرة عند التحميل).
  try {
    localStorage.removeItem("fcxr_completed");
    localStorage.removeItem("fcxr_optional");
    localStorage.removeItem("fcxr_graduated");
  } catch (e) { /* تجاهل */ }
  function genId() {
    const id = "s_" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("fcxr_student", id);
    return id;
  }
  function saveProgress() {
    // عمداً لا شيء: التقدّم داخل الجلسة الحالية فقط (في الذاكرة)،
    // ويُمسح كلياً عند تحديث الصفحة — انظر التعليق أعلاه.
  }

  // ----------------------------------------------------------- تسجيل الأحداث (تحليلات)
  // يُخزَّن محلياً ويُرسل للخادم (يُلحق بملف JSONL) — أساس لوحة تحليلات القسم.
  function logEvent(type, payload) {
    const ev = { studentId: state.studentId, type, ...payload, ts: Date.now() };
    try {
      const buf = JSON.parse(localStorage.getItem("fcxr_events") || "[]");
      buf.push(ev);
      localStorage.setItem("fcxr_events", JSON.stringify(buf.slice(-500)));
    } catch (e) { /* تجاهل */ }
    // إرسال أفضل جهد للخادم (لا يعطّل شيئاً إن فشل — عرض ثابت مثلاً)
    fetch("/api/journey/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ev),
      keepalive: true,
    }).catch(() => {});
  }

  // ------------------------------------------------------------ عناصر DOM
  let root, stage;
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function clearStage() { stage.innerHTML = ""; }

  function ensureRoot() {
    if (root) return;
    root = el("div", "jny-root hidden");
    root.id = "journey-root";
    // شريط علوي: تقدّم + لغة + إغلاق
    const bar = el("div", "jny-bar");
    const prog = el("div", "jny-prog");
    prog.id = "jny-prog";
    const right = el("div", "jny-bar-right");
    const langBtn = el("button", "jny-icon-btn", isAr() ? "EN" : "ع");
    langBtn.title = "Language / اللغة";
    langBtn.onclick = () => {
      LANG = isAr() ? "en" : "ar";
      localStorage.setItem("fcxr_journey_lang", LANG);
      langBtn.textContent = isAr() ? "EN" : "ع";
      root.dir = isAr() ? "rtl" : "ltr";
      rerender();
    };
    const skipBtn = el("button", "jny-icon-btn", "✕");
    skipBtn.title = L("skipToExhibit");
    skipBtn.onclick = () => { logEvent("skip_to_exhibit", {}); close(true); };
    right.appendChild(langBtn);
    right.appendChild(skipBtn);
    bar.appendChild(prog);
    bar.appendChild(right);
    stage = el("div", "jny-stage");
    root.appendChild(bar);
    root.appendChild(stage);
    root.dir = isAr() ? "rtl" : "ltr";
    document.body.appendChild(root);
  }

  function updateProgressBar() {
    const spine = DATA.courses.filter((c) => c.spine);
    const done = spine.filter((c) => state.completed.has(c.code)).length;
    const pct = Math.round((done / spine.length) * 100);
    const bar = document.getElementById("jny-prog");
    if (bar) {
      bar.innerHTML =
        `<span class="jny-prog-label">${L("spine")}: ${done} ${L("of")} ${spine.length}</span>` +
        `<span class="jny-prog-track"><span class="jny-prog-fill" style="width:${pct}%"></span></span>`;
    }
  }

  // =====================================================================
  //  الأنماط البصرية الثمانية (P1–P8) — خفيفة (SVG/Canvas)، بلا نماذج ثقيلة
  // =====================================================================
  const Patterns = {
    // P2 — إشارة على سلك: خط مع نقطة متحركة
    P2_wire(host) {
      host.innerHTML =
        `<svg viewBox="0 0 320 120" class="jny-viz">
           <line x1="20" y1="60" x2="300" y2="60" class="jny-wire"/>
           <circle r="7" class="jny-dot"><animateMotion dur="1.6s" repeatCount="indefinite"
             path="M20,60 L300,60"/></circle>
           <circle cx="300" cy="60" r="12" class="jny-bulb"/>
         </svg>`;
    },
    // P3 — رسم عقدي: عقد متوهّجة يضيء بينها الاتصال
    P3_nodes(host) {
      host.innerHTML =
        `<svg viewBox="0 0 320 120" class="jny-viz">
           <line x1="60" y1="60" x2="160" y2="30" class="jny-edge"/>
           <line x1="60" y1="60" x2="160" y2="90" class="jny-edge"/>
           <line x1="160" y1="30" x2="260" y2="60" class="jny-edge"/>
           <line x1="160" y1="90" x2="260" y2="60" class="jny-edge"/>
           <circle cx="60" cy="60" r="14" class="jny-node on"/>
           <circle cx="160" cy="30" r="12" class="jny-node"/>
           <circle cx="160" cy="90" r="12" class="jny-node"/>
           <circle cx="260" cy="60" r="16" class="jny-node goal"/>
         </svg>`;
    },
    // P4 — قبل/بعد: إشارة ضعيفة ← مضخّمة
    P4_beforeafter(host) {
      host.innerHTML =
        `<svg viewBox="0 0 320 120" class="jny-viz">
           <path d="M10,60 q10,-6 20,0 t20,0 t20,0 t20,0 t20,0" class="jny-wave small"/>
           <text x="150" y="64" class="jny-arrow">⟶</text>
           <path d="M180,60 q10,-34 20,0 t20,0 t20,0 t20,0 t20,0" class="jny-wave big"/>
         </svg>`;
    },
    // P6 — صورة واقعية (تُجلب عبر وسيط الصور إن توفّر، وإلا لوحة أنيقة)
    P6_photo(host, course) {
      const q = course.photo_query || "";
      host.innerHTML = `<div class="jny-photo jny-photo-loading">${course.photo_ar || ""}</div>`;
      const box = host.firstChild;
      const src = (window.location.hostname.match(/^(localhost|127|192\.168|10\.|172\.)/))
        ? `/wallimg?f=${encodeURIComponent((q || "engineering").split(" ").join("_"))}&w=480`
        : `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(q.split(" ").join("_"))}?width=480`;
      const img = new Image();
      img.onload = () => { box.style.backgroundImage = `url(${src})`; box.classList.remove("jny-photo-loading"); box.textContent = ""; };
      img.onerror = () => { box.classList.remove("jny-photo-loading"); };
      img.src = src;
    },
    // P7 — رسم حي: منحنى يُرسم (Canvas)
    P7_plot(host) {
      host.innerHTML = `<canvas class="jny-viz" width="320" height="120"></canvas>`;
      const cv = host.firstChild, ctx = cv.getContext("2d");
      let f = 0;
      (function draw() {
        ctx.clearRect(0, 0, 320, 120);
        ctx.strokeStyle = "#3ea6ff"; ctx.lineWidth = 3; ctx.beginPath();
        for (let x = 0; x <= 320; x += 2) {
          const y = 60 - 34 * Math.sin((x / 40) + f) * Math.exp(-x / 600);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        f += 0.05;
        if (host.isConnected) requestAnimationFrame(draw);
      })();
    },
    // P8 — بنية تتراكم: مكعّبات المواد المنجزة تتجمّع
    P8_build(host) {
      const n = Math.max(1, state.completed.size);
      let blocks = "";
      for (let i = 0; i < Math.min(n, 18); i++) {
        const x = 20 + (i % 6) * 48, y = 100 - Math.floor(i / 6) * 30;
        blocks += `<rect x="${x}" y="${y}" width="40" height="24" rx="4" class="jny-block"
                    style="animation-delay:${i * 60}ms"/>`;
      }
      host.innerHTML = `<svg viewBox="0 0 320 120" class="jny-viz">${blocks}
        <path d="M150,18 L170,18 L170,10 L150,10 Z" class="jny-cap"/></svg>`;
    },
  };
  Patterns.P1_card = () => {};
  Patterns.P5_icons = (host, course) => {
    host.innerHTML = `<div class="jny-skillicons">` +
      (course.skills_ar || []).map((s, i) =>
        `<span class="jny-skillicon" style="animation-delay:${i * 120}ms">✦</span>`).join("") + `</div>`;
  };

  function renderPattern(host, course) {
    const p = course.vr_pattern || "P1_card";
    (Patterns[p] || Patterns.P1_card)(host, course);
  }

  // =====================================================================
  //  الشاشات
  // =====================================================================

  // شاشة ١: اختر التخصص
  function screenChooseMajor() {
    clearStage();
    const wrap = el("div", "jny-center");
    wrap.appendChild(el("h1", "jny-title", L("chooseMajor")));
    const grid = el("div", "jny-major-grid");
    // التخصص الحيّ
    const live = el("button", "jny-major live");
    live.innerHTML =
      `<div class="jny-major-icon">⚡</div>
       <div class="jny-major-name">${t(DATA.major.name_ar, DATA.major.name_en)}</div>
       <div class="jny-major-inst">${t(DATA.major.institution_ar, DATA.major.institution_en)}</div>`;
    live.onclick = () => { logEvent("major_selected", { major: DATA.major.id }); screenMap(); };
    grid.appendChild(live);
    // تخصّصات قادمة (upsell)
    [["🎛️", t("الهندسة الميكانيكية", "Mechanical Eng.")],
     ["💻", t("هندسة الحاسب", "Computer Eng.")],
     ["🏗️", t("الهندسة المدنية", "Civil Eng.")]].forEach(([ic, nm]) => {
      const b = el("button", "jny-major soon");
      b.innerHTML = `<div class="jny-major-icon">${ic}</div><div class="jny-major-name">${nm}</div>
                     <div class="jny-soon-badge">${L("comingSoon")}</div>`;
      b.disabled = true;
      grid.appendChild(b);
    });
    wrap.appendChild(grid);
    stage.appendChild(wrap);
  }

  // شاشة ٢: الخطة الدراسية (شجرة المسار)
  function screenMap() {
    clearStage();
    updateProgressBar();
    const wrap = el("div", "jny-map-wrap");
    wrap.appendChild(el("h2", "jny-title", L("studyPlan")));
    wrap.appendChild(el("p", "jny-sub", L("yourJourney")));

    const spine = DATA.courses.filter((c) => c.spine);
    // تجميع حسب السنة/الفصل
    const bySem = {};
    spine.forEach((c) => { (bySem[c.year + "-" + c.semester] ||= []).push(c); });
    const keys = Object.keys(bySem).sort();

    const tree = el("div", "jny-tree");
    keys.forEach((k) => {
      const [yr, sem] = k.split("-");
      const col = el("div", "jny-tree-col");
      col.appendChild(el("div", "jny-tree-head",
        `${L("year")} ${yr}<br><small>${L("semester")} ${sem}</small>`));
      bySem[k].forEach((c) => {
        const done = state.completed.has(c.code);
        const unlocked = isUnlocked(c);
        const node = el("button", "jny-course-node " +
          (done ? "done" : unlocked ? "open" : "locked"));
        node.innerHTML = `<span class="jny-code">${c.code}</span>
          <span class="jny-cname">${t(c.title_ar, c.title_en)}</span>
          <span class="jny-state">${done ? "✓" : unlocked ? "▶" : "🔒"}</span>`;
        node.onclick = () => {
          if (!unlocked && !done) return;
          courseBeat(c);
        };
        col.appendChild(node);
      });
      tree.appendChild(col);
    });
    wrap.appendChild(tree);

    // فروع المسار (upsell) + التخرّج
    const branches = el("div", "jny-branches");
    DATA.major.branches.forEach((b) => {
      const chip = el("div", "jny-branch " + (b.status === "live" ? "live" : "soon"));
      chip.innerHTML = t(b.name_ar, b.name_en) +
        (b.status === "live" ? "" : ` <small>${L("comingSoon")}</small>`);
      branches.appendChild(chip);
    });
    wrap.appendChild(branches);

    // زر التخرّج (يظهر مفعّلاً عند اكتمال المسار الأساسي)
    const allDone = spine.every((c) => state.completed.has(c.code));
    const grad = el("button", "jny-grad-btn " + (allDone ? "ready" : "locked"));
    grad.textContent = allDone ? L("enterReward") : L("graduationLocked");
    grad.disabled = !allDone;
    grad.onclick = () => screenGraduate();
    wrap.appendChild(grad);

    stage.appendChild(wrap);
  }

  function isUnlocked(course) {
    // مفتوحة إذا لا متطلّبات سابقة ضمن المسار الأساسي، أو أُنجزت كلها
    const spineCodes = new Set(DATA.courses.filter((c) => c.spine).map((c) => c.code));
    const reqs = (course.prereqs || []).filter((p) => spineCodes.has(p));
    return reqs.every((p) => state.completed.has(p));
  }

  // شاشة ٣: تجربة المادة (الإيقاع القياسي 30–90ث)
  function courseBeat(course) {
    logEvent("course_view", { course: course.code });
    clearStage();
    const card = el("div", "jny-course-card");
    // ١) الوصول
    card.appendChild(el("div", "jny-course-code", course.code));
    card.appendChild(el("h2", "jny-course-title", t(course.title_ar, course.title_en)));
    card.appendChild(el("p", "jny-pitch", t(course.pitch_ar, course.pitch_en || "")));
    // ٢) شاهدها (النمط البصري)
    const viz = el("div", "jny-viz-host");
    card.appendChild(viz);
    renderPattern(viz, course);
    // ٣) اكتسبها (المهارات)
    const skills = el("div", "jny-skills");
    skills.appendChild(el("div", "jny-skills-label", L("skills")));
    const chips = el("div", "jny-skill-chips");
    (course.skills_ar || []).forEach((s, i) => {
      const c = el("span", "jny-skill-chip", s);
      c.style.animationDelay = i * 120 + "ms";
      chips.appendChild(c);
    });
    skills.appendChild(chips);
    card.appendChild(skills);
    // ٤) اربطها (ماذا يفتح)
    if ((course.unlocks || []).length) {
      card.appendChild(el("div", "jny-unlocks",
        `<b>${L("unlocks")}</b> ${course.unlocks.join(" · ")}`));
    }
    // ٥) بوابة السؤال (أو إنهاء مباشر إن أُنجزت)
    if (course.question && !state.completed.has(course.code)) {
      card.appendChild(mcqGate(course));
    } else {
      const nextBtn = el("button", "jny-primary-btn", L("next"));
      nextBtn.onclick = () => screenMap();
      card.appendChild(nextBtn);
    }
    stage.appendChild(card);
  }

  // بوابة السؤال (حدث تحليلي)
  function mcqGate(course) {
    const box = el("div", "jny-mcq");
    box.appendChild(el("div", "jny-mcq-label", "🔑 " + L("unlockNext")));
    box.appendChild(el("div", "jny-mcq-stem",
      t(course.question.stem_ar, course.question.stem_en)));
    const opts = el("div", "jny-mcq-opts");
    const options = t(course.question.options_ar, course.question.options_en);
    const shownAt = Date.now();
    let attempts = 0;
    options.forEach((opt, i) => {
      const b = el("button", "jny-mcq-opt", opt);
      b.onclick = () => {
        const correct = i === course.question.answer;
        attempts++;
        logEvent("mcq_answer", {
          course: course.code, chosen: i, correct,
          latency_ms: Date.now() - shownAt, attempts,
        });
        if (correct) {
          b.classList.add("correct");
          [...opts.children].forEach((c) => (c.disabled = true));
          const fb = el("div", "jny-mcq-feedback ok",
            "✓ " + L("correct") +
            (course.question.why_ar ? `<br><small>${t(course.question.why_ar, course.question.why_ar)}</small>` : ""));
          box.appendChild(fb);
          state.completed.add(course.code);
          saveProgress();
          updateProgressBar();
          const cont = el("button", "jny-primary-btn", L("next"));
          cont.onclick = () => afterCourse(course);
          box.appendChild(cont);
        } else {
          b.classList.add("wrong");
          b.disabled = true;
        }
      };
      opts.appendChild(b);
    });
    box.appendChild(opts);
    return box;
  }

  // بعد إنجاز مادة: تحقّق من نهاية سنة / تفرّع / رجوع للخريطة
  function afterCourse(course) {
    // تفرّع بعد EE330
    if (course.code === "EE330") { screenBranchReveal(); return; }
    // نهاية السنة؟
    const spine = DATA.courses.filter((c) => c.spine);
    const yr = course.year;
    const yearCourses = spine.filter((c) => c.year === yr);
    const yearDone = yearCourses.every((c) => state.completed.has(c.code));
    const wasLast = yearCourses[yearCourses.length - 1].code === course.code;
    if (yearDone && wasLast && yr < 4) { screenYearComplete(yr); return; }
    // كل الأساسي منجز؟
    if (spine.every((c) => state.completed.has(c.code))) { screenGraduate(); return; }
    screenMap();
  }

  function screenYearComplete(yr) {
    logEvent("year_complete", { year: yr });
    clearStage();
    const w = el("div", "jny-center jny-milestone");
    w.appendChild(el("div", "jny-big-emoji", "🎉"));
    w.appendChild(el("h2", "jny-title", `${L("yearComplete")} ${yr}`));
    const viz = el("div", "jny-viz-host");
    w.appendChild(viz);
    Patterns.P8_build(viz);
    const btn = el("button", "jny-primary-btn", L("next"));
    btn.onclick = () => screenMap();
    w.appendChild(btn);
    stage.appendChild(w);
  }

  function screenBranchReveal() {
    logEvent("branch_reveal", {});
    clearStage();
    const w = el("div", "jny-center jny-milestone");
    w.appendChild(el("div", "jny-big-emoji", "🌳"));
    w.appendChild(el("h2", "jny-title", L("branchReveal")));
    w.appendChild(el("p", "jny-sub", L("branchBody")));
    const br = el("div", "jny-branches big");
    DATA.elective_tracks.forEach((tr) => {
      const chip = el("div", "jny-branch " + (tr.status === "live" ? "live" : "soon"));
      chip.innerHTML = t(tr.name_ar, tr.name_en) +
        (tr.status === "live" ? "" : ` <small>${L("comingSoon")}</small>`);
      br.appendChild(chip);
    });
    w.appendChild(br);
    const btn = el("button", "jny-primary-btn", L("next"));
    btn.onclick = () => screenMap();
    w.appendChild(btn);
    stage.appendChild(w);
  }

  // شاشة التخرّج
  function screenGraduate() {
    clearStage();
    state.graduated = true;
    saveProgress();
    logEvent("graduated", {});
    const w = el("div", "jny-center jny-grad");
    w.appendChild(el("div", "jny-big-emoji", "🎓"));
    w.appendChild(el("h1", "jny-title", L("graduate")));
    const viz = el("div", "jny-viz-host");
    w.appendChild(viz);
    Patterns.P8_build(viz);
    w.appendChild(el("p", "jny-sub", L("gradBody")));
    const btn = el("button", "jny-primary-btn big", L("enterReward"));
    btn.onclick = () => { logEvent("enter_reward", { room: DATA.major.reward_room }); close(false); };
    w.appendChild(btn);
    stage.appendChild(w);
  }

  // إعادة رسم الشاشة الحالية بعد تبديل اللغة (نعود للخريطة كنقطة آمنة)
  function rerender() {
    if (!root || root.classList.contains("hidden")) return;
    screenMap();
  }

  // ------------------------------------------------------------ فتح/إغلاق
  function close(skipped) {
    root.classList.add("hidden");
    document.body.classList.remove("journey-open");
    // تسليم للمعرض: إن تخرّج أو ضغط «ادخل المهنة» → غرفة الطاقة المتجددة
    if (window.Journey.onGraduate) {
      window.Journey.onGraduate({ skipped: !!skipped, graduated: state.graduated });
    }
  }

  async function start() {
    ensureRoot();
    if (!DATA) {
      try {
        const res = await fetch("./curriculum/kfu-ee.json");
        DATA = await res.json();
      } catch (e) {
        // احتياط: لا تعطّل التطبيق
        console.warn("[journey] تعذّر تحميل المنهج:", e);
        close(true);
        return;
      }
    }
    logEvent("journey_start", { major: DATA.major.id });
    root.classList.remove("hidden");
    document.body.classList.add("journey-open");
    // استئناف أم بداية؟
    const anyProgress = state.completed.size > 0;
    if (state.graduated) { screenMap(); }
    else if (anyProgress) { screenMap(); }
    else { screenChooseMajor(); }
  }

  // API عام
  window.Journey = {
    start,
    onGraduate: null, // يضبطها script.js
    reset() {
      state.completed.clear(); state.optionalRead.clear(); state.graduated = false;
      saveProgress();
    },
    hasGraduated: () => state.graduated,
  };
})();
