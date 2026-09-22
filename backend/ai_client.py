# -*- coding: utf-8 -*-
"""
ai_client.py
------------
عميل الذكاء الاصطناعي للمشروع — Groq فقط.

لماذا Groq؟
    - مفاتيح مجانية فورية من https://console.groq.com/keys (تبدأ بـ gsk_)
      دون بطاقة ائتمان، وتعمل مع كل الحسابات.
    - نموذج Llama 3.3 70B سريع وقوي بالعربية، مع بديل أخف تلقائي.

الإعداد:
    ضع مفتاحك في ملف backend/.env هكذا:
        GROQ_API_KEY=gsk_...
    ثم شغّل run_project.bat — لا حاجة لأي متغيرات بيئة في الطرفية
    (متغير بيئة النظام، إن وُجد، له الأولوية على ملف .env).

الأمان: المفتاح يُقرأ على الخادم فقط ولا يصل إلى المتصفح إطلاقاً.
"""

import json
import os
import urllib.error
import urllib.request


def _load_env_file():
    """يقرأ ملف backend/.env (اختياري) إن لم يكن المتغير مضبوطاً في النظام."""
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    values = {}
    if os.path.exists(env_path):
        with open(env_path, encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                values[key.strip()] = value.strip().strip('"').strip("'")
    return values


_ENV_FILE = _load_env_file()

GROQ_API_KEY = (os.environ.get("GROQ_API_KEY") or _ENV_FILE.get("GROQ_API_KEY", "")).strip()
GROQ_MODEL = (os.environ.get("GROQ_MODEL") or _ENV_FILE.get("GROQ_MODEL") or "llama-3.3-70b-versatile").strip()
FALLBACK_MODELS = ["llama-3.1-8b-instant"]

API_URL = "https://api.groq.com/openai/v1/chat/completions"
REQUEST_TIMEOUT = 20  # ثانية

# رسالة الفشل الودّية (بالعربية) التي تُعرض للزائر عند تعذر الخدمة.
FRIENDLY_ERROR_AR = (
    "أعتذر، تعذر الوصول إلى قاعدة معارفي في هذه اللحظة. "
    "حاول مرة أخرى بعد قليل، أو تابع استكشاف المعروضات في الغرف الثلاث."
)


def sanitize_arabic(text):
    """
    ينظّف رد النموذج قبل إرساله للواجهة.

    لماذا؟ النماذج اللغوية (ومنها Llama) تُنتج أحياناً محارف شاردة من
    كتابات أخرى (صينية/يابانية/كورية/سيريلية) في وسط النص العربي. هذا
    المرشّح يعتمد قائمة بيضاء: يُبقي العربية بكل نطاقاتها، واللاتينية
    (للمصطلحات التقنية)، والأرقام والترقيم والمسافات والرموز التعبيرية،
    ويزيل ما عداها. التنظيف هنا (على الخادم) يضمن نظافة النص أيضاً لأي
    مستهلك آخر، والواجهة تُنظّف مرة أخرى كطبقة دفاع ثانية.
    """
    if not text:
        return ""

    kept = []
    for ch in str(text):
        code = ord(ch)
        if code < 0x20:
            if ch in ("\n", "\t"):
                kept.append(ch)
            continue
        if code == 0x7F or code == 0xFFFD:
            continue
        if 0xD800 <= code <= 0xDFFF:  # محارف بديلة يتيمة
            continue
        if (
            code <= 0x024F  # لاتيني أساسي وممتد + أرقام + ترقيم
            or 0x2000 <= code <= 0x2BFF  # ترقيم عام وأسهم ورموز
            or 0x0600 <= code <= 0x06FF  # عربي
            or 0x0750 <= code <= 0x077F  # عربي ملحق
            or 0x08A0 <= code <= 0x08FF  # عربي ممتد-أ
            or 0xFB50 <= code <= 0xFDFF  # أشكال العرض العربية-أ
            or 0xFE70 <= code <= 0xFEFF  # أشكال العرض العربية-ب
            or 0x1F000 <= code <= 0x1FAFF  # رموز تعبيرية
            or code in (0x200D, 0xFE0F, 0x20E3)  # وصل/تنويع
        ):
            kept.append(ch)
        # ما عداه (CJK، كانا، هانغول، سيريلية، أشكال كاملة العرض...) يُحذف

    cleaned = "".join(kept)
    while "  " in cleaned:
        cleaned = cleaned.replace("  ", " ")
    return cleaned.strip()


def is_configured():
    """هل مفتاح Groq مضبوط؟ (وإلا نعمل بالوضع المحلي الاحتياطي)."""
    return bool(GROQ_API_KEY)


def provider_name():
    """اسم المزود النشط (للشارة في الواجهة ورسائل الإقلاع)."""
    return "Groq" if GROQ_API_KEY else None


def generate(system_prompt, history=None, user_message="", temperature=0.6, max_output_tokens=400):
    """
    يستدعي Groq (صيغة OpenAI chat/completions) ويعيد نص الرد.

    المعاملات:
        system_prompt: تعليمات النظام (شخصية «سعود» + الإجابة بالعربية).
        history: سجل المحادثة خلال الجلسة [{"role","content"}, ...].
        user_message: آخر رسالة من الزائر.

    يرفع استثناءً عند الفشل ليتراجع المستدعي إلى الوضع المحلي.
    """
    messages = [{"role": "system", "content": system_prompt}]
    for turn in history or []:
        role = "assistant" if turn.get("role") == "assistant" else "user"
        text = (turn.get("content") or "").strip()
        if text:
            messages.append({"role": role, "content": text})
    if user_message:
        messages.append({"role": "user", "content": user_message})

    models = [GROQ_MODEL] + [m for m in FALLBACK_MODELS if m != GROQ_MODEL]
    last_error = None
    for model in models:
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_output_tokens,
        }
        request = urllib.request.Request(
            API_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {GROQ_API_KEY}",
                # مهم: Cloudflare (أمام خوادم Groq) يحجب بصمة python-urllib
                # الافتراضية برمز الخطأ 1010 — ترويسة متصفحية تحل ذلك.
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FututorVR/1.0",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
                data = json.loads(response.read().decode("utf-8"))
            text = sanitize_arabic(data["choices"][0]["message"]["content"] or "")
            if not text:
                raise RuntimeError("رد Groq فارغ.")
            return text
        except urllib.error.HTTPError as error:
            last_error = error
            # 404/400 = النموذج غير متاح -> جرّب البديل التالي.
            # أي رمز آخر (401 مفتاح خاطئ / 429 حد الاستخدام...) لا تعد المحاولة.
            if error.code not in (404, 400):
                break
        except Exception as error:  # noqa: BLE001 - شبكة/تحليل/مهلة
            last_error = error
            break
    raise RuntimeError(f"فشل طلب Groq: {last_error}")

