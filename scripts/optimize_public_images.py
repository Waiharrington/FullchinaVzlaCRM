from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
OUTPUT = PUBLIC / "optimized"


RULES: dict[str, tuple[int, int]] = {
    "productos": (720, 76),
    "menu-icons": (320, 80),
    "fondos": (1920, 78),
    "cargando-pedido": (720, 80),
    "login-carousel": (1600, 78),
    "onboarding-slides": (1400, 80),
}

ROOT_IMAGES: dict[str, tuple[int, int]] = {
    "fondo-telefono.png": (1200, 78),
    "login-bg.png": (1920, 78),
    "kpi-bg.png": (1600, 78),
    "splash-bg-desktop.png": (1920, 78),
    "splash-bg-mobile.png": (1200, 78),
    "foto-comida.png": (1200, 80),
    "fondo-login.png": (1920, 80),
    "logo.png": (640, 86),
    "splash-logo.png": (640, 86),
}


def convert(source: Path, target: Path, max_edge: int, quality: int) -> None:
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original)
        image.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if "transparency" in image.info else "RGB")
        target.parent.mkdir(parents=True, exist_ok=True)
        image.save(target, "WEBP", quality=quality, method=6, exact=True)


def main() -> None:
    converted = 0
    original_bytes = 0
    optimized_bytes = 0

    for folder, (max_edge, quality) in RULES.items():
        source_dir = PUBLIC / folder
        for source in source_dir.iterdir():
            if source.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
                continue
            target = OUTPUT / folder / f"{source.stem}.webp"
            convert(source, target, max_edge, quality)
            converted += 1
            original_bytes += source.stat().st_size
            optimized_bytes += target.stat().st_size

    for filename, (max_edge, quality) in ROOT_IMAGES.items():
        source = PUBLIC / filename
        if not source.exists():
            continue
        target = OUTPUT / "root" / f"{source.stem}.webp"
        convert(source, target, max_edge, quality)
        converted += 1
        original_bytes += source.stat().st_size
        optimized_bytes += target.stat().st_size

    reduction = 100 * (1 - optimized_bytes / original_bytes)
    print(
        f"Optimized {converted} images: "
        f"{original_bytes / 1024 / 1024:.2f} MB -> "
        f"{optimized_bytes / 1024 / 1024:.2f} MB ({reduction:.1f}% smaller)"
    )


if __name__ == "__main__":
    main()
