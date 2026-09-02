import re

with open("src/pages/Clientes.css", "r", encoding="utf-8") as f:
    css = f.read()

# Make search box smaller
css = css.replace(
    ".filter-search-box {\n  display: flex;\n  align-items: center;\n  background: #202024;",
    ".filter-search-box {\n  display: flex;\n  align-items: center;\n  background: rgba(255,255,255,0.03);\n  border: 1px solid rgba(255,255,255,0.08) !important;\n  flex: 0 1 260px !important;\n"
)

# Change verified format badge to neutral
css = css.replace(
    ".identity-badge.verified_format {\n  color: #34d399;\n  background: rgba(16, 185, 129, .12);\n  border: 1px solid rgba(52, 211, 153, .25);\n}",
    ".identity-badge.verified_format {\n  color: #a1a1aa;\n  background: rgba(161, 161, 170, .1);\n  border: 1px solid rgba(161, 161, 170, .2);\n}"
)

# Add alignment classes
css += "\n.amount-th { text-align: right !important; padding-right: 14px !important; }\n"
css += ".amount-td { text-align: right !important; padding-right: 14px !important; }\n"
css += ".text-muted-amount { color: #52525b !important; }\n"

with open("src/pages/Clientes.css", "w", encoding="utf-8") as f:
    f.write(css)

with open("src/pages/Clientes.tsx", "r", encoding="utf-8") as f:
    tsx = f.read()

# Replace TH
tsx = tsx.replace("<th>Total comprado</th>", "<th className=\"amount-th\">Total comprado</th>")
tsx = tsx.replace("<th>Saldo pendiente</th>", "<th className=\"amount-th\">Saldo pendiente</th>")

# Replace TD
# It looks like: <td className="amount-td"><MoneyWithBcv usd={row.totalPurchased} usdClassName="font-bold" compact /></td>
tsx = re.sub(
    r'<td className="amount-td"><MoneyWithBcv usd=\{row\.totalPurchased\}.*?/></td>',
    r'<td className="amount-td"><MoneyWithBcv usd={row.totalPurchased} className={row.totalPurchased === 0 ? "text-muted-amount" : ""} usdClassName="font-bold" compact /></td>',
    tsx
)
tsx = re.sub(
    r'<td className="amount-td"><MoneyWithBcv usd=\{row\.pendingBalance\} className=\{.*?\} usdClassName="font-bold" compact /></td>',
    r'<td className="amount-td"><MoneyWithBcv usd={row.pendingBalance} className={row.pendingBalance > 0 ? "text-red" : "text-muted-amount"} usdClassName="font-bold" compact /></td>',
    tsx
)

# Avatar colors (change to standard neutral #3f3f46)
tsx = tsx.replace("index % 2 === 0 ? '#dc2626' : '#d97706'", "'#3f3f46'")

with open("src/pages/Clientes.tsx", "w", encoding="utf-8") as f:
    f.write(tsx)

print("Applied UI fixes to Clientes")
