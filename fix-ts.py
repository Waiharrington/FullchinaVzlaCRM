import re

with open("src/pages/Clientes.tsx", "r", encoding="utf-8") as f:
    tsx = f.read()

# Replace customers.map((customer, index) => { with customers.map((customer) => {
tsx = tsx.replace("const rows: CustomerRow[] = customers.map((customer, index) => {", "const rows: CustomerRow[] = customers.map((customer) => {")

with open("src/pages/Clientes.tsx", "w", encoding="utf-8") as f:
    f.write(tsx)

print("Removed unused 'index' variable")
