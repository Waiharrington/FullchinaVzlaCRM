import re

with open('src/pages/Mesas.css', 'r', encoding='utf-8') as f:
    css = f.read()

css = re.sub(r'width:\s*90px;\s*height:\s*90px;', 'width: 76px;\n  height: 76px;', css)
css = re.sub(r'top:\s*-14px;\s*left:\s*-14px;\s*right:\s*-14px;\s*bottom:\s*-14px;', 'top: -9px; left: -9px; right: -9px; bottom: -9px;', css)
css = re.sub(r'font-size:\s*1.65rem;', 'font-size: 1.45rem;', css)

with open('src/pages/Mesas.css', 'w', encoding='utf-8') as f:
    f.write(css)

print('Updated successfully')
