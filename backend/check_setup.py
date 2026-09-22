# -*- coding: utf-8 -*-
"""
check_setup.py — فاحص الإعداد الذاتي
------------------------------------
شغّله بالنقر المزدوج على check_setup.bat (أو: python check_setup.py)
وسيفحص كل شيء خطوة بخطوة ويخبرك بالمشكلة بالضبط وكيف تصلحها.
"""

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
OK = "[OK]  "
BAD = "[X]   "
FIX = "      -> "


def title(text):
    print("\n" + "=" * 60)
    print(text)
    print("=" * 60)


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    title("فاحص إعداد Fututor VR — Groq")

    # ---------- 1) هل نحن في المجلد الصحيح؟ ----------
    required = ["app.py", "ai_client.py", "careers.json"]
    missing = [f for f in required if not os.path.exists(os.path.join(BASE, f))]
    if missing:
        print(BAD + f"ملفات ناقصة في هذا المجلد: {missing}")
        print(FIX + "أنت تشغّل الفاحص من نسخة قديمة من المشروع.")
        print(FIX + "استخرج أحدث ملف مضغوط وشغّل الفاحص من مجلد backend فيه.")
        return
    print(OK + "المجلد صحيح (أحدث نسخة من الخادم موجودة).")

    # ---------- 2) ملف .env: موجود؟ باسم صحيح؟ ----------
    env_path = os.path.join(BASE, ".env")
    wrong_names = [n for n in os.listdir(BASE) if n.lower() in (".env.txt", "env.txt", "env")]
    if not os.path.exists(env_path) and wrong_names:
        old = os.path.join(BASE, wrong_names[0])
        os.rename(old, env_path)
        print(OK + f"وجدت الملف باسم خاطئ ({wrong_names[0]}) وأعدت تسميته إلى .env تلقائياً ✔")
    if not os.path.exists(env_path):
        print(BAD + "ملف backend/.env غير موجود.")
        print(FIX + "أنشئ ملفاً باسم .env (بالنقطة، دون .txt) داخل مجلد backend،")
        print(FIX + "واكتب فيه سطراً واحداً:  GROQ_API_KEY=gsk_مفتاحك")
        return
    print(OK + "ملف .env موجود بالاسم الصحيح.")

    # ---------- 3) محتوى .env: المفتاح مكتوب صح؟ ----------
    key = ""
    with open(env_path, encoding="utf-8", errors="replace") as handle:
        for line in handle:
            line = line.strip().lstrip("\ufeff")
            if line.startswith("GROQ_API_KEY"):
                _, _, value = line.partition("=")
                key = value.strip().strip('"').strip("'")
    env_key = os.environ.get("GROQ_API_KEY", "").strip()
    if env_key:
        key = env_key
        print(OK + "المفتاح مأخوذ من متغير بيئة النظام (له الأولوية على .env).")

    if not key:
        print(BAD + "سطر GROQ_API_KEY فارغ أو غير موجود في .env.")
        print(FIX + "افتح .env واجعل السطر هكذا بالضبط (المفتاح بعد = مباشرة):")
        print(FIX + "GROQ_API_KEY=gsk_....................")
        return
    masked = key[:7] + "..." + key[-4:] if len(key) > 14 else key
    if key.startswith("AQ."):
        print(BAD + f"المفتاح ({masked}) بصيغة AQ. — هذا مفتاح Google القديم وليس مفتاح Groq!")
        print(FIX + "مفتاح Groq يبدأ بـ gsk_ — احصل عليه من: https://console.groq.com/keys")
        return
    if not key.startswith("gsk_"):
        print(BAD + f"المفتاح ({masked}) لا يبدأ بـ gsk_ — هذا ليس مفتاح Groq.")
        print(FIX + "أنشئ مفتاحاً من https://console.groq.com/keys وانسخه كاملاً كما هو.")
        return
    if " " in key:
        print(BAD + "المفتاح يحتوي مسافة في وسطه — نُسخ ناقصاً أو التُقط بسطرين.")
        print(FIX + "أعد نسخه من موقع Groq بضغطة زر النسخ، وألصقه في سطر واحد.")
        return
    print(OK + f"صيغة المفتاح صحيحة: {masked} (طوله {len(key)} حرفاً).")

    # ---------- 4) اختبار حي على خادم Groq ----------
    print("\nجارٍ اختبار المفتاح على خادم Groq مباشرة...")
    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": [{"role": "user", "content": "قل: يعمل"}],
        "max_tokens": 10,
    }
    request = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FututorVR/1.0",  # تجاوز حجب Cloudflare لبصمة بايثون
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            data = json.loads(response.read().decode("utf-8"))
        reply = data["choices"][0]["message"]["content"].strip()
        print(OK + f"نجح الاتصال! رد Groq: «{reply}»")
        title("النتيجة: كل شيء سليم ✅")
        print("شغّل الآن run_project.bat وسترى: مزود الذكاء الاصطناعي: Groq مفعّل")
        print("وستظهر شارة «الوضع المتصل (Groq)» عند محادثة سعود.")
    except urllib.error.HTTPError as error:
        body = ""
        try:
            body = error.read().decode("utf-8", "replace")[:300]
        except Exception:  # noqa: BLE001
            pass
        print(BAD + f"رفض خادم Groq الطلب: HTTP {error.code}")
        if error.code == 401:
            print(FIX + "المفتاح غير صالح (نُسخ ناقصاً أو حُذف من حسابك).")
            print(FIX + "ادخل https://console.groq.com/keys واحذف المفتاح وأنشئ واحداً جديداً وانسخه كاملاً.")
        elif "1010" in body:
            print(FIX + "ما زال جدار Cloudflare يحجب الاتصال رغم الترويسة المتصفحية.")
            print(FIX + "المشكلة من الشبكة/العنوان لا من المفتاح — جرّب بالترتيب:")
            print(FIX + "1) نقطة اتصال الجوال (Hotspot) بدل الواي فاي الحالي.")
            print(FIX + "2) عطّل مؤقتاً أي VPN أو بروكسي أو برنامج حماية يعترض الاتصالات.")
        elif error.code == 429:
            print(FIX + "تجاوزت حد الاستخدام المجاني مؤقتاً — انتظر دقيقة وأعد المحاولة.")
        else:
            print(FIX + f"تفاصيل الخادم: {body}")
    except urllib.error.URLError as error:
        print(BAD + f"تعذر الوصول إلى api.groq.com إطلاقاً: {error.reason}")
        print(FIX + "المشكلة في الشبكة وليست في المفتاح:")
        print(FIX + "- تأكد من اتصال الإنترنت.")
        print(FIX + "- إن كنت على شبكة جامعة/عمل فقد تكون الخدمة محجوبة — جرّب نقطة اتصال الجوال.")
        print(FIX + "- بعض برامج الحماية/الجدر النارية تمنع بايثون من الاتصال — اسمح له مؤقتاً.")
    except Exception as error:  # noqa: BLE001
        print(BAD + f"خطأ غير متوقع: {error}")


if __name__ == "__main__":
    main()
    print()
    try:
        input("اضغط Enter للإغلاق...")
    except EOFError:
        pass
