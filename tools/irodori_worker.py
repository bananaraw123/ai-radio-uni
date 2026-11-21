"""Irodori-TTS で講義原稿をまとめて音声化する（Colab の uv 環境内で実行）。
使い方:
  python irodori_worker.py <jobs_dir>              … jobs_dir/*.json {"text","caption","out_mp3","seed","ref_wav"?} をMP3に
  python irodori_worker.py --audition <spec.json> <out_dir>  … 教授ごとに声の候補を5つ作る
声作りの方針は muse-irodori-voice（kgmkm）の知見に従う：
  MF版モデル／truncation_factor 0.85／70〜80字で分割し0.4秒の間／候補から選んだ「混合文」の声を参照に固定。"""
import json, re, subprocess, sys, time
from pathlib import Path

import torch
from irodori_tts.inference_runtime import (InferenceRuntime, RuntimeKey, SamplingRequest,
                                           download_hf_checkpoint, save_wav)

MODEL = "Aratako/Irodori-TTS-v4.1-Small-MF"
MAX_CHARS = 78          # 1回に読ませる最大文字数（約80字を超えると不具合が出やすい）
GAP_SENT, GAP_PARA = 0.40, 0.80   # 文と段落のあいだの無音（秒）


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


TRUNC = 0.85
# 悲しい内容と楽しい内容を両方含む短い文。これで選んだ声を参照にすると、感情が偏らない
AUDITION_TEXT = "今日は、少し切ない歴史のお話です。でも最後には、きっと楽しい発見が待っていますよ。それでは、始めましょう。"
AUDITION_SEEDS = [101, 2207, 4813, 7919, 9973]


def load_runtime():
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[準備] モデルを読み込みます（{dev}）…", flush=True)
    return InferenceRuntime.from_key(RuntimeKey(checkpoint=str(download_hf_checkpoint(MODEL)),
                                                model_device=dev, codec_device=dev))


def audition(spec_path: str, out_dir: str):
    spec = json.loads(Path(spec_path).read_text())
    rt = load_runtime()
    for name, caption in spec.items():
        d = Path(out_dir) / name; d.mkdir(parents=True, exist_ok=True)
        for i, seed in enumerate(AUDITION_SEEDS, start=1):
            res = rt.synthesize(SamplingRequest(text=AUDITION_TEXT, caption=caption, no_ref=True,
                                                seed=seed, truncation_factor=TRUNC))
            save_wav(d / f"候補{i}.wav", res.audio, res.sample_rate)
        print(f"[候補] {name}：5つ作りました", flush=True)


def main(jobs_dir: str):
    jobs = sorted(Path(jobs_dir).glob("*.json"))
    if not jobs:
        print("音声化する講義がありません"); return
    rt = load_runtime()
    for jp in jobs:
        job = json.loads(jp.read_text())
        parts = chunks(job["text"])
        work = jp.with_suffix(""); work.mkdir(exist_ok=True)
        print(f"\n[講義] {Path(job['out_mp3']).name}（{len(parts)}区切り）", flush=True)
        t0, pieces, sr = time.time(), [], None
        ref = job.get("ref_wav") or None   # 選んで固定した教授の声（なければ1区切り目の声を手本にする）
        for i, (txt, para_end) in enumerate(parts):
            req = SamplingRequest(text=txt, caption=job["caption"], seed=job.get("seed", 1234),
                                  no_ref=ref is None, ref_wav=ref, truncation_factor=TRUNC)
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
    if sys.argv[1] == "--audition":
        audition(sys.argv[2], sys.argv[3])
    else:
        main(sys.argv[1])
