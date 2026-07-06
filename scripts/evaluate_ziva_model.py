import argparse
import csv
import json
import re
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path
from urllib import request
from urllib.error import HTTPError, URLError


DIAGNOSIS_RE = re.compile(r"probable diagnosis\s*:\s*(.+)", re.IGNORECASE)
SEVERITY_RE = re.compile(r"severity level\s*:\s*(.+)", re.IGNORECASE)


def clean_label(value):
    if not value:
        return ""
    return re.split(r"[\n\r|]", str(value).strip())[0].strip(" .:-").lower()


def parse_text_result(text):
    diagnosis = ""
    severity = ""
    diagnosis_match = DIAGNOSIS_RE.search(text or "")
    severity_match = SEVERITY_RE.search(text or "")

    if diagnosis_match:
      diagnosis = clean_label(diagnosis_match.group(1))
    if severity_match:
      severity = clean_label(severity_match.group(1))

    return {
        "diagnosis": diagnosis,
        "severity": severity,
        "raw": text or "",
    }


def parse_model_result(data):
    if isinstance(data, dict):
        text_fields = [
            data.get("response"),
            data.get("output"),
            data.get("text"),
            data.get("generated_text"),
            data.get("answer"),
        ]
        text = next((item for item in text_fields if isinstance(item, str) and item.strip()), "")
        parsed = parse_text_result(text)
        return {
            "diagnosis": clean_label(data.get("diagnosis") or data.get("illness") or parsed["diagnosis"]),
            "severity": clean_label(data.get("severity") or parsed["severity"]),
            "raw": text or json.dumps(data, ensure_ascii=False),
        }

    if isinstance(data, str):
        return parse_text_result(data)

    return {"diagnosis": "", "severity": "", "raw": str(data)}


def read_jsonl(path, limit=None):
    rows = []
    with Path(path).open("r", encoding="utf-8") as file:
        for line_number, line in enumerate(file, start=1):
            if limit and len(rows) >= limit:
                break
            if not line.strip():
                continue
            item = json.loads(line)
            gold = parse_text_result(item.get("response", ""))
            rows.append({
                "line": line_number,
                "instruction": item.get("instruction", ""),
                "gold_diagnosis": gold["diagnosis"],
                "gold_severity": gold["severity"],
                "gold_raw": item.get("response", ""),
            })
    return rows


def post_json(url, payload, timeout):
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def predict_with_api(row, url, timeout):
    try:
        data = post_json(url, {"symptoms": row["instruction"]}, timeout)
        return parse_model_result(data)
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
        return {"diagnosis": "", "severity": "", "raw": f"API error: {error}"}


def load_local_model(model_path):
    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
    except ImportError as error:
        raise SystemExit(
            "Local model evaluation needs transformers and torch. Install them on the stronger laptop first."
        ) from error

    tokenizer = AutoTokenizer.from_pretrained(model_path)
    model = AutoModelForCausalLM.from_pretrained(
        model_path,
        device_map="auto",
        torch_dtype=torch.bfloat16 if torch.cuda.is_available() else torch.float32,
    )
    return tokenizer, model


def predict_with_local_model(row, tokenizer, model, max_new_tokens):
    prompt = row["instruction"]
    messages = [{"role": "user", "content": prompt}]

    if hasattr(tokenizer, "apply_chat_template") and tokenizer.chat_template:
        inputs = tokenizer.apply_chat_template(messages, add_generation_prompt=True, return_tensors="pt")
    else:
        inputs = tokenizer(prompt, return_tensors="pt").input_ids

    inputs = inputs.to(model.device)
    output = model.generate(inputs, max_new_tokens=max_new_tokens, do_sample=False)
    generated = output[0][inputs.shape[-1]:]
    text = tokenizer.decode(generated, skip_special_tokens=True)
    return parse_model_result(text)


def classification_metrics(rows, key):
    y_true = [row[f"gold_{key}"] for row in rows]
    y_pred = [row[f"pred_{key}"] for row in rows]
    labels = sorted(set(y_true) | set(y_pred))
    total = len(rows)
    accuracy = sum(1 for true, pred in zip(y_true, y_pred) if true == pred) / total if total else 0
    per_label = {}

    for label in labels:
        tp = sum(1 for true, pred in zip(y_true, y_pred) if true == label and pred == label)
        fp = sum(1 for true, pred in zip(y_true, y_pred) if true != label and pred == label)
        fn = sum(1 for true, pred in zip(y_true, y_pred) if true == label and pred != label)
        precision = tp / (tp + fp) if tp + fp else 0
        recall = tp / (tp + fn) if tp + fn else 0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0
        per_label[label] = {"precision": precision, "recall": recall, "f1": f1, "support": y_true.count(label)}

    macro_precision = sum(item["precision"] for item in per_label.values()) / len(per_label) if per_label else 0
    macro_recall = sum(item["recall"] for item in per_label.values()) / len(per_label) if per_label else 0
    macro_f1 = sum(item["f1"] for item in per_label.values()) / len(per_label) if per_label else 0
    confusion = defaultdict(Counter)
    for true, pred in zip(y_true, y_pred):
        confusion[true][pred] += 1

    return {
        "accuracy": accuracy,
        "macro_precision": macro_precision,
        "macro_recall": macro_recall,
        "macro_f1": macro_f1,
        "per_label": per_label,
        "confusion": {label: dict(confusion[label]) for label in labels},
    }


def emergency_recall(rows):
    severe_rows = [row for row in rows if row["gold_severity"] in {"severe", "high", "critical"}]
    if not severe_rows:
        return None

    emergency_words = ("emergency", "immediate", "immediately", "urgent", "vet visit", "veterinary")
    hits = sum(1 for row in severe_rows if any(word in row["pred_raw"].lower() for word in emergency_words))
    return hits / len(severe_rows)


def write_predictions(path, rows):
    fieldnames = [
        "line",
        "instruction",
        "gold_diagnosis",
        "pred_diagnosis",
        "gold_severity",
        "pred_severity",
        "pred_raw",
    ]
    with Path(path).open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in fieldnames})


def print_metrics(name, metrics):
    print(f"\n{name}")
    print("-" * len(name))
    print(f"Accuracy:        {metrics['accuracy']:.3f}")
    print(f"Macro precision: {metrics['macro_precision']:.3f}")
    print(f"Macro recall:    {metrics['macro_recall']:.3f}")
    print(f"Macro F1:        {metrics['macro_f1']:.3f}")
    print("\nPer label:")
    for label, values in metrics["per_label"].items():
        print(
            f"  {label or '<empty>'}: precision={values['precision']:.3f}, "
            f"recall={values['recall']:.3f}, f1={values['f1']:.3f}, support={values['support']}"
        )


def main():
    parser = argparse.ArgumentParser(description="Evaluate the Ziva veterinary model.")
    parser.add_argument("--data", required=True, help="Path to the JSONL evaluation dataset.")
    parser.add_argument("--api-url", help="Prediction API URL, for example http://localhost:8000/predict.")
    parser.add_argument("--model-path", help="Local extracted Hugging Face model folder.")
    parser.add_argument("--limit", type=int, help="Evaluate only the first N rows.")
    parser.add_argument("--timeout", type=int, default=60, help="API timeout in seconds.")
    parser.add_argument("--max-new-tokens", type=int, default=220, help="Generation length for local model mode.")
    parser.add_argument("--predictions-csv", default="ziva_eval_predictions.csv")
    args = parser.parse_args()

    if bool(args.api_url) == bool(args.model_path):
        raise SystemExit("Choose exactly one mode: --api-url or --model-path.")

    rows = read_jsonl(args.data, args.limit)
    if not rows:
        raise SystemExit("No evaluation rows found.")

    tokenizer = model = None
    if args.model_path:
        tokenizer, model = load_local_model(args.model_path)

    started = time.time()
    for index, row in enumerate(rows, start=1):
        print(f"Evaluating {index}/{len(rows)}", end="\r")
        if args.api_url:
            pred = predict_with_api(row, args.api_url, args.timeout)
        else:
            pred = predict_with_local_model(row, tokenizer, model, args.max_new_tokens)

        row["pred_diagnosis"] = pred["diagnosis"]
        row["pred_severity"] = pred["severity"]
        row["pred_raw"] = pred["raw"]

    print(f"\nCompleted {len(rows)} examples in {time.time() - started:.1f}s")
    print_metrics("Diagnosis Metrics", classification_metrics(rows, "diagnosis"))
    print_metrics("Severity Metrics", classification_metrics(rows, "severity"))

    severe_recall = emergency_recall(rows)
    if severe_recall is not None:
        print(f"\nEmergency recommendation recall: {severe_recall:.3f}")

    write_predictions(args.predictions_csv, rows)
    print(f"\nSaved predictions to {args.predictions_csv}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("\nStopped.")
