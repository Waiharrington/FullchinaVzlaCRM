import sys

with open("src/pages/Inicio.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = "import { BannerTuner } from '../components/BannerTuner'\n" + content
content = content.replace("kpi-bg.webp", "kpi-bg-new.png")

last_div_index = content.rfind("    </div>")
if last_div_index != -1:
    content = content[:last_div_index] + "      <BannerTuner />\n    </div>" + content[last_div_index + 10:]

with open("src/pages/Inicio.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Injected BannerTuner and fixed image.")
