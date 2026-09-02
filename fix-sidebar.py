import re

with open("src/components/Sidebar.css", "r", encoding="utf-8") as f:
    css = f.read()

hide_scroll = """
/* Ocultar barra de scroll del menu lateral */
.sidebar-nav {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.sidebar-nav::-webkit-scrollbar {
  display: none;
}
"""

if "scrollbar-width: none" not in css:
    with open("src/components/Sidebar.css", "a", encoding="utf-8") as f:
        f.write("\n" + hide_scroll)
    print("Added to Sidebar.css")
else:
    print("Already exists")
