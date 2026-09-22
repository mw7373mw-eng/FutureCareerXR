# -*- coding: utf-8 -*-
"""
check_network.py — تشخيص وصول النظارة إلى المعرض
=================================================
يفحص كل الأسباب المحتملة لعدم فتح العنوان، ويخبرك بالسبب والحل بدقة:
  1) هل الخادم يعمل ويستمع فعلاً؟
  2) أي عناوين الشبكة صالحة، وأيها بطاقات وهمية؟
  3) هل جدار حماية ويندوز يحجب المنفذ؟
  4) هل تعمل الشهادة والاتصال الآمن؟
"""

import os
import socket
import ssl
import subprocess
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_cert  # noqa: E402

PORT = int(os.environ.get("PORT", 5000))
OK = "[OK]  "
BAD = "[X]   "
FIX = "      -> "


def title(text):
    print("\n" + "=" * 62)
    print(text)
    print("=" * 62)


def try_url(url, timeout=6):
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    try:
        with urllib.request.urlopen(url, context=context, timeout=timeout) as response:
            return response.status, len(response.read(2048))
    except Exception as error:  # noqa: BLE001
        return None, str(error)


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    title("فحص وصول النظارة إلى معرض Fututor VR")

    # ---------- 1) هل الخادم يعمل؟ ----------
    print("1) هل الخادم يعمل على هذا الجهاز؟")
    scheme = None
    for candidate_scheme in ("https", "http"):
        status, _ = try_url(f"{candidate_scheme}://127.0.0.1:{PORT}/", timeout=5)
        if status == 200:
            scheme = candidate_scheme
            break

    if not scheme:
        print(BAD + f"لا يوجد خادم يستمع على المنفذ {PORT}.")
        print(FIX + "شغّل run_vr.bat أولاً واتركه مفتوحاً، ثم أعد هذا الفحص")
        print(FIX + "في نافذة أخرى.")
        return
    print(OK + f"الخادم يعمل ({scheme}) على المنفذ {PORT}.")
    if scheme == "http":
        print(FIX + "تنبيه: يعمل بوضع HTTP وليس HTTPS — الواقع الافتراضي")
        print(FIX + "لن يعمل. أغلقه وشغّل run_vr.bat بدلاً منه.")

    # ---------- 2) عناوين الشبكة ----------
    print("\n2) عناوين الشبكة على هذا الجهاز:")
    ips = make_cert.list_lan_ips()
    reachable = []
    for ip in ips:
        status, info = try_url(f"{scheme}://{ip}:{PORT}/", timeout=5)
        kind = ""
        if ip.startswith("192.168."):
            kind = "شبكة واي فاي/راوتر معتادة"
        elif ip.startswith("10."):
            kind = "شبكة داخلية (قد تكون جامعية)"
        elif ip.startswith("172."):
            kind = "غالباً بطاقة وهمية (WSL/Docker/VPN)"
        if status == 200:
            reachable.append(ip)
            print(OK + f"{scheme}://{ip}:{PORT}  — يعمل ✔  ({kind})")
        else:
            print(BAD + f"{scheme}://{ip}:{PORT}  — لا يستجيب  ({kind})")

    if not reachable:
        print(FIX + "لم يستجب أي عنوان شبكة — الغالب أن جدار الحماية يحجب المنفذ.")
    else:
        print("\n  >>> استخدم في النظارة العنوان الذي يحمل ✔ أعلاه <<<")
        best = [ip for ip in reachable if ip.startswith("192.168.")] or reachable
        print(f"  >>> الأرجح نجاحاً:  {scheme}://{best[0]}:{PORT}")

    # ---------- 3) جدار الحماية ----------
    print("\n3) جدار حماية ويندوز:")
    if os.name == "nt":
        try:
            result = subprocess.run(
                ["netsh", "advfirewall", "show", "currentprofile"],
                capture_output=True, text=True, timeout=12,
            )
            output = (result.stdout or "").lower()
            if "on" in output and "state" in output:
                print(OK + "الجدار مفعّل (طبيعي).")
                print(FIX + "إن لم يستجب أي عنوان أعلاه، اسمح لبايثون بالمرور:")
                print(FIX + "افتح موجه أوامر كمسؤول (Run as administrator) ونفّذ:")
                print(FIX + f'netsh advfirewall firewall add rule name="FututorVR" '
                            f"dir=in action=allow protocol=TCP localport={PORT}")
            else:
                print(OK + "تعذّر تحديد حالة الجدار بدقة (ليست مشكلة بالضرورة).")
        except Exception:  # noqa: BLE001
            print(OK + "تعذّر فحص الجدار (يحتاج صلاحيات) — تجاوز.")
    else:
        print(OK + "ليس ويندوز — تخطٍّ.")

    # ---------- 4) الشهادة ----------
    print("\n4) شهادة الاتصال الآمن:")
    cert_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vr_cert.pem")
    if os.path.exists(cert_path):
        print(OK + "الشهادة موجودة.")
        try:
            from cryptography import x509

            certificate = x509.load_pem_x509_certificate(open(cert_path, "rb").read())
            names = certificate.extensions.get_extension_for_class(
                x509.SubjectAlternativeName
            ).value
            covered = sorted({str(entry.value) for entry in names})
            print(FIX + f"تغطي العناوين: {', '.join(covered)}")
        except Exception:  # noqa: BLE001
            pass
    else:
        print(BAD + "لا توجد شهادة — شغّل run_vr.bat لإنشائها تلقائياً.")

    title("خلاصة")
    print("• جرّب في متصفح النظارة العنوان الذي ظهر بعلامة ✔.")
    print("• اكتب https:// كاملاً مع :" + str(PORT) + " في آخره.")
    print("• عند تحذير الأمان: Advanced ثم Proceed.")
    print("• تأكد أن النظارة والحاسب على نفس شبكة الواي فاي.")


if __name__ == "__main__":
    main()
    print()
    try:
        input("اضغط Enter للإغلاق...")
    except EOFError:
        pass
