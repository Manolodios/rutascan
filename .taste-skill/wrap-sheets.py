import re
from pathlib import Path

p = Path('landing/index.html')
html = p.read_text(encoding='utf-8')

start = html.index('<div class="sheets">')
end = html.index('</div>\n  </section>', start)
block = html[start:end]
wrapped = re.sub(r'(<article class="sheet [^"]+">.*?</article>)', r'<div class="sheet-slot">\n\1\n</div>', block, flags=re.S)
html = html[:start] + wrapped + html[end:]
p.write_text(html, encoding='utf-8', newline='\n')
print(html.count('sheet-slot'))
