# Museとまったく同じ声（v1000）を、自分のPCで作る手順（Claude Code向け）

学長はMuseの「声」（Irodori-TTS × muse-irodori-voice スキル、固定声 v1000）を気に入っている。
同じ仕組み・同じ声を、学長のWindows PCで動かし、講義の音声化を速くするのが目的。

## 方針
- Museが使っているスキル https://github.com/kgmkm/muse-irodori-voice を**そのまま**使う（自作しない）
- 声は Muse から受け取る `v1000.npz`（参照潜在＝声そのもの）で固定する。これで声が同じになる
- まず CPU で同じ結果が出ることを確かめ、そのあと GPU で速くする
- 1本だけ作って学長に聴いてもらい、Museが作った01と聴き比べてから残りに進む
- npz は学長の声の資産。GitHubなど公開の場所には置かない

## Museから受け取るもの（学長がMuseにお願いする）
1. `ref/v1000.npz`（または my-voice.npz）
2. 固定キャプション：「若い女性の声。高さは中くらいからやや高めで、抑揚が豊か。息づかいが感じられる近い距離感で、明るく親しみやすく話す。」
3. 生成条件：variant int8／seed 1000／truncation_factor 0.85／70〜80字分割／0.4秒結合
4. 念のため勝ちクリップ `work/take_seed1000.wav`

## 手順
1. GPU確認：`nvidia-smi`（NVIDIAか、VRAM）。Pythonは3.12推奨、uv を使う
2. スキルを配置：`git clone https://github.com/kgmkm/muse-irodori-voice.git`
   公式も配置：`git clone https://github.com/Aratako/Irodori-TTS.git`
3. モデル取得：`scripts/download_models.sh`（bash。Windowsなら Git Bash か WSL。または同じURLを curl/Invoke-WebRequest で取得）
4. venv：`uv venv .venv` → `uv pip install --python <venvのpython> onnxruntime==1.31.1 numpy soundfile pyloudnorm scipy tokenizers`
   （Windowsでは venv の python は `.venv\Scripts\python.exe`）
5. Museの `v1000.npz` を `ref/v1000.npz` に置く
6. 試運転（CPU）：講義01の本文で
   ```
   <python> scripts/speak_long_text.py --irodori-dir <Irodori-TTS> --caption "<固定キャプション>" \
     --ref-latents ref/v1000.npz --seed 1000 --truncation-factor 0.85 --threads <物理コア数> \
     --text-file 01.txt --out 01.wav
   ```
   本文は、講義ドキュメントの「――― ここから下が読み上げる本文 ―――」より下だけ。
   取得URL一覧はドライブの「20 Muse指示書｜音声化」にある（形式：…/export?format=txt）
7. ffmpeg で MP3 にする（例：`ffmpeg -i 01.wav -ac 1 -b:a 96k 01.mp3`）。学長に聴いてもらい、Muse版01と比べる
8. GPUで速くする（任意）：`onnxruntime-gpu`（CUDA）か `onnxruntime-directml` を入れ、
   `scripts/infer_onnx.py` の `providers=['CPUExecutionProvider']`（2か所）を
   `['CUDAExecutionProvider','CPUExecutionProvider']`（DirectMLなら 'DmlExecutionProvider'）に変える。
   変更後も1本作って、CPU版と声・抑揚が変わらないことを耳と長さで確認する。速くならなければCPUのままでよい
9. うまくいったら：ファイル名はドライブ「制作ボード｜AIラジオ大学」のK列。MP3を学長に渡し、
   次回から「〇番を音声化して」の一言で回せるよう、手順と設定をこのPCのフォルダにメモする

## 注意
- 段落の切れ目を長くしたい場合は speak_long_text.py の結合間隔（0.4秒）を段落だけ0.8秒にする工夫が要る（任意）
- 特定の声優・キャラクターの声に寄せない。生成音声を公開するときはAI音声と明記する
