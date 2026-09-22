# -*- coding: utf-8 -*-
"""
make_cert.py — إنشاء شهادة HTTPS محلية للتشغيل على نظارة الواقع الافتراضي
=========================================================================
لماذا؟ معيار WebXR يرفض العمل إلا على اتصال آمن (HTTPS) أو على localhost.
وبدل الاعتماد على نفق خارجي (ngrok) — وقد يكون محجوباً على شبكتك، وهو
أبطأ لأن كل النماذج تمر عبر خوادم بعيدة — نُنشئ شهادة موقّعة ذاتياً
ونقدّم المعرض مباشرة عبر شبكة الواي فاي المحلية:

    ✔ لا يحتاج إنترنت إطلاقاً (يكفي أن يكون الجهازان على نفس الشبكة).
    ✔ أسرع بكثير (النماذج تُنقل عبر الشبكة المحلية لا عبر خوادم بعيدة).
    ✔ العنوان ثابت لا يتغير مع كل تشغيل.

تُستدعى تلقائياً من app.py عند التشغيل بوضع HTTPS، ويمكن تشغيلها منفردة.
"""

import datetime
import ipaddress
import os
import socket

CERT_DIR = os.path.dirname(os.path.abspath(__file__))
CERT_PATH = os.path.join(CERT_DIR, "vr_cert.pem")
KEY_PATH = os.path.join(CERT_DIR, "vr_key.pem")


def _rank_ip(ip):
    """
    ترتيب أفضلية عناوين الشبكة.

    السبب: الحواسيب تحوي عادةً عدة بطاقات شبكة — واي فاي حقيقي، وبطاقات
    وهمية (WSL، Docker، VirtualBox، VPN). العنوان الوهمي لا تصل إليه
    النظارة أبداً. عناوين 192.168.x هي شبكات المنزل/الراوتر النموذجية،
    ثم 10.x، وأخيراً 172.16–31.x التي تستخدمها غالباً البطاقات الوهمية.
    """
    if ip.startswith("192.168."):
        return 0
    if ip.startswith("10."):
        return 1
    try:
        second = int(ip.split(".")[1])
        if ip.startswith("172.") and 16 <= second <= 31:
            return 2
    except (IndexError, ValueError):
        pass
    return 3


def list_lan_ips():
    """يعيد كل عناوين IPv4 المحلية للجهاز مرتبة بالأفضلية."""
    found = set()

    # 1) العنوان المستخدم للخروج إلى الشبكة (لا يُرسل أي بيانات فعلياً)
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        found.add(sock.getsockname()[0])
    except Exception:  # noqa: BLE001
        pass
    finally:
        sock.close()

    # 2) كل العناوين المسجلة لاسم الجهاز (يكشف بقية بطاقات الشبكة)
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            found.add(info[4][0])
    except Exception:  # noqa: BLE001
        pass

    candidates = [ip for ip in found if ip and not ip.startswith("127.")]
    return sorted(candidates, key=lambda ip: (_rank_ip(ip), ip)) or ["127.0.0.1"]


def get_lan_ip():
    """العنوان الأرجح للوصول من النظارة (الأعلى أفضلية)."""
    return list_lan_ips()[0]


def ensure_certificate(lan_ip=None):
    """
    يعيد (مسار الشهادة، مسار المفتاح) وينشئهما إن لم يوجدا أو تغيّر عنوان
    الجهاز. يعيد (None, None) إذا لم تكن مكتبة cryptography مثبتة.
    """
    lan_ip = lan_ip or get_lan_ip()

    # إعادة الإنشاء إذا تغيّر عنوان الشبكة (تبدّل شبكة الواي فاي مثلاً)
    marker_path = os.path.join(CERT_DIR, "vr_cert.ip")
    fingerprint = ",".join(list_lan_ips())
    previous = ""
    if os.path.exists(marker_path):
        with open(marker_path, encoding="utf-8") as handle:
            previous = handle.read().strip()

    if os.path.exists(CERT_PATH) and os.path.exists(KEY_PATH) and previous == fingerprint:
        return CERT_PATH, KEY_PATH

    try:
        from cryptography import x509
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.x509.oid import NameOID
    except ImportError:
        return None, None

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name(
        [
            x509.NameAttribute(NameOID.COMMON_NAME, lan_ip),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Fututor VR"),
        ]
    )

    # أسماء بديلة: عنوان الشبكة + localhost — حتى تعمل الشهادة للجهازين.
    alt_names = [x509.DNSName("localhost"), x509.IPAddress(ipaddress.ip_address("127.0.0.1"))]
    # تُدرج كل عناوين الجهاز — فتصلح الشهادة أياً كان العنوان الذي ينجح
    # مع النظارة، دون الحاجة لإعادة إنشائها عند تبديل الشبكة أو البطاقة.
    for candidate in dict.fromkeys([lan_ip] + list_lan_ips()):
        try:
            alt_names.append(x509.IPAddress(ipaddress.ip_address(candidate)))
            alt_names.append(x509.DNSName(candidate))
        except ValueError:
            continue

    now = datetime.datetime.now(datetime.timezone.utc)
    certificate = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=825))
        .add_extension(x509.SubjectAlternativeName(alt_names), critical=False)
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .sign(key, hashes.SHA256())
    )

    with open(KEY_PATH, "wb") as handle:
        handle.write(
            key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption(),
            )
        )
    with open(CERT_PATH, "wb") as handle:
        handle.write(certificate.public_bytes(serialization.Encoding.PEM))
    with open(marker_path, "w", encoding="utf-8") as handle:
        handle.write(fingerprint)

    return CERT_PATH, KEY_PATH


if __name__ == "__main__":
    ip = get_lan_ip()
    cert, key = ensure_certificate(ip)
    if cert:
        print(f"تم إنشاء الشهادة بنجاح لعنوان: {ip}")
        print(f"  {cert}\n  {key}")
    else:
        print("لم تُنشأ الشهادة: مكتبة cryptography غير مثبتة.")
        print("ثبّتها بالأمر:  python -m pip install cryptography")
