with open("src/pages/Equipo.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

out = []
in_conflict = False
for line in lines:
    if line.startswith("<<<<<<< HEAD"):
        in_conflict = True
        out.append("      closeModal()\n")
        out.append("      await load()\n")
    elif line.startswith("======="):
        pass
    elif line.startswith(">>>>>>>"):
        in_conflict = False
    elif not in_conflict:
        out.append(line)

with open("src/pages/Equipo.tsx", "w", encoding="utf-8") as f:
    f.writelines(out)

print("Conflict resolved")
