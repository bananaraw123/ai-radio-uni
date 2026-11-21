"""Irodori-TTS で講義原稿をまとめて音声化する（Colab の uv 環境内で実行）。
使い方: python irodori_worker.py <jobs_dir>
jobs_dir/*.json に {"text", "caption", "out_mp3", "seed"} を置くと、同じ名前の MP3 を作る。"""
import json, re, subprocess, sys, time
from pathlib import Path

import torch
from irodori_tts.inference_runtime import (InferenceRuntime, RuntimeKey, SamplingRequest,
                                           download_hf_checkpoint, save_wav)

MODEL = "Aratako/Irodori-TTS-v4.1-Small"
MAX_CHARS = 90          # 1回に読ませる最大文字数（モデルの文字数上限より十分短く）
GAP_SENT, GAP_PARA = 0.30, 0.70   # 文と段落のあいだの無音（秒）


def chunks(text: str):
    """段落→文に分け、MAX_CHARS 以内にまとめる。(文字列, 段落の終わりか) を返す。"""
    out = []
    for para in [p.strip() for p in text.split("\n") if p.strip()]:
        sents = [s for s in re.split(r"(?<=[。！？!?])", para) if s.strip()]
        buf = ""
        for s in sents:
            while len(s) > MAX_CHARS:            # 句点のない長文は読点で切る
                cut = s.rfind("、", 0, MAX_CHARS)
                cut = cut + 1 if cut > 10 else MAX_CHARS
                if buf: out.append((buf, False)); buf = ""
                out.append((s[:cut], False)); s = s[cut:]
            if buf and len(buf) + len(s) > MAX_CHARS:
                out.append((buf, False)); buf = ""
            buf += s
        if buf: out.append((buf, True))
        elif out: out[-1] = (out[-1][0], True)
    return out


def main(jobs_dir: str):
    jobs = sorted(Path(jobs_dir).glob("*.json"))
    if not jobs:
        print("音声化する講義がありません"); return
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[準備] モデルを読み込みます（{dev}）…", flush=True)
    rt = InferenceRuntime.from_key(RuntimeKey(checkpoint=str(download_hf_checkpoint(MODEL)),
                                              model_device=dev, codec_device=dev))
    for jp in jobs:
        job = json.loads(jp.read_text())
        parts = chunks(job["text"])
        work = jp.with_suffix(""); work.mkdir(exist_ok=True)
        print(f"\n[講義] {Path(job['out_mp3']).name}（{len(parts)}区切り）", flush=True)
        t0, pieces, ref, sr = time.time(), [], None, None
        for i, (txt, para_end) in enumerate(parts):
            req = SamplingRequest(text=txt, caption=job["caption"], seed=job.get("seed", 1234),
                                  no_ref=ref is None, ref_wav=ref)
            res = rt.synthesize(req)
            wav = work / f"{i:03d}.wav"; save_wav(wav, res.audio, res.sample_rate); sr = res.sample_rate
            if ref is None: ref = str(wav)          # 1区切り目の声を、以降の声の手本にする
            pieces.append((wav, GAP_PARA if para_end else GAP_SENT))
            print(f"  {i + 1}/{len(parts)} {txt[:24]}…", flush=True)
        # 無音をはさんで1本につなぎ、MP3にする
        lst = work / "list.txt"
        sil = {g: work / f"sil_{int(g * 100)}.wav" for g in {GAP_SENT, GAP_PARA}}
        for g, p in sil.items():
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i",
                            f"anullsrc=r={sr}:cl=mono", "-t", str(g), str(p)], check=True)
        lst.write_text("".join(f"file '{w}'\nfile '{sil[g]}'\n" for w, g in pieces))
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst),
                        "-ac", "1", "-ar", "44100", "-b:a", "96k", job["out_mp3"]], check=True)
        print(f"[完成] {job['out_mp3']}（{(time.time() - t0) / 60:.1f}分）", flush=True)


if __name__ == "__main__":
    main(sys.argv[1])
