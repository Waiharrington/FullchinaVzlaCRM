import re

with open("src/pages/Mesas.css", "r", encoding="utf-8") as f:
    css = f.read()

# Make the base ::after use the free state green instead of white
green_chair = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 114 114'%3E%3Cg fill='%234ade80' opacity='0.35'%3E%3C!-- Top Chair --%3E%3Crect x='41' y='0' width='32' height='7' rx='3.5'/%3E%3Crect x='45' y='6' width='24' height='7' rx='2'/%3E%3C!-- Bottom Chair --%3E%3Crect x='41' y='107' width='32' height='7' rx='3.5'/%3E%3Crect x='45' y='101' width='24' height='7' rx='2'/%3E%3C!-- Left Chair --%3E%3Crect x='0' y='41' width='7' height='32' rx='3.5'/%3E%3Crect x='6' y='45' width='7' height='24' rx='2'/%3E%3C!-- Right Chair --%3E%3Crect x='107' y='41' width='7' height='32' rx='3.5'/%3E%3Crect x='101' y='45' width='7' height='24' rx='2'/%3E%3C/g%3E%3C/svg%3E\") center/cover no-repeat"

css = re.sub(r'\.mesas-tile::after\s*\{[^}]*background:\s*url\([^)]+\)\s*center/cover no-repeat;\s*\}', 
             f".mesas-tile::after {{\n  content: \"\";\n  position: absolute;\n  top: -9px; left: -9px; right: -9px; bottom: -9px;\n  z-index: -1;\n  pointer-events: none;\n  border-radius: inherit;\n  transition: background 150ms ease;\n  background: {green_chair};\n}}", css)

# Remove the hover free state since it's now always on
css = re.sub(r'\.mesas-tile\.free:hover::after\s*\{[^}]*\}', '', css)

with open("src/pages/Mesas.css", "w", encoding="utf-8") as f:
    f.write(css)
print("Updated Mesas.css")
