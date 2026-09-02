import sys
with open("src/pages/Inicio.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("import { BannerTuner } from '../components/BannerTuner'\n", "")
content = content.replace("      <BannerTuner />\n", "")

with open("src/pages/Inicio.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Removed BannerTuner from Inicio.tsx")
