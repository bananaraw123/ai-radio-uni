# 自分のPCのGPUで講義を音声化する手順（Claude Code向け）

AIラジオ大学の講義原稿を、Irodori-TTS（無料・オープンソース）でMP3にする。
学長のWindows PCで、Claudeデスクトップアプリ（Claude Code）が実行する前提。

## ゴール
Googleドライブ「AIラジオ大学 制作室」の制作ボード（スプレッドシート「制作ボード｜AIラジオ大学」）で
状態が「音声化待ち」の講義を、教授ごとの固定声でMP3にし、同フォルダ内の「音声」フォルダに保存する。
保存後、ボードの状態を「登録待ち」、「Muse音声」列を「Irodori（PC）で生成」にし、
ドキュメント「00 AI会議室｜はじめに読む」の会議ログに一行追記する。

## 進め方の約束
- まず1本だけ作って、学長に聴いてもらってから残りを作る
- 動かして確かめてから報告する。エラーは原因を調べて直す
- うまくいったら、次回から「音声化して」の一言で同じ流れを回せるよう、手順をこのフォルダにメモする

## 手順
1. GPU確認：`nvidia-smi`。NVIDIA以外なら学長に報告して相談（CPUでも動くが遅い）
2. 準備（作業フォルダ内で）：
   - `pip install uv`（または公式インストーラ）、ffmpeg（`winget install ffmpeg` など）
   - `git clone https://github.com/Aratako/Irodori-TTS.git` → `cd Irodori-TTS` → `uv sync --extra cu128`
   - このリポジトリの `tools/irodori_worker.py` を Irodori-TTS フォルダにコピー
3. 原稿の取得：Googleドライブの各講義ドキュメント（制作ボードのE列「原稿を開く」のリンク先）から、
   「――― ここから下が読み上げる本文 ―――」より下の本文だけを取り出す
4. 教授の声（初回のみ）：
   - `uv run --no-sync python irodori_worker.py --audition spec.json audition/`
     spec.json は {学部名: 声の説明} 。声の説明は tools/irodori_voice.ipynb の「声」辞書と同じ
   - 各学部5候補（候補1〜5.wav）を学長に聴いてもらい、番号を選んでもらう
   - 選んだwavを `refs/学部名.wav` として保存（ドライブの「声の見本」フォルダにも保存）
5. 音声化：jobs/ に講義ごとのJSON
   `{"text": 本文, "caption": 声の説明, "ref_wav": "refs/学部名.wav", "out_mp3": "out/ファイル名.mp3", "seed": 1000}`
   を置き、`uv run --no-sync python irodori_worker.py jobs/`
   ファイル名は制作ボードのK列「MP3ファイル名」
6. 保存と記録：MP3をドライブ「音声」フォルダへ、ボードと会議ログを更新

## 声づくりの知見（muse-irodori-voice より）
- モデル：Aratako/Irodori-TTS-v4.1-Small-MF、truncation_factor 0.85
- 70〜80字ごとに文の区切りで分割し、0.4秒の間でつなぐ（worker が実装済み）
- 声はキャプションだけでは毎回変わる。候補から選び、参照音声で固定する
- 選定用の文は、悲しい内容と楽しい内容が混ざった約60字の文（worker の AUDITION_TEXT）
- 特定の声優・キャラクターの声に寄せない
