# -*- coding: utf-8 -*-
"""
app.py
------
خادم Flask الخلفي لمشروع «Fututor VR».

نقاط النهاية:
    GET  /careers            -> يعيد بيانات كل الغرف المهنية (careers.json)
    GET  /careers/<id>       -> يعيد بيانات غرفة مهنية واحدة
    POST /recommend          -> يستقبل إجابات الاختبار ويعيد توصية مهنية
    POST /chat               -> محادثة حرة مع «سعود» (Groq إذا كان المفتاح
                                مضبوطاً، وإلا رد محلي بسيط)

التشغيل:
    python app.py

يبدأ الخادم على http://localhost:5000 ويخدم ملفات الواجهة الأمامية
مباشرة، لذا يكفي فتح http://localhost:5000 في المتصفح لتشغيل المشروع
كاملاً دون خادم منفصل للواجهة.
"""

import os
import sys
import json
import gzip
import hashlib
import urllib.parse
import urllib.request

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

import ai_client
import make_cert
from recommendation import get_recommendation
from prompts import CHAT_SYSTEM_PROMPT

# ---------------------------------------------------------------------------
# إعداد التطبيق
# ---------------------------------------------------------------------------
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
CORS(app)  # السماح للواجهة (إذا خُدمت من أصل آخر) باستدعاء هذه الواجهة البرمجية

CAREERS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "careers.json")


def load_careers():
    """يحمّل قاعدة بيانات careers.json من القرص."""
    with open(CAREERS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# خدمة ملفات الواجهة الأمامية (ليعمل المشروع كاملاً من خادم واحد)
# ---------------------------------------------------------------------------
@app.route("/")
def serve_index():
    """يخدم صفحة الواجهة الرئيسية."""
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:filename>")
def serve_static(filename):
    """يخدم أي ملف ثابت آخر للواجهة (JS، CSS، صور، نماذج GLB...)."""
    return send_from_directory(FRONTEND_DIR, filename)


# ---------------------------------------------------------------------------
# الواجهة البرمجية: /careers
# ---------------------------------------------------------------------------
@app.route("/wallimg", methods=["GET"])
def wall_image():
    """
    وسيط صور جدران المعرض: يجلب الصورة من ويكيميديا كومنز مرة واحدة،
    يخزّنها على القرص (backend/image_cache)، ثم يقدّمها من نفس الأصل.

    لماذا؟ خامات WebGL تتطلب CORS صارماً (crossOrigin=anonymous)، وقد
    تفشل بصمت مع سلاسل إعادة التوجيه الخارجية — بينما التقديم من خادمنا
    نفسه يلغي مشكلة CORS كلياً، ويضيف تخزيناً محلياً يجعل صور الجدران
    تعمل حتى دون إنترنت بعد أول تشغيل.

    الاستخدام:  /wallimg?f=<اسم الملف في كومنز>&w=<العرض>
    """
    file_name = (request.args.get("f") or "").strip()
    width = request.args.get("w", "640")
    if not file_name or "/" in file_name or "\\" in file_name or ".." in file_name:
        return jsonify({"error": "اسم ملف غير صالح."}), 400
    if not width.isdigit() or not (64 <= int(width) <= 1600):
        width = "640"

    cache_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "image_cache")
    os.makedirs(cache_dir, exist_ok=True)
    safe_key = hashlib.sha1(f"{file_name}|{width}".encode("utf-8")).hexdigest()
    cache_path = os.path.join(cache_dir, safe_key)
    meta_path = cache_path + ".mime"

    if not os.path.exists(cache_path):
        url = (
            "https://commons.wikimedia.org/wiki/Special:FilePath/"
            + urllib.parse.quote(file_name)
            + f"?width={width}"
        )
        try:
            request_obj = urllib.request.Request(
                url,
                headers={  # سياسة ويكيميديا تشترط تعريف العميل
                    "User-Agent": "FututorVR-Exhibition/1.0 (educational project)"
                },
            )
            with urllib.request.urlopen(request_obj, timeout=20) as response:
                data = response.read()
                mime = response.headers.get("Content-Type", "image/jpeg").split(";")[0]
            with open(cache_path, "wb") as handle:
                handle.write(data)
            with open(meta_path, "w", encoding="utf-8") as handle:
                handle.write(mime)
        except Exception as error:  # noqa: BLE001 - شبكة/مهلة
            print(f"[app.py] تعذر جلب صورة الجدار '{file_name}': {error}")
            return jsonify({"error": "تعذر جلب الصورة."}), 502

    mime = "image/jpeg"
    if os.path.exists(meta_path):
        with open(meta_path, encoding="utf-8") as handle:
            mime = handle.read().strip() or mime
    response = send_from_directory(cache_dir, safe_key, mimetype=mime)
    response.headers["Cache-Control"] = "public, max-age=604800"  # أسبوع
    return response


# ---------------------------------------------------------------------------
# تحسين التسليم: ضغط gzip للملفات النصية + تخزين مؤقت طويل للأصول الثابتة.
# الأثر: تحميل أول أسرع بكثير (الشيفرة والنصوص تنكمش ~70%)، وزيارات لاحقة
# شبه فورية (النماذج والصور تُقرأ من ذاكرة المتصفح بلا تنزيل).
# ---------------------------------------------------------------------------
COMPRESSIBLE = ("text/", "application/javascript", "application/json", "image/svg+xml")
LONG_CACHE_EXT = (".glb", ".jpg", ".jpeg", ".png", ".webp", ".mp4", ".woff", ".woff2")


@app.after_request
def optimize_response(response):
    try:
        path = request.path or ""
        # تخزين مؤقت: أصول ثقيلة ثابتة -> سنة كاملة؛ شيفرة -> إعادة تحقق.
        if path.endswith(LONG_CACHE_EXT):
            # تعيين صريح (لا setdefault) لتجاوز ترويسة Flask الافتراضية
            # no-cache — فتُقرأ النماذج والصور من ذاكرة المتصفح بلا أي طلب.
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        elif path.endswith((".js", ".css", ".html", ".json")) or path == "/":
            # تعيين صريح (كان setdefault فتغلبه ترويسة Flask الافتراضية
            # للملفات الثابتة ويُخزَّن السكربت حتى 12 ساعة — فيشغّل المتصفح
            # شيفرة قديمة بعد كل تحديث: سبب «أدخل الغرفة المحذوفة»)
            response.headers["Cache-Control"] = "no-cache, must-revalidate"

        # ضغط gzip للنصوص فقط (النماذج والصور مضغوطة أصلاً فلا فائدة).
        content_type = (response.headers.get("Content-Type") or "").split(";")[0]
        if (
            content_type.startswith(COMPRESSIBLE)
            and "gzip" in (request.headers.get("Accept-Encoding") or "")
            and response.status_code == 200
            and "Content-Encoding" not in response.headers
        ):
            # ملفات send_from_directory تُرسل بوضع passthrough؛ نوقفه هنا
            # لقراءة المحتوى وضغطه (النصوص فقط — انظر COMPRESSIBLE).
            response.direct_passthrough = False
            payload = response.get_data()
            if len(payload) > 1024:  # لا فائدة من ضغط الصغير جداً
                compressed = gzip.compress(payload, compresslevel=6)
                if len(compressed) < len(payload):
                    response.set_data(compressed)
                    response.headers["Content-Encoding"] = "gzip"
                    response.headers["Content-Length"] = str(len(compressed))
                    response.headers.add("Vary", "Accept-Encoding")
    except Exception as error:  # noqa: BLE001 - التحسين لا يجب أن يُسقط طلباً
        print(f"[app.py] تخطي تحسين الاستجابة: {error}")
    return response


@app.route("/api/journey/event", methods=["POST"])
def journey_event():
    """
    يستقبل أحداث «الرحلة الجامعية» ويُلحقها بملف JSONL محلي
    (backend/journey_events.jsonl) — الأساس الخام للوحة تحليلات القسم.

    يعمل محلياً بلا أي خدمة خارجية. كل حدث سطر JSON مستقل، فيسهل تحليله
    لاحقاً بأي أداة (Excel/pandas/لوحة ويب).
    """
    data = request.get_json(silent=True) or {}
    if not data.get("type"):
        return jsonify({"error": "نوع الحدث مفقود"}), 400
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "journey_events.jsonl")
    try:
        with open(path, "a", encoding="utf-8") as handle:
            handle.write(json.dumps(data, ensure_ascii=False) + "\n")
    except Exception as error:  # noqa: BLE001
        print(f"[app.py] تعذّر تسجيل حدث الرحلة: {error}")
        return jsonify({"ok": False}), 200  # لا تُفشل تجربة الطالب
    return jsonify({"ok": True})


@app.route("/api/journey/analytics", methods=["GET"])
def journey_analytics():
    """
    ملخّص تحليلي بسيط يُقرأ من ملف الأحداث — نواة لوحة القسم:
    عدد الطلاب، معدّل الإجابات الصحيحة لكل مادة (خريطة الحيرة)، ومعدّل
    الإكمال. لوحة ويب كاملة تُبنى فوق هذا لاحقاً.
    """
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "journey_events.jsonl")
    students, graduated = set(), set()
    per_course = {}   # code -> [correct, total]
    starts = 0
    if os.path.exists(path):
        with open(path, encoding="utf-8") as handle:
            for line in handle:
                try:
                    ev = json.loads(line)
                except ValueError:
                    continue
                sid = ev.get("studentId")
                if sid:
                    students.add(sid)
                etype = ev.get("type")
                if etype == "journey_start":
                    starts += 1
                elif etype == "graduated" and sid:
                    graduated.add(sid)
                elif etype == "mcq_answer":
                    c = ev.get("course", "?")
                    rec = per_course.setdefault(c, [0, 0])
                    rec[1] += 1
                    if ev.get("correct"):
                        rec[0] += 1
    confusion = {
        c: {"correct_rate": round(v[0] / v[1], 2) if v[1] else None, "attempts": v[1]}
        for c, v in per_course.items()
    }
    return jsonify({
        "students": len(students),
        "journeys_started": starts,
        "graduated": len(graduated),
        "completion_rate": round(len(graduated) / len(students), 2) if students else 0,
        "course_confusion": confusion,
    })


@app.route("/careers", methods=["GET"])
def get_all_careers():
    """
    يعيد قاعدة بيانات المهن الكاملة (الغرف الثلاث) بصيغة JSON.
    تستخدمها الواجهة لملء محتوى الغرف وبطاقات الأجسام التفاعلية
    وأقسام «الرؤية المستقبلية».
    """
    try:
        return jsonify(load_careers())
    except Exception as error:  # noqa: BLE001
        return jsonify({"error": str(error)}), 500


@app.route("/careers/<career_id>", methods=["GET"])
def get_single_career(career_id):
    """يعيد بيانات غرفة مهنية واحدة بمعرّفها (مثل 'renewable_energy')."""
    try:
        careers = load_careers()
        if career_id not in careers:
            return jsonify({"error": f"المسار المهني '{career_id}' غير موجود"}), 404
        return jsonify(careers[career_id])
    except Exception as error:  # noqa: BLE001
        return jsonify({"error": str(error)}), 500


# ---------------------------------------------------------------------------
# الواجهة البرمجية: /recommend
# ---------------------------------------------------------------------------
@app.route("/recommend", methods=["POST"])
def recommend():
    """
    يستقبل إجابات اختبار الزائر ويعيد توصية مهنية.

    جسم JSON المتوقع:
        { "answers": ["تحديات البرمجة", "مختبرات أبحاث الذكاء الاصطناعي", ...] }

    يعيد JSON:
        {
          "recommended_career": "الذكاء الاصطناعي",
          "recommended_career_id": "artificial_intelligence",
          "reasoning": "...",
          "suggested_majors": [...],
          "useful_skills": [...],
          "scores": {...},
          "mode": "offline" | "online"
        }
    """
    data = request.get_json(silent=True) or {}
    answers = data.get("answers", [])

    if not answers or not isinstance(answers, list):
        return jsonify({"error": "يرجى إرسال مصفوفة 'answers' تتضمن إجاباتك على الاختبار."}), 400

    result = get_recommendation(answers)
    return jsonify(result)


# ---------------------------------------------------------------------------
# الواجهة البرمجية: /chat
# ---------------------------------------------------------------------------
@app.route("/chat", methods=["POST"])
def chat():
    """
    يستقبل رسالة محادثة حرة إلى «سعود» ويعيد رداً.

    جسم JSON المتوقع:
        {
          "message": "أخبرني المزيد عن توربينات الرياح",
          "history": [{"role": "user"/"assistant", "content": "..."}, ...]  (اختياري)
        }

    إذا كان مفتاح Groq مضبوطاً (في backend/.env) يُستخدم النموذج اللغوي
    الحقيقي، وإلا يُعاد رد محلي خفيف حتى تبقى المحادثة متجاوبة دون اتصال.

    سجل المحادثة (history) يُرسل من الواجهة مع كل رسالة، فيبقى «سعود»
    متذكرة سياق الجلسة الحالية.
    """
    data = request.get_json(silent=True) or {}
    user_message = data.get("message", "").strip()
    history = data.get("history", [])

    if not user_message:
        return jsonify({"error": "يرجى إرسال حقل 'message' يتضمن رسالتك."}), 400

    if ai_client.is_configured():
        try:
            reply = ai_client.generate(
                system_prompt=CHAT_SYSTEM_PROMPT,
                history=history,
                user_message=user_message,
                temperature=0.6,
                max_output_tokens=400,
            )
            return jsonify({"reply": reply, "mode": "online", "provider": ai_client.provider_name()})
        except Exception as error:  # noqa: BLE001
            print(f"[app.py] فشلت محادثة Groq، سيتم التراجع إلى الرد المحلي: {error}")

    # --- الرد المحلي الاحتياطي ---
    # ردود جاهزة بسيطة قائمة على الكلمات المفتاحية حتى تبقى «سعود» حية
    # دون مفتاح API. وسّع هذا القاموس بحسب الحاجة.
    offline_replies = {
        "شمس": "تحوّل الألواح الشمسية ضوء الشمس إلى كهرباء عبر الظاهرة الكهروضوئية!",
        "رياح": "تحوّل توربينات الرياح الطاقة الحركية للرياح إلى كهرباء عبر دوّار ومولد.",
        "ذكاء": "الذكاء الاصطناعي يمكّن الآلات من تعلّم الأنماط من البيانات لاتخاذ قرارات وتنبؤات.",
        "روبوت": "تجمع الروبوتات بين الحساسات والمشغّلات ونماذج الذكاء الاصطناعي لتدرك العالم المادي وتتصرف فيه.",
        "جراح": "الروبوت الجراحي ينقل حركات يد الجراح إلى أدوات دقيقة داخل جسم المريض، بدقة تفوق اليد البشرية!",
        "منظار": "كاميرا المنظار الجراحي هي عين الجراح داخل الجسم — تصوير مكبر عالي الدقة عبر شق صغير جداً.",
        "أدوات": "الأدوات الجراحية الدقيقة تُثبَّت على أذرع الروبوت وتحاكي رسغ الإنسان بمفاصل مصغّرة بسبع درجات حرية.",
        "تحكم": "وحدة تحكم الروبوت هي مقعد قيادة الجراح — منها يوجّه أذرع الروبوت بدقة تفوق يد الإنسان.",
        "إضاءة": "الإضاءة الجراحية توفر ضوءاً قوياً بلا ظلال فوق منطقة الجراحة عبر مصفوفات LED متعددة الزوايا.",
        "جامع": "أفتخر بمساعدتك على استكشاف أفضل الجامعات السعودية لكل تخصص — افتح كشك «الرؤية المستقبلية» في أي غرفة لرؤية التوصيات.",
        "طاقة": "الطاقة المتجددة — من الشمس والرياح — هي أساس مستقبل مستدام للكهرباء في العالم.",
        "مرحبا": "أهلاً! أنا «سعود»، مساعدك الذكي للإرشاد المهني. مستعد لاستكشاف مسارك المهني المستقبلي؟",
        "السلام": "وعليكم السلام! أنا «سعود»، مساعدك الذكي للإرشاد المهني. كيف أساعدك اليوم؟",
    }

    reply = "سؤال رائع! استكشف الغرف لتتعلم المزيد، أو اسألني عن جهاز محدد."
    for keyword, canned_reply in offline_replies.items():
        if keyword in user_message:
            reply = canned_reply
            break

    return jsonify({"reply": reply, "mode": "offline"})


if __name__ == "__main__":
    # منصات الاستضافة (Render, Railway, Fly.io...) تحدد رقم المنفذ عبر
    # متغير البيئة PORT تلقائياً؛ محلياً يبقى الافتراضي 5000 كما كان.
    port = int(os.environ.get("PORT", 5000))
    # عطّل وضع debug افتراضياً (أكثر أماناً للنشر العلني)؛ فعّله محلياً
    # عند الحاجة بضبط FLASK_DEBUG=1 قبل التشغيل.
    debug_mode = os.environ.get("FLASK_DEBUG", "0") == "1"
    # حالة مزود الذكاء الاصطناعي عند الإقلاع — تظهر مباشرة في نافذة الطرفية.
    # ---------------------------------------------------------------
    # وضع الواقع الافتراضي (HTTPS محلي): يُفعَّل بتشغيل run_vr.bat أو
    # بضبط VR_HTTPS=1. معيار WebXR لا يعمل إلا على اتصال آمن، وهذا
    # يغني تماماً عن الأنفاق الخارجية (أسرع، ويعمل بلا إنترنت).
    # ---------------------------------------------------------------
    use_https = os.environ.get("VR_HTTPS", "0") == "1" or "--https" in sys.argv
    ssl_context = None
    lan_ip = make_cert.get_lan_ip()
    if use_https:
        cert_path, key_path = make_cert.ensure_certificate(lan_ip)
        if cert_path:
            ssl_context = (cert_path, key_path)
        else:
            print("[app.py] تعذر إنشاء شهادة HTTPS — مكتبة cryptography غير مثبتة.")
            print("[app.py] ثبّتها ثم أعد المحاولة:  python -m pip install cryptography")

    provider = ai_client.provider_name()
    print("[app.py] مزود الذكاء الاصطناعي:", f"{provider} مفعّل ✅" if provider else "غير مضبوط — الوضع المحلي ⚠️")
    scheme = "https" if ssl_context else "http"
    all_ips = make_cert.list_lan_ips()
    print("=" * 64)
    print(f"  على هذا الحاسب:   {scheme}://localhost:{port}")
    print("")
    if ssl_context:
        print("  من متصفح نظارة الواقع الافتراضي، جرّب العناوين بالترتيب:")
    else:
        print("  على الشبكة المحلية:")
    for index, ip in enumerate(all_ips, start=1):
        # تلميح: 172.16-31 و 10.x كثيراً ما تكون بطاقات وهمية (WSL/VPN)
        hint = ""
        if ip.startswith("192.168."):
            hint = "  <- الأرجح (شبكة الواي فاي المعتادة)"
        elif ip.startswith("172."):
            hint = "  <- غالباً بطاقة وهمية (WSL/Docker/VPN) وقد لا تصل إليها النظارة"
        print(f"    {index}) {scheme}://{ip}:{port}{hint}")
    if ssl_context:
        print("")
        print("  ستظهر رسالة تحذير أمني (الشهادة محلية) — اضغط Advanced ثم")
        print("  Proceed. آمن تماماً لأن الاتصال لا يغادر شبكتك.")
        print("")
        print("  لا يفتح أي عنوان؟ شغّل check_network.bat لتشخيص السبب.")
    else:
        print("  لتشغيل نظارة الواقع الافتراضي استخدم run_vr.bat (يفعّل HTTPS).")
    print("=" * 64)
    app.run(host="0.0.0.0", port=port, debug=debug_mode, ssl_context=ssl_context)
