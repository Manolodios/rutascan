from pathlib import Path

p = Path('landing/index.html')
html = p.read_text(encoding='utf-8')
html = html.replace('      <div class="sheet-slot">\n        <article class="sheet ', '      <article class="sheet ')
html = html.replace('</article>\n      </div>', '</article>')
p.write_text(html, encoding='utf-8', newline='\n')
print('sheet-slot' in html)
