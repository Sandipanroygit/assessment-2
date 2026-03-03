# ============================================================
# DRONE GRID NAVIGATOR — PURE MANUAL (ASDW = 1 unit per tap)
# ✅ FULL-SCREEN HUD
# ✅ REAL TELLO MODE (DJITELLOPY)
# ✅ Path trace drawn on grid (blue polyline + step dots)
# ✅ Displacement vector drawn in RED (origin -> current)
# ✅ Path Efficiency shown BIG + live formula + live terms
# ✅ Mission: reach (5,12) -> STOP TIMER + Center overlay + hold 15s then save/quit
#
# Path Efficiency (PE):
#   PE = Displacement / Distance
#   Displacement = sqrt(x^2 + y^2)
#   Distance = number_of_steps (each keypress adds +1 unit)
# ============================================================

import os, csv, time, math, traceback
from datetime import datetime
from dataclasses import dataclass, field
from collections import deque

import pygame

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D  # noqa: F401
import pandas as pd

from djitellopy import Tello

# -------------------- MODE --------------------
USE_SIM = False  # ✅ REAL DRONE

# -------------------- CONFIG --------------------
STEP_CM = 100
CRUISE_ALT_CM = 100
LOW_BATT_AUTOLAND = 15
FPS = 30
MOVE_COOLDOWN_S = 0.20

TARGET_X, TARGET_Y = 5, 12
TARGET_TITLE = "MISSION SUCCESS"
TARGET_LABEL = "AURORA-07 Found"
MISSION_HOLD_S = 15

GRID_CELL_PX = 30

MARGIN = 18
TOPBAR_H = 52
FOOTER_H = 34
RIGHT_PANEL_W = 360

TRACE_MAX_POINTS = 2000

# Colors
COL_TRACE = (120, 200, 255)
COL_TRACE_DOT = (180, 230, 255)
COL_DISP = (255, 70, 70)
COL_DISP_GLOW = (255, 140, 140)
COL_AXIS = (90, 96, 115)
COL_GRID = (45, 50, 62)

# Save dir
try:
    SAVE_DIR = os.path.dirname(os.path.abspath(__file__))
except Exception:
    SAVE_DIR = os.getcwd()

SESSION_TS = datetime.now().strftime("%Y%m%d_%H%M%S")
RUN_BASE = f"grid_run_{SESSION_TS}"
LOG_CSV = os.path.join(SAVE_DIR, f"{RUN_BASE}_log.csv")

HEADER = [
    "timestamp",
    "step_idx", "cmd",
    "x", "y", "z_m", "z_m_smooth",
    "distance", "displacement", "path_efficiency",
    "elapsed_s", "avg_speed", "avg_velocity",
    "step_dx", "step_dy", "step_len", "step_time", "step_speed",
    "battery_start", "battery_end", "battery_drop",
    "yaw", "pitch", "roll"
]

# -------------------- STATE --------------------
@dataclass
class State:
    x: int = 0
    y: int = 0
    dist: float = 0.0  # distance in grid units (each keypress adds +1)
    takeoff_t0: float | None = None
    stop_t: float | None = None
    in_air: bool = False

    mission_success: bool = False
    mission_t: float | None = None

    last_move_t: float = 0.0

    trace: list[tuple[int, int]] = field(default_factory=lambda: [(0, 0)])

def displacement(x, y): return math.sqrt(x*x + y*y)

def path_efficiency(st: State) -> float:
    disp = displacement(st.x, st.y)
    return (disp / st.dist) if st.dist > 1e-9 else 0.0

def elapsed(st: State):
    if st.takeoff_t0 is None:
        return 0.0
    end = st.stop_t if st.stop_t is not None else time.time()
    return max(0.0, end - st.takeoff_t0)

def avg_speed(dist, st: State):
    dt = elapsed(st)
    return (dist / dt) if dt > 1e-6 else 0.0

def avg_velocity(disp, st: State):
    dt = elapsed(st)
    return (disp / dt) if dt > 1e-6 else 0.0

# -------------------- DRONE INIT --------------------
def init_drone() -> Tello:
    d = Tello()
    d.connect()
    try:
        d.streamoff()
    except Exception:
        pass
    print("Battery:", d.get_battery(), "%")
    return d

def ensure_altitude(d: Tello, target_cm: int):
    if target_cm <= 0:
        return
    first = min(80, target_cm)
    d.move_up(first)
    time.sleep(0.25)
    remain = target_cm - first
    if remain > 0:
        d.move_up(remain)
        time.sleep(0.25)

def get_height_m(d: Tello) -> float:
    try:
        z_cm = d.get_height()
        if z_cm is None:
            return 0.0
        return max(0.0, z_cm / 100.0)
    except Exception:
        return 0.0

def read_batt(d: Tello):
    try:
        return d.get_battery()
    except Exception:
        return ""

def get_attitude_safe(d: Tello):
    try: yaw = d.get_yaw()
    except: yaw = ""
    try: pitch = d.get_pitch()
    except: pitch = ""
    try: roll = d.get_roll()
    except: roll = ""
    return yaw, pitch, roll

# -------------------- SMOOTH Z --------------------
_ZBUF = deque(maxlen=5)
def smooth_z(z):
    _ZBUF.append(z)
    return sum(_ZBUF) / len(_ZBUF)

# -------------------- MOVE --------------------
def move_grid_1(d: Tello, st: State, dx: int, dy: int):
    if (dx, dy) not in [(1,0), (-1,0), (0,1), (0,-1)]:
        return

    step_cm = max(20, min(500, int(STEP_CM)))

    if dx == 1:
        d.move_right(step_cm); st.x += 1; st.dist += 1
    elif dx == -1:
        d.move_left(step_cm);  st.x -= 1; st.dist += 1
    elif dy == 1:
        d.move_forward(step_cm); st.y += 1; st.dist += 1
    elif dy == -1:
        d.move_back(step_cm);    st.y -= 1; st.dist += 1

    st.trace.append((st.x, st.y))
    if len(st.trace) > TRACE_MAX_POINTS:
        st.trace = st.trace[-TRACE_MAX_POINTS:]

    time.sleep(0.25)

# -------------------- LOGGING --------------------
def log_row(rows: list, st: State, d: Tello,
            step_idx: int, cmd: str,
            step_dx: int, step_dy: int,
            step_len: float, step_time: float | None,
            batt_start, batt_end):

    disp = displacement(st.x, st.y)
    z = get_height_m(d)
    z_s = smooth_z(z)
    pe = (disp / st.dist) if st.dist > 1e-9 else 0.0
    yaw, pitch, roll = get_attitude_safe(d)

    row = [
        datetime.now().isoformat(timespec="seconds"),
        step_idx, cmd,
        st.x, st.y, round(z, 3), round(z_s, 3),
        round(st.dist, 3), round(disp, 3), round(pe, 3),
        round(elapsed(st), 2),
        round(avg_speed(st.dist, st), 3),
        round(avg_velocity(disp, st), 3),
        step_dx, step_dy, step_len,
        round(step_time, 3) if step_time is not None else "",
        round((step_len/step_time), 3) if step_time not in (None, 0) else "",
        batt_start, batt_end,
        (int(batt_start)-int(batt_end)) if (str(batt_start).isdigit() and str(batt_end).isdigit()) else "",
        yaw, pitch, roll
    ]
    rows.append(row)

def write_csv(rows: list):
    with open(LOG_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(HEADER)
        w.writerows(rows)

# -------------------- PLOTS --------------------
def set_equal_3d(ax, X, Y, Z):
    if not X: X=[0]
    if not Y: Y=[0]
    if not Z: Z=[0]
    xr = (max(X)-min(X)) if len(X)>1 else 1.0
    yr = (max(Y)-min(Y)) if len(Y)>1 else 1.0
    zr = (max(Z)-min(Z)) if len(Z)>1 else 1.0
    maxr = max(xr, yr, zr, 1e-6)
    xmid = (max(X)+min(X))/2
    ymid = (max(Y)+min(Y))/2
    zmid = (max(Z)+min(Z))/2
    ax.set_xlim(xmid - maxr/2, xmid + maxr/2)
    ax.set_ylim(ymid - maxr/2, ymid + maxr/2)
    ax.set_zlim(zmid - maxr/2, zmid + maxr/2)

def plot_xy(df, out_path):
    X = pd.to_numeric(df["x"], errors="coerce").fillna(0.0).tolist()
    Y = pd.to_numeric(df["y"], errors="coerce").fillna(0.0).tolist()
    plt.figure()
    plt.plot(X, Y, linewidth=2)
    if len(X) >= 1:
        plt.scatter([X[0]], [Y[0]], s=30); plt.text(X[0], Y[0], "Start")
        plt.scatter([X[-1]], [Y[-1]], s=30); plt.text(X[-1], Y[-1], "End")
    plt.gca().set_aspect("equal", adjustable="box")
    plt.title("Top-Down XY Path (Manual)")
    plt.xlabel("X (grid units)")
    plt.ylabel("Y (grid units)")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(out_path)
    plt.close()

def plot_3d(df, out_path):
    X = pd.to_numeric(df["x"], errors="coerce").fillna(0.0).tolist()
    Y = pd.to_numeric(df["y"], errors="coerce").fillna(0.0).tolist()
    Z = pd.to_numeric(df["z_m"], errors="coerce").fillna(0.0).tolist()
    fig = plt.figure()
    ax = fig.add_subplot(111, projection="3d")
    ax.plot(X, Y, Z, linewidth=2)
    if len(X) >= 1:
        ax.scatter([X[0]], [Y[0]], [Z[0]], s=30); ax.text(X[0], Y[0], Z[0], "Start")
        ax.scatter([X[-1]], [Y[-1]], [Z[-1]], s=30); ax.text(X[-1], Y[-1], Z[-1], "End")
    ax.set_title("3D Trajectory (Manual)")
    ax.set_xlabel("X (grid units)")
    ax.set_ylabel("Y (grid units)")
    ax.set_zlabel("Z (m)")
    set_equal_3d(ax, X, Y, Z)
    fig.tight_layout()
    plt.savefig(out_path)
    plt.close(fig)

def plot_metrics(df, out_path):
    step = pd.to_numeric(df["step_idx"], errors="coerce").fillna(0).tolist()
    dist = pd.to_numeric(df["distance"], errors="coerce").fillna(0.0).tolist()
    disp = pd.to_numeric(df["displacement"], errors="coerce").fillna(0.0).tolist()
    pe   = pd.to_numeric(df["path_efficiency"], errors="coerce").fillna(0.0).tolist()
    plt.figure()
    plt.plot(step, dist, linewidth=2, label="Distance")
    plt.plot(step, disp, linewidth=2, label="Displacement")
    plt.plot(step, pe,   linewidth=2, label="Path Efficiency")
    plt.title("Metrics vs Steps (Manual)")
    plt.xlabel("Step Index")
    plt.ylabel("Value")
    plt.grid(True, alpha=0.3)
    plt.legend()
    plt.tight_layout()
    plt.savefig(out_path)
    plt.close()

def save_outputs(rows: list):
    write_csv(rows)
    df = pd.DataFrame(rows, columns=HEADER)

    xy_path = os.path.join(SAVE_DIR, f"{RUN_BASE}_xy.png")
    d3_path = os.path.join(SAVE_DIR, f"{RUN_BASE}_3d.png")
    mt_path = os.path.join(SAVE_DIR, f"{RUN_BASE}_metrics.png")

    plot_xy(df, xy_path)
    plot_3d(df, d3_path)
    plot_metrics(df, mt_path)

    print("\nSaved files in:", SAVE_DIR)
    print("LOG :", LOG_CSV)
    print("PNG1:", xy_path)
    print("PNG2:", d3_path)
    print("PNG3:", mt_path)

# -------------------- UI HELPERS --------------------
def draw_bar(surface, x, y, w, h, pct):
    pct = max(0, min(100, int(pct) if str(pct).isdigit() else 0))
    fill_w = int((pct/100.0) * w)
    pygame.draw.rect(surface, (40, 44, 52), (x, y, w, h), border_radius=6)
    pygame.draw.rect(surface, (90, 200, 120) if pct >= 30 else (235, 160, 70),
                     (x, y, fill_w, h), border_radius=6)
    pygame.draw.rect(surface, (220, 220, 220), (x, y, w, h), 2, border_radius=6)

def grid_view_center(st: State):
    cx = int(round((0 + st.x) / 2))
    cy = int(round((0 + st.y) / 2))
    return cx, cy

def world_to_screen(gx, gy, cx, cy, grid_rect):
    gx0, gy0, gw, gh = grid_rect
    px = gx0 + (gx - cx) * GRID_CELL_PX + gw//2
    py = gy0 + (cy - gy) * GRID_CELL_PX + gh//2
    return px, py

def draw_displacement_vector(surface, st: State, grid_rect):
    cx, cy = grid_view_center(st)
    o = world_to_screen(0, 0, cx, cy, grid_rect)
    p = world_to_screen(st.x, st.y, cx, cy, grid_rect)
    pygame.draw.line(surface, COL_DISP_GLOW, o, p, 8)
    pygame.draw.line(surface, COL_DISP, o, p, 4)
    pygame.draw.circle(surface, COL_DISP, p, 8)
    pygame.draw.circle(surface, (255, 220, 220), p, 12, 2)

def draw_path_trace(surface, st: State, grid_rect):
    if len(st.trace) < 2:
        return
    cx, cy = grid_view_center(st)
    pts = [world_to_screen(x, y, cx, cy, grid_rect) for (x, y) in st.trace]
    pygame.draw.lines(surface, COL_TRACE, False, pts, 3)
    for i in range(0, len(pts), max(1, len(pts)//30)):
        pygame.draw.circle(surface, COL_TRACE_DOT, pts[i], 4)

def draw_grid(surface, st: State, now_t: float, grid_rect):
    gx0, gy0, gw, gh = grid_rect
    pygame.draw.rect(surface, (24, 28, 36), (gx0, gy0, gw, gh), border_radius=16)
    pygame.draw.rect(surface, (70, 76, 92), (gx0, gy0, gw, gh), 2, border_radius=16)

    cx, cy = grid_view_center(st)
    cols = max(1, gw // GRID_CELL_PX)
    rows = max(1, gh // GRID_CELL_PX)
    half_c = cols // 2
    half_r = rows // 2

    for i in range(-half_c, half_c+1):
        x = gx0 + gw//2 + i * GRID_CELL_PX
        pygame.draw.line(surface, COL_GRID, (x, gy0), (x, gy0 + gh), 1)
    for j in range(-half_r, half_r+1):
        y = gy0 + gh//2 + j * GRID_CELL_PX
        pygame.draw.line(surface, COL_GRID, (gx0, y), (gx0 + gw, y), 1)

    ox, oy = world_to_screen(0, 0, cx, cy, grid_rect)
    pygame.draw.line(surface, COL_AXIS, (gx0, oy), (gx0 + gw, oy), 2)
    pygame.draw.line(surface, COL_AXIS, (ox, gy0), (ox, gy0 + gh), 2)

    draw_path_trace(surface, st, grid_rect)
    draw_displacement_vector(surface, st, grid_rect)

    dx, dy = world_to_screen(st.x, st.y, cx, cy, grid_rect)
    blink_on = (int(now_t * 2) % 2) == 0
    if blink_on:
        pygame.draw.circle(surface, (120, 220, 255), (dx, dy), 10)
    pygame.draw.circle(surface, (120, 220, 255), (dx, dy), 16, 2)
    return dx, dy

def draw_success_overlay(win, fonts, screen_w, screen_h, subtitle: str):
    overlay = pygame.Surface((screen_w, screen_h), pygame.SRCALPHA)
    overlay.fill((0, 0, 0, 110))
    win.blit(overlay, (0, 0))

    font_overlay_title, font_overlay_sub = fonts
    card_w = int(screen_w * 0.60)
    card_h = int(screen_h * 0.28)
    card_x = (screen_w - card_w) // 2
    card_y = (screen_h - card_h) // 2

    pygame.draw.rect(win, (18, 80, 45), (card_x, card_y, card_w, card_h), border_radius=24)
    pygame.draw.rect(win, (210, 255, 220), (card_x, card_y, card_w, card_h), 3, border_radius=24)

    title_surf = font_overlay_title.render(TARGET_TITLE, True, (240, 255, 245))
    sub_surf = font_overlay_sub.render(subtitle, True, (240, 255, 245))

    win.blit(title_surf, (card_x + (card_w - title_surf.get_width()) // 2, card_y + 42))
    win.blit(sub_surf, (card_x + (card_w - sub_surf.get_width()) // 2, card_y + 110))

def hud(win, fonts, overlay_fonts, st: State, d: Tello, screen_w, screen_h):
    font_title, font_small, font_big = fonts
    now_t = time.time()
    win.fill((14, 16, 22))

    topbar = pygame.Rect(MARGIN, MARGIN, screen_w - 2*MARGIN, TOPBAR_H)
    right_panel = pygame.Rect(
        screen_w - MARGIN - RIGHT_PANEL_W,
        MARGIN + TOPBAR_H + 10,
        RIGHT_PANEL_W,
        screen_h - (MARGIN + TOPBAR_H + 10) - (MARGIN + FOOTER_H),
    )
    grid_rect = pygame.Rect(
        MARGIN,
        MARGIN + TOPBAR_H + 10,
        (screen_w - 3*MARGIN - RIGHT_PANEL_W),
        (screen_h - (MARGIN + TOPBAR_H + 10) - (MARGIN + FOOTER_H)),
    )

    pygame.draw.rect(win, (20, 24, 32), topbar, border_radius=14)
    pygame.draw.rect(win, (70, 76, 92), topbar, 2, border_radius=14)
    win.blit(font_title.render("Drone Grid Navigator — REAL TELLO", True, (180, 210, 255)),
             (topbar.x + 16, topbar.y + 10))
    win.blit(font_small.render(f"Mission: Reach ({TARGET_X},{TARGET_Y})", True, (170, 180, 200)),
             (topbar.x + 16, topbar.y + 30))

    dx_px, dy_px = draw_grid(win, st, now_t, (grid_rect.x, grid_rect.y, grid_rect.w, grid_rect.h))
    win.blit(font_small.render(f"({st.x},{st.y})", True, (220, 235, 255)), (dx_px+18, dy_px-18))
    win.blit(font_small.render("Origin (0,0)", True, (190, 190, 210)), (grid_rect.x+12, grid_rect.y+10))

    pygame.draw.rect(win, (24, 28, 36), right_panel, border_radius=16)
    pygame.draw.rect(win, (70, 76, 92), right_panel, 2, border_radius=16)

    def text(s, x, y, c=(230,230,230), f=None):
        if f is None: f = font_small
        win.blit(f.render(s, True, c), (x, y))

    disp = displacement(st.x, st.y)
    pe = path_efficiency(st)
    steps = int(round(st.dist))

    x0 = right_panel.x + 14
    y = right_panel.y + 14

    text("PATH EFFICIENCY (PE)", x0, y, (170, 180, 200)); y += 22
    text(f"{pe:.2f}", x0, y, (220, 240, 255), font_big); y += 66

    text("PE = Displacement / Distance", x0, y); y += 20
    text("Displacement = sqrt(x^2 + y^2)", x0, y); y += 20
    text("Distance = steps × 1 unit", x0, y); y += 26
    text(f"x = {st.x}   y = {st.y}", x0, y, (120, 220, 255)); y += 22
    text(f"Displacement = sqrt({st.x}^2 + {st.y}^2) = {disp:.2f}", x0, y, COL_DISP); y += 22
    text(f"Distance = {steps} steps × 1 = {st.dist:.2f}", x0, y); y += 22
    text(f"PE = {disp:.2f} / {st.dist:.2f} = {pe:.2f}", x0, y, (220, 240, 255)); y += 28

    text(f"Timer: {elapsed(st):.1f} s", x0, y); y += 22
    text(f"Altitude Z: {get_height_m(d):.2f} m", x0, y); y += 22

    batt = read_batt(d)
    text("Battery", x0, y); draw_bar(win, x0 + 78, y+2, 210, 14, batt); y += 32

    status = "AIRBORNE" if st.in_air else "GROUND"
    text(f"Status: {status}", x0, y, (180, 210, 255) if st.in_air else (200, 200, 200)); y += 22

    footer = "T=Takeoff | W/S/A/D=1 unit | Each keypress: Distance += 1 | RED line = Displacement | ESC=Save+Quit"
    win.blit(font_small.render(footer, True, (170, 180, 200)),
             (MARGIN, screen_h - MARGIN - 22))

    if st.mission_success:
        draw_success_overlay(win, overlay_fonts, screen_w, screen_h, TARGET_LABEL)

    pygame.display.flip()

# -------------------- MAIN --------------------
def main():
    print("REAL TELLO MODE. Ensure drone is on, connected to Wi-Fi, props clear.")
    drone = init_drone()
    st = State()

    pygame.init()
    win = pygame.display.set_mode((0, 0), pygame.FULLSCREEN)
    screen_w, screen_h = win.get_size()
    pygame.display.set_caption("Drone Grid Navigator — REAL TELLO")

    font_title = pygame.font.SysFont(None, 30)
    font_small = pygame.font.SysFont(None, 20)
    font_big = pygame.font.SysFont(None, 64)
    fonts = (font_title, font_small, font_big)

    font_overlay_title = pygame.font.SysFont(None, 88)
    font_overlay_sub = pygame.font.SysFont(None, 44)
    overlay_fonts = (font_overlay_title, font_overlay_sub)

    clock = pygame.time.Clock()

    rows = []
    step_idx = 0
    b = read_batt(drone)
    log_row(rows, st, drone, step_idx, "START", 0, 0, 0.0, None, b, b)

    running = True
    save_and_land = False

    while running:
        clock.tick(FPS)

        # Safety: low battery -> land/save/quit
        try:
            if st.in_air and not st.mission_success:
                batt_now = drone.get_battery()
                if batt_now is not None and str(batt_now).isdigit() and int(batt_now) <= LOW_BATT_AUTOLAND:
                    print("Low battery — landing.")
                    st.stop_t = time.time()
                    save_and_land = True
                    running = False
        except Exception:
            pass

        for e in pygame.event.get():
            if e.type == pygame.QUIT:
                st.stop_t = time.time() if st.takeoff_t0 is not None else None
                save_and_land = True
                running = False

            elif e.type == pygame.KEYDOWN:
                k = e.key

                if k == pygame.K_t:
                    if not st.in_air and not st.mission_success:
                        drone.takeoff()
                        ensure_altitude(drone, CRUISE_ALT_CM)
                        st.in_air = True
                        st.takeoff_t0 = time.time()
                        st.stop_t = None

                        step_idx += 1
                        b2 = read_batt(drone)
                        log_row(rows, st, drone, step_idx, "TAKEOFF", 0, 0, 0.0, None, b2, b2)

                elif k == pygame.K_ESCAPE:
                    if st.takeoff_t0 is not None and st.stop_t is None:
                        st.stop_t = time.time()
                    save_and_land = True
                    running = False

                else:
                    if st.mission_success or not st.in_air:
                        continue

                    dx = dy = 0
                    cmd = None
                    if k == pygame.K_w: dy = 1;  cmd = "N"
                    elif k == pygame.K_s: dy = -1; cmd = "S"
                    elif k == pygame.K_a: dx = -1; cmd = "W"
                    elif k == pygame.K_d: dx = 1;  cmd = "E"

                    if cmd:
                        now = time.time()
                        if now - st.last_move_t < MOVE_COOLDOWN_S:
                            break
                        st.last_move_t = now

                        batt_start = read_batt(drone)
                        t0 = time.time()
                        try:
                            move_grid_1(drone, st, dx, dy)
                        except Exception as ex:
                            print("Move error:", ex)
                            if st.takeoff_t0 is not None and st.stop_t is None:
                                st.stop_t = time.time()
                            save_and_land = True
                            running = False
                            break
                        t1 = time.time()
                        batt_end = read_batt(drone)

                        step_idx += 1
                        log_row(rows, st, drone, step_idx, cmd, dx, dy, 1.0, (t1-t0), batt_start, batt_end)

                        if (st.x, st.y) == (TARGET_X, TARGET_Y):
                            st.mission_success = True
                            st.mission_t = time.time()
                            if st.stop_t is None:
                                st.stop_t = st.mission_t

                            step_idx += 1
                            b_now = read_batt(drone)
                            log_row(rows, st, drone, step_idx, "MISSION_SUCCESS", 0, 0, 0.0, None, b_now, b_now)

                            hold_until = time.time() + MISSION_HOLD_S
                            while time.time() < hold_until:
                                for ev in pygame.event.get():
                                    if ev.type == pygame.QUIT:
                                        hold_until = 0
                                    elif ev.type == pygame.KEYDOWN and ev.key == pygame.K_ESCAPE:
                                        hold_until = 0
                                hud(win, fonts, overlay_fonts, st, drone, screen_w, screen_h)
                                clock.tick(FPS)

                            save_and_land = True
                            running = False

        hud(win, fonts, overlay_fonts, st, drone, screen_w, screen_h)

    # Finalize
    try:
        if save_and_land:
            try:
                if st.in_air:
                    drone.land()
                st.in_air = False
            except Exception:
                pass

        if st.takeoff_t0 is not None and st.stop_t is None:
            st.stop_t = time.time()

        b_end = read_batt(drone)
        step_idx += 1
        log_row(rows, st, drone, step_idx, "END", 0, 0, 0.0, None, b_end, b_end)

        save_outputs(rows)

    except Exception as ex:
        print("Finalize failed:", ex)
        traceback.print_exc()

    pygame.quit()
    print("Done.")

if __name__ == "__main__":
    main()