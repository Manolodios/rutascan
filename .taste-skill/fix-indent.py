from pathlib import Path

p = Path('landing/index.html')
html = p.read_text(encoding='utf-8')
html = html.replace('\n<article class="sheet ', '\n        <article class="sheet ')
html = html.replace('</article>\n</div>', '</article>\n      </div>')
p.write_text(html, encoding='utf-8', newline='\n')

check = p.read_text(encoding='utf-8')
print('señal' in check, 'teléfono' in check, 'Ã' in check)
print(check[check.index('<div class="sheets">'):check.index('<div class="sheets">') + 420])
