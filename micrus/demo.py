from flask import Flask, jsonify, request, redirect, url_for, render_template_string
from werkzeug.security import generate_password_hash
import cbor2
import json
import os
import re
import hashlib
import time
from datetime import datetime
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, utils
from cryptography.x509 import load_pem_x509_certificate

app = Flask(__name__)

MODE = {"value": "verified"}
ATTESTATION_MODE = {"value": os.environ.get("ATTESTATION_MODE", "valid").strip().lower()}
DB_FILE = "password_store.json"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEMO_PKI_DIR = os.path.join(BASE_DIR, '..', 'fixtures', 'demo-pki')

ROOT_CERT_PATH = os.environ.get('DEMO_ROOT_CERT_PATH', os.path.join(DEMO_PKI_DIR, 'root-cert.pem'))
LEAF_CERT_PATH = os.environ.get('DEMO_LEAF_CERT_PATH', os.path.join(DEMO_PKI_DIR, 'leaf-cert.pem'))
LEAF_KEY_PATH = os.environ.get('DEMO_LEAF_KEY_PATH', os.path.join(DEMO_PKI_DIR, 'leaf-key.pem'))

REPO_URL = os.environ.get('REPO_URL', 'https://github.com/example/demo-service-repo')
OCI_IMAGE_DIGEST = os.environ.get('OCI_IMAGE_DIGEST',
    'sha256:1111111111111111111111111111111111111111111111111111111111111111')
WORKLOAD_ID = os.environ.get('WORKLOAD_ID', 'demo-workload-fixture')
MODULE_ID = os.environ.get('MODULE_ID', 'i-demo-instance-enc-demo')

if ATTESTATION_MODE["value"] not in ("valid", "tampered"):
    ATTESTATION_MODE["value"] = "valid"


def normalize_pcr_hex(value: str, fallback_byte: str) -> str:
    clean = re.sub(r'^0x', '', value, flags=re.IGNORECASE).lower()
    if re.fullmatch(r'[0-9a-f]{96}', clean):
        return clean
    return fallback_byte * 96


PCRS = {
    'pcr0': normalize_pcr_hex(os.environ.get('PCR0', ''), '0'),
    'pcr1': normalize_pcr_hex(os.environ.get('PCR1', ''), '0'),
    'pcr2': normalize_pcr_hex(os.environ.get('PCR2', ''), '0'),
    'pcr8': normalize_pcr_hex(os.environ.get('PCR8', ''), '0'),
}


def pem_to_der(pem_text: str) -> bytes:
    stripped = re.sub(r'-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+', '', pem_text)
    import base64
    return base64.b64decode(stripped)


root_cert_pem = open(ROOT_CERT_PATH, 'r').read()
leaf_cert_pem = open(LEAF_CERT_PATH, 'r').read()
leaf_key_pem = open(LEAF_KEY_PATH, 'r').read()
root_cert_der = pem_to_der(root_cert_pem)
leaf_cert_der = pem_to_der(leaf_cert_pem)
leaf_private_key = serialization.load_pem_private_key(leaf_key_pem.encode(), password=None)


def parse_nonce_to_bytes(nonce: str) -> bytes:
    clean = nonce.strip().lower()
    if re.fullmatch(r'[0-9a-f]+', clean) and len(clean) % 2 == 0:
        return bytes.fromhex(clean)
    return hashlib.sha256(clean.encode()).digest()


def build_attestation_doc(nonce: str) -> str:
    import base64
    nonce_bytes = parse_nonce_to_bytes(nonce)

    payload = cbor2.dumps({
        'module_id': MODULE_ID,
        'digest': 'SHA384',
        'timestamp': int(time.time() * 1000),
        'pcrs': {
            0: bytes.fromhex(PCRS['pcr0']),
            1: bytes.fromhex(PCRS['pcr1']),
            2: bytes.fromhex(PCRS['pcr2']),
            8: bytes.fromhex(PCRS['pcr8']),
        },
        'certificate': leaf_cert_der,
        'cabundle': [root_cert_der],
        'public_key': None,
        'user_data': None,
        'nonce': nonce_bytes,
    }, canonical=True)

    protected_header = cbor2.dumps({1: -35}, canonical=True)
    sig_structure = cbor2.dumps(
        ['Signature1', protected_header, b'', payload],
        canonical=True
    )

    signature = leaf_private_key.sign(
        sig_structure,
        ec.ECDSA(hashes.SHA384())
    )
    # Convert DER signature to IEEE P1363 (raw r||s) format
    r, s = utils.decode_dss_signature(signature)
    key_size = (leaf_private_key.key_size + 7) // 8
    raw_signature = r.to_bytes(key_size, 'big') + s.to_bytes(key_size, 'big')

    cose_doc = cbor2.dumps(
        [protected_header, {}, payload, raw_signature],
        canonical=True
    )

    if ATTESTATION_MODE['value'] == 'tampered':
        tampered = bytearray(cose_doc)
        tampered[-1] = tampered[-1] ^ 0xFF
        return base64.b64encode(bytes(tampered)).decode()

    return base64.b64encode(cose_doc).decode()


HTML = """
<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Trusted Compute Demo</title>
    <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 16px; }
    .card { border: 1px solid white; border-radius: 12px; padding: 16px; margin-top: 16px; }
    input { padding: 10px; width: 100%; border-radius: 10px; border: 1px solid #ccc; }
    button { padding: 10px 14px; border-radius: 10px; border: 0; cursor: pointer; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 6px; }
    .small { color: #666; font-size: 13px; }
    h1 { color: purple; }
    #hint { color: black; font-weight: 600; margin-top: 10px; }
    .mode {
        padding: 10px 16px;
        border-radius: 10px;
        font-weight: bold;
        cursor: pointer;
        background: #f2f2f2;
    }
    .mode.verified { border: 2px solid #4CAF50; color: #4CAF50; }
    .mode.unverified { border: 2px solid #f44336; color: #f44336; }
    .mode.verified.active { background: #4CAF50; color: white; }
    .mode.unverified.active { background: #f44336; color: white; }
    .row { display: flex; gap: 10px; align-items: center; }
    .input-neutral { border: 2px solid #ccc !important; }
    .input-bad { border: 2px solid #f44336 !important; }
    pre {
        background: #f8f8f8;
        padding: 12px;
        border-radius: 10px;
        overflow-x: auto;
    }
    </style>
</head>
<body>
    <div class="row">
        <h1>Attestation Demo Server</h1>
        <div class="card">
            <button onclick="setMode('verified')"
                class="mode verified {{ 'active' if mode == 'verified' else '' }}">
                verified
            </button>
            <button onclick="setMode('unverified')"
                class="mode unverified {{ 'active' if mode == 'unverified' else '' }}">
                unverified
            </button>
        </div>
    </div>

    <div class="small">Attestation endpoint: <code>POST /.well-known/attestation</code></div>
    <div class="small">Attestation mode: <code>{{ attestation_mode }}</code></div>

    <form id="form" method="POST" action="/submit">
        <input
            type="password"
            id="passwordField"
            name="secret"
            class="input-neutral"
            placeholder="Enter password"
        >
        <div class="row" style="margin-top: 10px;">
            <button type="submit" id="submitBtn">Submit</button>
            <a href="/records">View stored records</a>
        </div>
    </form>

    <div class="small" id="hint"></div>

<script>
function setMode(mode) {
    window.location.href = "/set-mode?mode=" + mode;
}

document.getElementById("form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const field = document.getElementById("passwordField");
    const hint = document.getElementById("hint");

    hint.textContent = "";
    field.classList.remove("input-bad");
    field.classList.add("input-neutral");

    const formData = new FormData(e.target);

    const res = await fetch("/submit", {
        method: "POST",
        body: formData
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        field.classList.remove("input-neutral");
        field.classList.add("input-bad");
        hint.textContent = data.error || "Submission failed";
        return;
    }

    field.value = "";
    hint.textContent = data.message || "Stored successfully";
});
</script>
</body>
</html>
"""


def load_records():
    if not os.path.exists(DB_FILE):
        return []
    with open(DB_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_records(records):
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2)


@app.get("/")
def index():
    return render_template_string(
        HTML,
        mode=MODE["value"],
        attestation_mode=ATTESTATION_MODE["value"],
    )


@app.get("/set-mode")
def set_mode():
    m = (request.args.get("mode") or "").lower()
    if m in ("verified", "unverified"):
        MODE["value"] = m
        ATTESTATION_MODE["value"] = "valid" if m == "verified" else "tampered"
    return redirect(url_for("index"))


@app.post("/.well-known/attestation")
def attestation():
    body = request.get_json(silent=True) or {}
    nonce = body.get('NONCE', '')
    doc_b64 = build_attestation_doc(nonce)

    return jsonify({
        'platform': 'aws_nitro_eif',
        'nonce': nonce,
        'workload': {
            'workload_id': WORKLOAD_ID,
            'repo_url': REPO_URL,
            'oci_image_digest': OCI_IMAGE_DIGEST,
            'eif_pcrs': PCRS,
        },
        'evidence': {
            'nitro_attestation_doc_b64': doc_b64,
        },
    })


@app.post("/submit")
def submit():
    if MODE["value"] != "verified":
        return jsonify({"ok": False, "error": "Server not verified. Rejected."}), 403

    secret = request.form.get("secret", "").strip()
    if not secret:
        return jsonify({"ok": False, "error": "Password is empty."}), 400

    password_hash = generate_password_hash(secret)

    records = load_records()
    records.append({
        "created_at": datetime.utcnow().isoformat() + "Z",
        "password_hash": password_hash,
        "password_length": len(secret)
    })
    save_records(records)

    return jsonify({
        "ok": True,
        "message": "Accepted and stored as hash only."
    })


@app.get("/records")
def records():
    data = load_records()
    return f"""
    <h2>Stored password records</h2>
    <p>Only hashes are stored. Plaintext passwords are never saved.</p>
    <pre>{json.dumps(data, indent=2)}</pre>
    <p><a href="/">Back</a></p>
    """


if __name__ == "__main__":
    port = int(os.environ.get('PORT', 9999))
    debug = os.environ.get('FLASK_DEBUG', '').strip().lower() in ('1', 'true', 'yes', 'on')
    app.run(host="0.0.0.0", port=port, debug=debug)
