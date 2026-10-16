"""PARUPINTAS screening model service.

Runs the distilled MobileNetV3-Small chest X-ray classifier
(``model/tb_student_ptq_int8.pt.zip``) behind one HTTP endpoint, which is what
the Express API calls when ``INFERENCE_SERVICE_URL`` is set.

    POST /predict   multipart, field ``image`` (JPEG or PNG)
    GET  /health

The reply has the shape ``backend/src/services/inferenceService.js`` validates:
``prediction``, ``probabilities`` for the three classes, and ``model``. The
service returns what the network computed and nothing else. It does not
produce a risk point, an outcome or a threshold: the API derives those from
the probabilities, in one place, for every model.

Assumptions that could not be checked against the training code, which is not
in this repository (see ``preprocess``): RGB input, resized to 224 x 224, with
ImageNet mean and standard deviation, and the class order below.

Run from the repository root:

    inference/.venv/Scripts/python.exe -m uvicorn serve:app --app-dir inference --host 127.0.0.1 --port 8000
"""

from __future__ import annotations

import hashlib
import io
import os
import secrets
import warnings
from pathlib import Path

import numpy as np
import torch
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError
from torchvision.models import mobilenet_v3_small

# The checkpoint stores quantized tensors, and recent PyTorch warns that the
# quantized tensor API is on its way out. The weights are read once, below.
warnings.filterwarnings("ignore", category=UserWarning)

ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = Path(os.environ.get("MODEL_PATH", ROOT / "model" / "tb_student_ptq_int8.pt.zip"))
API_KEY = os.environ.get("INFERENCE_API_KEY") or None
MAX_BYTES = int(float(os.environ.get("MAX_UPLOAD_MB", "15")) * 1024 * 1024)

# Alphabetical, which is both the usual folder-per-class order and the order the
# API contract uses. The checkpoint's last layer has exactly three outputs.
LABELS = ["Healthy", "Sick-non-TB", "TB"]
IMAGE_SIZE = 224
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

DISCLAIMER = (
    "Hasil ini adalah alat bantu SKRINING berbasis AI, bukan diagnosis medis. "
    "Konsultasikan dengan tenaga kesehatan untuk evaluasi lebih lanjut. / "
    "This AI SCREENING aid is not a medical diagnosis; consult a clinician."
)

torch.set_num_threads(max(1, min(4, os.cpu_count() or 1)))


def _file_digest(path: Path) -> str:
    sha = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            sha.update(chunk)
    return sha.hexdigest()[:12]


def load_model(path: Path) -> torch.nn.Module:
    """Rebuild MobileNetV3-Small and fill it from the checkpoint.

    The backbone is stored as ordinary float tensors. The two classifier
    layers are stored int8-quantized with their scales, but the quantized
    kernels are not needed to use them: the int8 weights are dequantized once
    and the head runs in float32. That keeps the service independent of which
    quantization engine a given PyTorch build ships with.
    """
    # The checkpoint contains quantized tensors, which the safe loader refuses.
    # It is a local file shipped with the project, not user input.
    state = torch.load(path, map_location="cpu", weights_only=False)

    net = mobilenet_v3_small(weights=None, num_classes=len(LABELS))
    backbone = {k.removeprefix("features."): v for k, v in state.items() if k.startswith("features.")}
    net.features.load_state_dict(backbone, strict=True)

    for index in (0, 3):
        weight, bias = state[f"classifier.{index}._packed_params._packed_params"]
        layer = net.classifier[index]
        weight = weight.dequantize()
        if tuple(weight.shape) != tuple(layer.weight.shape):
            raise RuntimeError(
                f"classifier.{index}: checkpoint is {tuple(weight.shape)}, "
                f"architecture expects {tuple(layer.weight.shape)}"
            )
        with torch.no_grad():
            layer.weight.copy_(weight)
            layer.bias.copy_(bias)

    return net.eval()


def preprocess(raw: bytes) -> torch.Tensor:
    """Bytes of a JPEG or PNG to a normalised 1 x 3 x 224 x 224 tensor."""
    image = Image.open(io.BytesIO(raw))
    if image.format not in ("JPEG", "PNG"):
        raise ValueError("Only JPEG and PNG images are accepted.")
    image = image.convert("RGB").resize((IMAGE_SIZE, IMAGE_SIZE), Image.BILINEAR)
    array = (np.asarray(image, dtype=np.float32) / 255.0 - MEAN) / STD
    return torch.from_numpy(array.transpose(2, 0, 1).copy()).unsqueeze(0)


MODEL = load_model(MODEL_PATH)
MODEL_VERSION = f"ptq-int8-{_file_digest(MODEL_PATH)}"

app = FastAPI(title="PARUPINTAS screening model", docs_url=None, redoc_url=None, openapi_url=None)


def require_key(authorization: str | None = Header(default=None)) -> None:
    """Bearer check, only when INFERENCE_API_KEY is set (it should be, off loopback)."""
    if API_KEY is None:
        return
    supplied = (authorization or "").removeprefix("Bearer ").strip()
    if not secrets.compare_digest(supplied, API_KEY):
        raise HTTPException(status_code=401, detail="Invalid or missing API key.")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": MODEL_PATH.name, "version": MODEL_VERSION, "labels": LABELS}


@app.post("/predict", dependencies=[Depends(require_key)])
def predict(image: UploadFile = File(...)) -> dict:
    raw = image.file.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="The image is too large.")

    try:
        batch = preprocess(raw)
    except (UnidentifiedImageError, ValueError, OSError, Image.DecompressionBombError) as error:
        raise HTTPException(status_code=400, detail=f"The image could not be read: {error}") from error

    with torch.inference_mode():
        probabilities = torch.softmax(MODEL(batch), dim=1)[0].tolist()

    by_label = dict(zip(LABELS, probabilities))
    return {
        "image": image.filename or "image",
        "prediction": max(by_label, key=by_label.get),
        "probabilities": by_label,
        "model": {
            "classifier": MODEL_PATH.name,
            "backbone": "mobilenet_v3_small",
            "version": MODEL_VERSION,
        },
        "disclaimer": DISCLAIMER,
    }
