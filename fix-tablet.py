import re

with open("src/pages/Inicio.css", "r", encoding="utf-8") as f:
    css = f.read()

# I will append the tablet styles at the very end to ensure they override any existing ones for tablet
tablet_styles = """
/* Tablet overrides applied dynamically */
@media (min-width: 768px) and (max-width: 1200px) {
  .kpi-banner-img-wrap { width: 45% !important; display: block !important; }
  .kpi-banner-img { object-position: 68% 35% !important; transform: scale(1) !important; transform-origin: 68% 35% !important; }
  .kpi-banner-gradient { 
    background: linear-gradient(to right, #141416 0%, rgba(20, 20, 22, 0.9) 0%, rgba(20, 20, 22, 0.4) 32%, rgba(20, 20, 22, 0.0) 55%) !important; 
  }
}
"""

with open("src/pages/Inicio.css", "a", encoding="utf-8") as f:
    f.write("\n" + tablet_styles)

print("Tablet styles applied!")
