import re

with open("src/pages/Menu.css", "r", encoding="utf-8") as f:
    css = f.read()

# I will replace the page-header definition to make it flex: 1 for the first div
css = css.replace('.mnu-page .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 4px; }', 
                  '.mnu-page .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 4px; flex-wrap: wrap; }\n.mnu-page .page-header > div:first-child { flex: 1; min-width: 250px; }\n.mnu-page .page-header > div:last-child { flex-shrink: 0; }')

# And also add a media query so it strictly does not wrap on tablet and desktop
media_query = """
@media (min-width: 600px) {
  .mnu-page .page-header { flex-wrap: nowrap; }
}
"""

with open("src/pages/Menu.css", "w", encoding="utf-8") as f:
    f.write(css + "\n" + media_query)

print("Updated Menu.css")
