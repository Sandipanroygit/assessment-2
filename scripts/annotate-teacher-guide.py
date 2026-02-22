from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Tuple

from PIL import Image, ImageDraw, ImageFont

ROOT = Path("docs/teacher-guide/snips")
RAW = ROOT / "raw"
OUT = ROOT

Box = Tuple[int, int, int, int]

CALLOUTS: Dict[str, List[Dict[str, object]]] = {
    "01_teacher_dashboard.png": [
        {"box": (1000, 32, 1142, 112), "tag": (835, 42), "text": "Notification bell"},
        {"box": (1055, 30, 1332, 113), "tag": (835, 108), "text": "Teacher menu entry"},
        {"box": (48, 300, 1110, 378), "tag": (58, 250), "text": "Grade + subject filters"},
        {"box": (48, 438, 1138, 909), "tag": (58, 398), "text": "Activity cards with publish and launch"},
    ],
    "02_teacher_menu.png": [
        {"box": (862, 98, 1328, 579), "tag": (706, 109), "text": "Teacher quick actions"},
        {"box": (882, 191, 1315, 247), "tag": (700, 194), "text": "Raise content request"},
        {"box": (883, 252, 1315, 310), "tag": (700, 254), "text": "Open student progress"},
        {"box": (883, 314, 1315, 371), "tag": (700, 316), "text": "Open student query inbox"},
        {"box": (883, 374, 1315, 433), "tag": (700, 376), "text": "Open registered students"},
    ],
    "03_request_modal.png": [
        {"box": (292, 182, 1050, 244), "tag": (120, 170), "text": "Choose VR or drone request mode"},
        {"box": (293, 246, 1061, 482), "tag": (120, 270), "text": "Select modules or Any other"},
        {"box": (292, 495, 1050, 703), "tag": (120, 560), "text": "Set date + notes for admin"},
        {"box": (842, 820, 1051, 886), "tag": (1120, 815), "text": "Submit request to admin"},
    ],
    "04_notifications.png": [
        {"box": (998, 30, 1140, 110), "tag": (820, 40), "text": "Bell indicates alerts"},
        {"box": (771, 101, 1238, 272), "tag": (560, 109), "text": "Notification drawer"},
        {"box": (791, 137, 1228, 200), "tag": (560, 177), "text": "Student queries shortcut"},
    ],
    "05_teacher_inbox.png": [
        {"box": (164, 94, 510, 742), "tag": (44, 106), "text": "Query list + refresh"},
        {"box": (510, 95, 1192, 741), "tag": (1010, 106), "text": "Conversation workspace"},
        {"box": (165, 95, 490, 163), "tag": (44, 182), "text": "Close inbox from header"},
    ],
    "06_progress.png": [
        {"box": (48, 148, 286, 192), "tag": (318, 150), "text": "Pick module to review"},
        {"box": (47, 219, 1144, 322), "tag": (918, 332), "text": "Track status, attempts, reminders"},
    ],
    "07_students.png": [
        {"box": (48, 136, 410, 195), "tag": (428, 138), "text": "Sort students by field"},
        {"box": (48, 219, 1144, 322), "tag": (908, 332), "text": "Registered student roster"},
    ],
    "08_publish_controls.png": [
        {"box": (44, 105, 1340, 205), "tag": (58, 218), "text": "Sticky header: bell + menu"},
        {"box": (46, 104, 1138, 909), "tag": (58, 835), "text": "Module grid for teacher subject"},
        {"box": (62, 340, 1134, 733), "tag": (920, 246), "text": "Publish/Unpublish and Show activity/code"},
    ],
}


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    windows_font = Path("C:/Windows/Fonts/segoeui.ttf")
    if windows_font.exists():
        return ImageFont.truetype(str(windows_font), size)
    return ImageFont.load_default()


def draw_callout(
    draw: ImageDraw.ImageDraw,
    box: Box,
    index: int,
    tag: Tuple[int, int],
    text: str,
    font: ImageFont.ImageFont,
    small_font: ImageFont.ImageFont,
) -> None:
    x1, y1, x2, y2 = box
    tx, ty = tag
    color = "#0ea5a5"

    draw.rounded_rectangle(box, radius=12, outline=color, width=4)

    center_x = (x1 + x2) // 2
    center_y = (y1 + y2) // 2
    draw.line((tx + 18, ty + 18, center_x, center_y), fill=color, width=3)

    badge_box = (tx, ty, tx + 36, ty + 36)
    draw.ellipse(badge_box, fill="#0f172a", outline="#e2e8f0", width=2)
    num_text = str(index)
    num_w, num_h = draw.textbbox((0, 0), num_text, font=font)[2:]
    draw.text((tx + (36 - num_w) // 2, ty + (36 - num_h) // 2 - 1), num_text, fill="#f8fafc", font=font)

    text_x = tx + 44
    text_y = ty + 4
    text_w = draw.textbbox((0, 0), text, font=small_font)[2]
    text_h = draw.textbbox((0, 0), text, font=small_font)[3]
    text_bg = (text_x - 8, text_y - 5, text_x + text_w + 10, text_y + text_h + 6)
    draw.rounded_rectangle(text_bg, radius=8, fill="#0f172acc", outline="#38bdf8", width=2)
    draw.text((text_x, text_y), text, fill="#f8fafc", font=small_font)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    number_font = load_font(18)
    text_font = load_font(18)
    title_font = load_font(28)

    for raw_name, notes in CALLOUTS.items():
        raw_path = RAW / raw_name
        if not raw_path.exists():
            continue

        image = Image.open(raw_path).convert("RGBA")
        draw = ImageDraw.Draw(image, "RGBA")

        header_box = (20, 18, 612, 64)
        draw.rounded_rectangle(header_box, radius=10, fill="#082f49dd", outline="#38bdf8", width=2)
        draw.text((34, 28), "Teacher Walkthrough Snip", fill="#f0f9ff", font=title_font)

        for idx, callout in enumerate(notes, start=1):
            draw_callout(
                draw=draw,
                box=callout["box"],  # type: ignore[arg-type]
                index=idx,
                tag=callout["tag"],  # type: ignore[arg-type]
                text=callout["text"],  # type: ignore[arg-type]
                font=number_font,
                small_font=text_font,
            )

        out_name = raw_name.replace(".png", "_annotated.png")
        image.convert("RGB").save(OUT / out_name, optimize=True)
        print(f"saved {out_name}")


if __name__ == "__main__":
    main()
