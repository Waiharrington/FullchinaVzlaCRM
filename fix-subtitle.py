import re

with open("src/pages/Menu.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace the text
content = content.replace("Gestiona tus platos: nombre, precio, categoría, foto y disponibilidad.", "Gestiona y organiza todos tus platos.")
content = content.replace("Gestiona tus platos: nombre, precio, categora, foto y disponibilidad.", "Gestiona y organiza todos tus platos.")

with open("src/pages/Menu.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Updated subtitle in Menu.tsx")
