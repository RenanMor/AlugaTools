#!/usr/bin/env python3
"""Load-test helpers.

  report.py reduce <k6-raw.json> <out.csv>   keep only request durations and VU counts
  report.py report <dir-with-csvs> <out.md>  merge all shards into a markdown report
"""
import csv
import glob
import json
import math
import os
import re
import sys
from collections import defaultdict
from datetime import datetime

BUCKET_S = 30


TIME_RE = re.compile(r"^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d+))?(Z|[+-]\d\d:\d\d)$")


def parse_time(value):
    """k6 writes RFC 3339 with nanoseconds, which datetime.fromisoformat may reject."""
    base, frac, tz = TIME_RE.match(value).groups()
    tz = "+00:00" if tz == "Z" else tz
    return datetime.fromisoformat(base + tz).timestamp() + float("0." + (frac or "0"))


def reduce(raw_path, out_path):
    with open(raw_path) as raw, open(out_path, "w", newline="") as out:
        w = csv.writer(out)
        w.writerow(["metric", "ts", "name", "kind", "status", "value"])
        for line in raw:
            try:
                p = json.loads(line)
            except ValueError:
                continue
            if p.get("type") != "Point" or p["metric"] not in ("http_req_duration", "vus", "body_bytes"):
                continue
            d = p["data"]
            tags = d.get("tags") or {}
            ts = parse_time(d["time"])
            w.writerow([p["metric"], f"{ts:.3f}", tags.get("name", ""), tags.get("kind", ""), tags.get("status", ""), d["value"]])


def pct(values, q):
    if not values:
        return float("nan")
    s = sorted(values)
    k = max(0, min(len(s) - 1, math.ceil(q / 100 * len(s)) - 1))
    return s[k]


def fmt_ms(v):
    if v != v:  # NaN
        return "–"
    return f"{v / 1000:.2f} s" if v >= 1000 else f"{v:.0f} ms"


def fmt_bytes(v):
    if v != v:
        return "–"
    for unit in ("B", "KB", "MB"):
        if v < 1024 or unit == "MB":
            return f"{v:.0f} {unit}" if unit == "B" else f"{v:.1f} {unit}"
        v /= 1024


def report(directory, out_path):
    reqs = []  # (ts, name, kind, status, ms)
    vus = defaultdict(lambda: defaultdict(float))  # shard -> bucket -> max vus
    sizes = defaultdict(list)
    t0 = None
    for path in sorted(glob.glob(os.path.join(directory, "**", "*.csv"), recursive=True)):
        shard = os.path.basename(os.path.dirname(path)) or path
        with open(path) as f:
            for row in csv.DictReader(f):
                ts = float(row["ts"])
                t0 = ts if t0 is None else min(t0, ts)
                v = float(row["value"])
                if row["metric"] == "http_req_duration":
                    reqs.append((ts, row["name"], row["kind"], row["status"], v))
                elif row["metric"] == "vus":
                    b = int(ts // BUCKET_S)
                    vus[shard][b] = max(vus[shard][b], v)
                else:
                    sizes[row["name"]].append(v)

    lines = ["# Teste de carga — AlugaTools", ""]
    if not reqs:
        lines.append("Nenhuma requisição registrada.")
        open(out_path, "w").write("\n".join(lines) + "\n")
        return

    ok = lambda s: s.isdigit() and 200 <= int(s) < 400
    by_name = defaultdict(list)
    for r in reqs:
        by_name[r[1]].append(r)

    lines += [
        "## Por funcionalidade",
        "",
        "Tempos só das respostas com sucesso. **429** = bloqueado pelo limite de requisições por IP; "
        "**erro** = falha do servidor (5xx), timeout (30 s) ou conexão recusada.",
        "",
        "| Chamada | Requisições | OK | 429 | Erro | p50 | p95 | p99 | Máx | Tamanho (mediana) |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    order = sorted(by_name, key=lambda n: (not n.endswith("(site)"), n))
    for name in order:
        rows = by_name[name]
        good = [r[4] for r in rows if ok(r[3])]
        n429 = sum(1 for r in rows if r[3] == "429")
        nerr = len(rows) - len(good) - n429
        lines.append(
            f"| `{name}` | {len(rows)} | {len(good)} | {n429} | {nerr} | {fmt_ms(pct(good, 50))} | "
            f"{fmt_ms(pct(good, 95))} | {fmt_ms(pct(good, 99))} | {fmt_ms(max(good) if good else float('nan'))} | "
            f"{fmt_bytes(pct(sizes.get(name, []), 50))} |"
        )

    statuses = defaultdict(int)
    for r in reqs:
        if not ok(r[3]) and r[3] != "429":
            statuses[r[3] if r[3] not in ("", "0") else "sem resposta (timeout/conexão)"] += 1
    if statuses:
        lines += ["", "Erros por status: " + ", ".join(f"`{k}` × {v}" for k, v in sorted(statuses.items()))]

    lines += [
        "",
        f"## Ao longo do teste (janelas de {BUCKET_S} s)",
        "",
        "| Tempo | Usuários ativos | Req/s (API) | API p50 | API p95 | 429 | Erros | Site p95 |",
        "|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    buckets = defaultdict(list)
    for r in reqs:
        buckets[int(r[0] // BUCKET_S)].append(r)
    # Degraded = >1% errors or API p95 > 1 s. Two windows in a row, so a single spike doesn't count.
    healthy, broken, peak_rps, pending = None, None, 0.0, None
    for b in sorted(buckets):
        api = [r for r in buckets[b] if r[2] == "api"]
        if not api:
            continue
        api_ok = [r[4] for r in api if ok(r[3])]
        errors = sum(1 for r in api if not ok(r[3]) and r[3] != "429")
        users = sum(v.get(b, 0) for v in vus.values())
        degraded = errors / len(api) > 0.01 or pct(api_ok, 95) > 1000
        if broken is not None:
            continue
        if degraded and users > 0:
            if pending is not None:
                broken = pending
            else:
                pending = (users, errors / len(api), pct(api_ok, 95))
        else:
            pending = None
            healthy = users
            peak_rps = max(peak_rps, len(api) / BUCKET_S)
    summary = ["", "## Limite", ""]
    if broken:
        summary.append(
            f"- Funcionou bem (95% das respostas da API em até 1 s e menos de 1% de erros) até **~{healthy or 0:.0f} usuários** simultâneos, "
            f"atendendo até **{peak_rps:.0f} req/s**."
        )
        summary.append(
            f"- Começou a degradar com **~{broken[0]:.0f} usuários**: {broken[1] * 100:.0f}% de erros, API p95 {fmt_ms(broken[2])}."
        )
    else:
        summary.append(f"- Não degradou: aguentou o máximo testado (~{healthy or 0:.0f} usuários, até {peak_rps:.0f} req/s).")
    lines[lines.index("## Por funcionalidade"):lines.index("## Por funcionalidade")] = summary[1:] + [""]
    for b in sorted(buckets):
        rows = buckets[b]
        api = [r for r in rows if r[2] == "api"]
        api_ok = [r[4] for r in api if ok(r[3])]
        site_ok = [r[4] for r in rows if r[2] == "site" and ok(r[3])]
        users = sum(v.get(b, 0) for v in vus.values())
        elapsed = (b - int(t0 // BUCKET_S)) * BUCKET_S
        lines.append(
            f"| {elapsed // 60}:{elapsed % 60:02d} | {users:.0f} | {len(api) / BUCKET_S:.1f} | {fmt_ms(pct(api_ok, 50))} | "
            f"{fmt_ms(pct(api_ok, 95))} | {sum(1 for r in api if r[3] == '429')} | "
            f"{sum(1 for r in api if not ok(r[3]) and r[3] != '429')} | {fmt_ms(pct(site_ok, 95))} |"
        )

    open(out_path, "w").write("\n".join(lines) + "\n")


if __name__ == "__main__":
    cmd, *args = sys.argv[1:]
    {"reduce": reduce, "report": report}[cmd](*args)
