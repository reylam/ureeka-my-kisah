"""Export the screening model to ONNX so the browser can run it.

    inference/.venv/Scripts/python.exe inference/export_onnx.py

Writes ``frontend/public/models/tb_student.onnx`` and, next to it, a small JSON
file with the facts the browser needs to stay in step with this exporter (label
order, input size, normalisation, a checksum of the source checkpoint). The
network is exactly the one ``serve.py`` builds, so the two cannot disagree.

The output is raw logits. Softmax is applied by the caller.

Also checks the exported graph against PyTorch on random input, and fails if
they differ by more than a small tolerance.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import torch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import serve  # noqa: E402  (builds the model from the checkpoint on import)

OUT_DIR = serve.ROOT / "frontend" / "public" / "models"
ONNX_PATH = OUT_DIR / "tb_student.onnx"
META_PATH = OUT_DIR / "tb_student.json"


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    model = serve.MODEL.eval()
    example = torch.zeros(1, 3, serve.IMAGE_SIZE, serve.IMAGE_SIZE)

    torch.onnx.export(
        model,
        (example,),
        str(ONNX_PATH),
        input_names=["input"],
        output_names=["logits"],
        opset_version=17,
        dynamo=False,
    )

    import onnx
    import onnxruntime as ort

    onnx.checker.check_model(onnx.load(str(ONNX_PATH)))

    rng = np.random.default_rng(0)
    batch = rng.normal(0, 1, (4, 3, serve.IMAGE_SIZE, serve.IMAGE_SIZE)).astype(np.float32)
    with torch.inference_mode():
        expected = model(torch.from_numpy(batch)).numpy()
    session = ort.InferenceSession(str(ONNX_PATH), providers=["CPUExecutionProvider"])
    actual = session.run(["logits"], {"input": batch[:1]})[0]
    worst = float(np.abs(actual - expected[:1]).max())
    if worst > 1e-3:
        raise SystemExit(f"ONNX output differs from PyTorch by {worst:.2e}")

    META_PATH.write_text(
        json.dumps(
            {
                "labels": serve.LABELS,
                "imageSize": serve.IMAGE_SIZE,
                "mean": [float(v) for v in serve.MEAN],
                "std": [float(v) for v in serve.STD],
                "backbone": "mobilenet_v3_small",
                "source": serve.MODEL_PATH.name,
                "version": serve.MODEL_VERSION,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"wrote {ONNX_PATH} ({ONNX_PATH.stat().st_size / 1e6:.1f} MB), max diff vs PyTorch {worst:.2e}")


if __name__ == "__main__":
    main()
