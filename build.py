"""artifact.html（全部入り1ファイル版）を作る。自前ホスティングには index.html 一式をそのまま使う。"""
import re, pathlib
d = pathlib.Path(__file__).parent
html = (d/'index.html').read_text()
body = re.search(r'<!--APP-->(.*)<!--/APP-->', html, re.S).group(1)
out = ('<title>AIラジオ大学</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'
       f'<style>\n{(d/"style.css").read_text()}\n</style>\n{body}\n'
       f'<script>\n{(d/"data.js").read_text()}\n</script>\n<script>\n{(d/"app.js").read_text()}\n</script>\n')
(d/'dist').mkdir(exist_ok=True)
(d/'dist/artifact.html').write_text(out)
print(len(out))
