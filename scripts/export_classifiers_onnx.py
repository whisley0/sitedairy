"""Export the baseline CDV ResNet18 classifiers (.pt) to ONNX for on-device
inference with onnxruntime-react-native.

Each checkpoint is a dict with:
  - model_state_dict : torchvision resnet18 whose fc was replaced with
                       Sequential(Dropout(p), Linear(512, num_classes))
  - encoder          : { head, mode, classes, class_to_index }
  - config.model     : { architecture, image_size, dropout, ... }

Outputs (assets/model/onnx/):
  - domain.onnx, subject.onnx, label_hint.onnx   (input [1,3,224,224] float32)
  - labels.json   (head -> { file, mode, classes (index-ordered), image_size })

Run from the repo root:  python scripts/export_classifiers_onnx.py
Requires: torch, torchvision (and onnx for serialization).
"""

import json
import os

import torch
import torch.nn as nn
from torchvision import models

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(REPO_ROOT, "assets", "model", "model")
OUT_DIR = os.path.join(REPO_ROOT, "assets", "model", "onnx")

CHECKPOINTS = {
    "domain": "baseline_domain_v1",
    "subject": "baseline_subject_v1",
    "label_hint": "baseline_label_hint_v1",
}

# ImageNet normalisation used by the pretrained resnet18 backbone.
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


def build_model(num_classes: int, dropout: float) -> nn.Module:
    model = models.resnet18(weights=None)
    in_features = model.fc.in_features  # 512
    model.fc = nn.Sequential(nn.Dropout(p=dropout), nn.Linear(in_features, num_classes))
    return model


def ordered_classes(encoder: dict) -> list[str]:
    class_to_index = encoder["class_to_index"]
    ordered: list[str] = [""] * len(class_to_index)
    for name, idx in class_to_index.items():
        ordered[idx] = name
    return ordered


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    manifest: dict[str, dict] = {}

    for head, run_name in CHECKPOINTS.items():
        ckpt_path = os.path.join(SRC_DIR, run_name, "checkpoint_best.pt")
        print(f"\n=== {head} ===\n  loading {ckpt_path}")
        checkpoint = torch.load(ckpt_path, map_location="cpu", weights_only=False)

        state_dict = checkpoint["model_state_dict"]
        encoder = checkpoint["encoder"]
        model_cfg = checkpoint["config"]["model"]

        classes = ordered_classes(encoder)
        dropout = float(model_cfg.get("dropout", 0.0))
        image_size = int(model_cfg.get("image_size", 224))

        model = build_model(len(classes), dropout)
        missing, unexpected = model.load_state_dict(state_dict, strict=True)
        if missing or unexpected:
            raise RuntimeError(f"state_dict mismatch: missing={missing} unexpected={unexpected}")
        model.eval()

        dummy = torch.randn(1, 3, image_size, image_size)
        onnx_path = os.path.join(OUT_DIR, f"{head}.onnx")
        torch.onnx.export(
            model,
            dummy,
            onnx_path,
            input_names=["input"],
            output_names=["logits"],
            dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}},
            opset_version=17,
            do_constant_folding=True,
        )

        size_mb = os.path.getsize(onnx_path) / (1024 * 1024)
        print(f"  exported {onnx_path} ({size_mb:.1f} MB) | mode={encoder['mode']} | classes={len(classes)}")

        manifest[head] = {
            "file": f"{head}.onnx",
            "mode": encoder["mode"],
            "classes": classes,
            "image_size": image_size,
            "mean": IMAGENET_MEAN,
            "std": IMAGENET_STD,
        }

    labels_path = os.path.join(OUT_DIR, "labels.json")
    with open(labels_path, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2, ensure_ascii=False)
    print(f"\nWrote {labels_path}")


if __name__ == "__main__":
    main()
