# -*- coding: utf-8 -*-
"""
recommendation.py
------------------
محرك التوصية المهنية لمشروع «Fututor VR».

وضعان للعمل:
1. الوضع المتصل  -> يستخدم واجهة Groq المجانية إذا كان مفتاح GROQ_API_KEY
                    مضبوطاً في backend/.env.
2. الوضع المحلي  -> نظام تقييم شفاف قائم على قواعد موزونة يعمل
                    دون أي اعتماديات خارجية أو مفاتيح API.

يتراجع المحرك تلقائياً إلى الوضع المحلي إذا لم يُضبط مفتاح، أو إذا فشل
طلب Groq لأي سبب (مشكلة شبكة، مفتاح غير صالح، تجاوز حد الاستخدام...)،
حتى لا يتعطل العرض التوضيحي أبداً أثناء التقديم المباشر.

المسارات الثلاثة:
    - هندسة الطاقة المتجددة  (renewable_energy)
    - الذكاء الاصطناعي        (artificial_intelligence)
    - الروبوتات الجراحية      (surgical_robotics)
"""

import os
import json

from prompts import build_recommendation_prompt

# مفتاح Groq يُدار مركزياً في ai_client.py (يُقرأ من backend/.env).
import ai_client


# ---------------------------------------------------------------------------
# نظام التقييم المحلي القائم على القواعد الموزونة
# ---------------------------------------------------------------------------
# كل كلمة مفتاحية (نص خيار من خيارات الاختبار بالعربية) تضيف نقاطاً موزونة
# إلى مسار مهني أو أكثر.
# المسارات: "renewable_energy" ، "artificial_intelligence" ، "surgical_robotics"
#
# الأسئلة الجديدة تستهدف الهندسة والروبوتات والتقنية الدقيقة والابتكار
# الصحي (بدل الأسئلة الطبية العامة السابقة). القاموس بسيط عمداً وسهل
# التوسعة — أضف كلمات/إجابات وأوزاناً جديدة بحسب أسئلتك.
#
# ملاحظة المطابقة: يُفحص احتواء الإجابة على المفتاح (substring)، لذلك
# اختيرت المفاتيح بحيث تميز كل خيار حتى مع تداخل بعض العبارات.
# ---------------------------------------------------------------------------
SCORING_RULES = {
    # السؤال 1: أي نوع من المشكلات تستمتع بحلّها؟
    "تحديات الطاقة": {"renewable_energy": 3, "artificial_intelligence": 0, "surgical_robotics": 0},
    "تحديات البرمجة": {"renewable_energy": 0, "artificial_intelligence": 3, "surgical_robotics": 0},
    "أنظمة الروبوتات الدقيقة": {"renewable_energy": 0, "artificial_intelligence": 0, "surgical_robotics": 3},
    "الأتمتة الصناعية": {"renewable_energy": 1, "artificial_intelligence": 1, "surgical_robotics": 0},

    # السؤال 2: أي بيئة عمل تثير اهتمامك أكثر؟
    "المستشفيات الذكية": {"renewable_energy": 0, "artificial_intelligence": 0, "surgical_robotics": 3},
    "محطات الطاقة المتجددة": {"renewable_energy": 3, "artificial_intelligence": 0, "surgical_robotics": 0},
    "مختبرات أبحاث": {"renewable_energy": 0, "artificial_intelligence": 2, "surgical_robotics": 0},
    "مختبرات الروبوتات": {"renewable_energy": 0, "artificial_intelligence": 1, "surgical_robotics": 2},

    # السؤال 3: أي تقنية تحمّسك أكثر؟
    "الطاقة الشمسية": {"renewable_energy": 3, "artificial_intelligence": 0, "surgical_robotics": 0},
    "الذكاء الاصطناعي": {"renewable_energy": 0, "artificial_intelligence": 2, "surgical_robotics": 0},
    "الروبوتات الجراحية": {"renewable_energy": 0, "artificial_intelligence": 0, "surgical_robotics": 3},
    "الأتمتة": {"renewable_energy": 0, "artificial_intelligence": 1, "surgical_robotics": 1},

    # السؤال 4: ما الذي يحفّزك؟
    "الاستدامة": {"renewable_energy": 3, "artificial_intelligence": 0, "surgical_robotics": 0},
    "البرمجيات الذكية": {"renewable_energy": 0, "artificial_intelligence": 3, "surgical_robotics": 0},
    "تحسين نتائج المرضى": {"renewable_energy": 0, "artificial_intelligence": 0, "surgical_robotics": 3},
    "الابتكار": {"renewable_energy": 1, "artificial_intelligence": 1, "surgical_robotics": 1},

    # السؤال 5: أي نشاط يبدو الأكثر متعة بالنسبة لك؟
    "تصميم أنظمة الطاقة": {"renewable_energy": 3, "artificial_intelligence": 0, "surgical_robotics": 0},
    "بناء نماذج": {"renewable_energy": 0, "artificial_intelligence": 2, "surgical_robotics": 0},
    "برمجة الروبوتات الجراحية": {"renewable_energy": 0, "artificial_intelligence": 0, "surgical_robotics": 3},
    "الآلات ذاتية التشغيل": {"renewable_energy": 0, "artificial_intelligence": 2, "surgical_robotics": 1},
}

# عناوين المسارات الثلاثة — تظهر للزائر كما هي، ويجب أن تطابق ما يعيده
# النموذج اللغوي في الوضع المتصل (انظر prompts.py).
CAREER_TITLES = {
    "renewable_energy": "هندسة الطاقة المتجددة",
    "artificial_intelligence": "الذكاء الاصطناعي",
    "surgical_robotics": "الروبوتات الجراحية",
}

# نصوص تعليل التوصية لكل مسار (بالعربية الفصحى).
CAREER_REASONING_TEMPLATES = {
    "renewable_energy": (
        "نوصيك بمسار هندسة الطاقة المتجددة لأن إجاباتك تُظهر ميلاً واضحاً "
        "إلى حل المشكلات الهندسية العملية، وشغفاً بالاستدامة، وبناء الأنظمة "
        "التي تصنع مستقبلاً نظيفاً للطاقة."
    ),
    "artificial_intelligence": (
        "نوصيك بمسار الذكاء الاصطناعي لأن إجاباتك تعكس حباً للبرمجة "
        "والبيانات وبناء البرمجيات الذكية التي تحل مشكلات معقدة."
    ),
    "surgical_robotics": (
        "نوصيك بمسار الروبوتات الجراحية لأن إجاباتك تُظهر اهتماماً "
        "بالأنظمة الروبوتية الدقيقة والابتكار الصحي، ورغبة في تحسين حياة "
        "المرضى عبر التقنية والهندسة الدقيقة."
    ),
}

# التخصصات الجامعية المقترحة لكل مسار.
SUGGESTED_MAJORS = {
    "renewable_energy": ["الهندسة الكهربائية", "هندسة الطاقة المتجددة", "الهندسة الميكانيكية"],
    "artificial_intelligence": ["علوم الحاسب", "الذكاء الاصطناعي", "علوم البيانات"],
    "surgical_robotics": ["هندسة الميكاترونكس", "الهندسة الطبية الحيوية", "هندسة الروبوتات"],
}

# المهارات المفيدة لكل مسار.
USEFUL_SKILLS = {
    "renewable_energy": ["MATLAB/Simulink", "تحليل أنظمة القدرة الكهربائية", "أنظمة PLC/SCADA", "تحليل الاستدامة"],
    "artificial_intelligence": ["لغة بايثون", "تعلّم الآلة", "الجبر الخطي", "أطر التعلم العميق"],
    "surgical_robotics": ["برمجة الروبوتات (ROS)", "أنظمة التحكم الدقيق", "الرؤية الحاسوبية", "معايير الأجهزة الطبية"],
}


def _score_answers_offline(answers):
    """
    يقيّم قائمة إجابات (نص حر أو خيارات) مقابل قاموس SCORING_RULES
    ويعيد مجموع النقاط لكل مسار.
    """
    scores = {"renewable_energy": 0, "artificial_intelligence": 0, "surgical_robotics": 0}

    for answer in answers:
        # المطابقة تتم على النص العربي كما هو (مع إزالة الفراغات الزائدة).
        normalized = str(answer).strip()
        for keyword, weights in SCORING_RULES.items():
            if keyword in normalized:
                for category, points in weights.items():
                    scores[category] += points

    return scores


def get_offline_recommendation(answers):
    """
    ينتج توصية كاملة باستخدام نظام التقييم المحلي الموزون.
    ينجح دائماً — هذا هو مسار الأمان المضمون.
    """
    scores = _score_answers_offline(answers)

    # اختيار المسار الأعلى نقاطاً (يُحسم التعادل بترتيب ثابت).
    best_category = max(scores, key=lambda key: (scores[key], key))

    return {
        "recommended_career": CAREER_TITLES[best_category],
        "recommended_career_id": best_category,
        "reasoning": CAREER_REASONING_TEMPLATES[best_category],
        "suggested_majors": SUGGESTED_MAJORS[best_category],
        "useful_skills": USEFUL_SKILLS[best_category],
        "scores": scores,
        "mode": "offline",
    }


def get_online_recommendation(answers):
    """
    يحاول الحصول على توصية من واجهة Groq. يرفع استثناءً عند أي
    فشل حتى يتراجع المستدعي إلى الوضع المحلي.
    """
    prompt = build_recommendation_prompt(answers)

    raw_text = ai_client.generate(
        system_prompt=(
            "أنت «سعود»، مساعد إرشاد مهني ذكي. أجب دائماً باللغة العربية "
            "الفصحى، وبصيغة JSON صالحة فقط دون أي نص إضافي."
        ),
        user_message=prompt,
        temperature=0.4,
        max_output_tokens=600,
    ).strip()

    # إزالة أسوار الشيفرة (markdown) إذا غلّف النموذج الـJSON بها.
    if raw_text.startswith("```"):
        raw_text = raw_text.strip("`")
        raw_text = raw_text.replace("json", "", 1).strip()

    parsed = json.loads(raw_text)

    # تحويل عنوان المسار إلى المعرّف الداخلي الذي تفهمه الواجهة.
    title_to_id = {v: k for k, v in CAREER_TITLES.items()}
    career_id = title_to_id.get(parsed.get("recommended_career"), "artificial_intelligence")

    return {
        "recommended_career": parsed.get("recommended_career"),
        "recommended_career_id": career_id,
        "reasoning": parsed.get("reasoning"),
        "suggested_majors": parsed.get("suggested_majors", []),
        "useful_skills": parsed.get("useful_skills", []),
        "scores": _score_answers_offline(answers),
        "mode": "online",
        "provider": ai_client.provider_name(),
    }


def get_recommendation(answers):
    """
    نقطة الدخول الرئيسية التي يستخدمها تطبيق Flask. يجرّب Groq أولاً
    (فقط إذا كان المفتاح مضبوطاً)، ويتراجع بشفافية إلى المحرك المحلي
    عند أي فشل — لضمان إرجاع نتيجة صالحة دائماً.
    """
    if ai_client.is_configured():
        try:
            return get_online_recommendation(answers)
        except Exception as error:  # noqa: BLE001 - التقاط واسع مقصود لمرونة العرض
            print(f"[recommendation.py] فشل طلب Groq، سيتم التراجع إلى الوضع المحلي: {error}")
            return get_offline_recommendation(answers)

    return get_offline_recommendation(answers)
