# ============================================================

import os, csv, time, math, traceback, re
from datetime import datetime
from dataclasses import dataclass, field
from collections import deque

import pygame
from djitellopy import Tello

import matplotlib
matplotlib.use("Agg")  # safe headless
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D  # noqa: F401
from matplotlib import animation
import numpy as np
import pandas as pd

# ---------- STUDENT NAME PROMPT ----------
def sanitize_name(s: str) -> str:
    s = s.strip()
    s = re.sub(r"\s+", "_", s)
    s = re.sub(r"[^A-Za-z0-9_\-]", "", s)
    return s or "Student"

STUDENT_RAW = input("Enter student name: ")
STUDENT = sanitize_name(STUDENT_RAW)
print("Student:", STUDENT)

# ---------- CONFIG ----------
STEP_CM = 100                # 1 grid step = 1 m (horizontal)
CRUISE_ALT_CM = 100          # ~1 m
LOW_BATT_AUTOLAND = 15       # %
HUD_W, HUD_H = 820, 320
FPS = 30

LOG_DIR = "logs"
OUT_DIR = "analysis_output"
os.makedirs(LOG_DIR, exist_ok=True)
os.makedirs(OUT_DIR, exist_ok=True)

SESSION_TS = datetime.now().strftime("%Y%m%d_%H%M%S")
SESSION_CSV = os.path.join(LOG_DIR, f"{STUDENT}_session_{SESSION_TS}.csv")

SESSION_HEADER = [
    "timestamp","session_ts","mission","step_idx","cmd",
    "x_m","y_m","z_m","z_m_smooth",
    "distance_m","displacement_m","path_efficiency",
    "elapsed_s","avg_speed_mps","avg_velocity_mps",
    "step_dx_m","step_dy_m","step_len_m","step_time_s","step_speed_mps",
    "battery_pct_start","battery_pct_end","battery_drop",
    "yaw_deg","pitch_deg","roll_deg","vx_mps","vy_mps","vz_mps"
]

# ---------- STATE ----------
@dataclass
class State:
    x: int = 0           # grid meters (integer steps)
    y: int = 0
    dist_m: float = 0.0  # cumulative horizontal distance (m)
    t0: float = field(default_factory=time.time)
    mission: str = "IDLE"
    in_air: bool = False

def displacement_m(x, y): return math.sqrt((x**2) + (y**2))
def elapsed_s(t0): return time.time() - t0
def avg_speed(dist_m, t0):
    dt = elapsed_s(t0)
    return (dist_m / dt) if dt > 1e-6 else 0.0
def avg_velocity(disp_m, t0):
    dt = elapsed_s(t0)
    return (disp_m / dt) if dt > 1e-6 else 0.0

# ---------- TELLO ----------
def init_tello() -> Tello:
    t = Tello(); t.connect()
    try: t.streamoff()
    except Exception: pass
    print("Battery:", t.get_battery(), "%")
    return t

def ensure_altitude(t: Tello, target_cm: int):
    if target_cm > 0:
        t.move_up(min(80, target_cm)); time.sleep(0.25)
        if target_cm > 120:
            t.move_up(target_cm - 80); time.sleep(0.25)

def get_height_m(t: Tello) -> float:
    try:
        z_cm = t.get_height()
        if z_cm is None: return 0.0
        return max(0.0, z_cm / 100.0)
    except Exception:
        return 0.0

def read_batt(t: Tello):
    try: return t.get_battery()
    except Exception: return ""

def move_grid(t: Tello, st: State, dx_m: int, dy_m: int):
    """Move in the horizontal grid; updates x, y and cumulative horizontal distance."""
    try:
        if dx_m != 0:
            if dx_m > 0: t.move_right(STEP_CM * dx_m)
            else:        t.move_left (STEP_CM * (-dx_m))
            time.sleep(0.25)
            st.x += dx_m; st.dist_m += abs(dx_m)

        if dy_m != 0:
            if dy_m > 0: t.move_forward(STEP_CM * dy_m)
            else:        t.move_back   (STEP_CM * (-dy_m))
            time.sleep(0.25)
            st.y += dy_m; st.dist_m += abs(dy_m)
    except Exception as e:
        print("Move failed:", e)
        try: t.land()
        except Exception: pass
        st.in_air = False
        raise

# ---------- HUD (UPGRADED) ----------
def draw_battery_bar(surface, x, y, w, h, pct):
    pct = max(0, min(100, int(pct) if str(pct).isdigit() else 0))
    fill_w = int((pct/100.0)*w)
    # bg
    pygame.draw.rect(surface, (40, 44, 52), (x, y, w, h), border_radius=6)
    # fill (green->orange under 30%)
    color = (90, 200, 120) if pct >= 30 else (235, 160, 70)
    pygame.draw.rect(surface, color, (x, y, fill_w, h), border_radius=6)
    # outline
    pygame.draw.rect(surface, (220, 220, 220), (x, y, w, h), 2, border_radius=6)

def hud_draw(win, font, st: State, t: Tello):
    win.fill((14, 16, 22))
    # panel
    panel_color = (24, 28, 36)
    pygame.draw.rect(win, panel_color, (10, 10, HUD_W-20, HUD_H-20), border_radius=12)
    pygame.draw.line(win, (60, 66, 80), (20, 60), (HUD_W-20, 60), 1)

    def text(line, xy, color=(230, 230, 230)):
        surf = font.render(line, True, color); win.blit(surf, xy)

    # title row
    text(f"Tello Vectors & 3D — {st.mission}", (24, 22), (180, 210, 255))
    text(f"Student: {STUDENT}", (24, 66), (200, 200, 200))

    disp = displacement_m(st.x, st.y)
    pe = (disp / st.dist_m) if st.dist_m > 1e-9 else 0.0
    # left column
    text(f"Grid Pos (x,y): ({st.x}, {st.y}) m", (24, 100))
    text(f"Distance: {st.dist_m:.2f} m", (24, 130), (210, 230, 210))
    text(f"Displacement: {disp:.2f} m", (24, 155), (255, 200, 200))
    text(f"Path Efficiency: {pe:.2f}", (24, 180), (220, 220, 170))
    # right column
    text(f"Elapsed: {elapsed_s(st.t0):.1f} s", (400, 100))
    text(f"Avg Speed: {avg_speed(st.dist_m, st.t0):.3f} m/s", (400, 130))
    text(f"Avg Velocity: {avg_velocity(disp, st.t0):.3f} m/s", (400, 155))
    # battery
    try:
        batt = t.get_battery()
    except Exception:
        batt = "--"
    text("Battery", (400, 190))
    draw_battery_bar(win, 470, 190, 300, 16, batt)

    # footer help
    text("Keys: T=Takeoff  L=Land  1/2/3/4=Run Missions  H=Home  ↑↓←→=Move  W=Up  S=Down  Q=Save  ESC=Quit",
         (24, 250), (170, 180, 200))

    pygame.display.flip()

def reset_trial(st: State, mission_name: str):
    st.x = 0; st.y = 0
    st.dist_m = 0.0
    st.t0 = time.time()
    st.mission = mission_name

def write_session_header_if_needed():
    if not os.path.exists(SESSION_CSV):
        with open(SESSION_CSV, "w", newline="", encoding="utf-8") as f:
            csv.writer(f).writerow(SESSION_HEADER)

# ---- smoothing & attitude/speeds (guarded) ----
_ZBUF = deque(maxlen=5)
def smooth_z(z): _ZBUF.append(z); return sum(_ZBUF)/len(_ZBUF)

def get_attitude_safe(t):
    try:    yaw = t.get_yaw()
    except: yaw = ""
    try:    pitch = t.get_pitch()
    except: pitch = ""
    try:    roll = t.get_roll()
    except: roll = ""
    return yaw, pitch, roll

def get_speeds_safe(t):
    try:
        vgx = t.get_state_field("vgx")  # cm/s
        vgy = t.get_state_field("vgy")
        vgz = t.get_state_field("vgz")
        def conv(v):
            return round(float(v)/100.0, 3) if v not in (None, "") else ""
        return conv(vgx), conv(vgy), conv(vgz)
    except Exception:
        return "", "", ""

def log_row(st: State, t: Tello, rows_accum: list,
            step_idx: int, cmd: str,
            step_dx_m: float, step_dy_m: float,
            step_len_m: float, step_time_s: float,
            batt_start, batt_end):
    disp = displacement_m(st.x, st.y)
    z_m = get_height_m(t)
    z_s = smooth_z(z_m)
    pe = (disp / st.dist_m) if st.dist_m > 1e-9 else 0.0
    yaw, pitch, roll = get_attitude_safe(t)
    vx, vy, vz = get_speeds_safe(t)
    row = [
        datetime.now().isoformat(timespec="seconds"),
        SESSION_TS,
        st.mission, step_idx, cmd,
        st.x, st.y, round(z_m, 3), round(z_s, 3),
        round(st.dist_m, 3), round(disp, 3), round(pe, 3),
        round(elapsed_s(st.t0), 2),
        round(avg_speed(st.dist_m, st.t0), 3),
        round(avg_velocity(disp, st.t0), 3),
        step_dx_m, step_dy_m, step_len_m,
        round(step_time_s, 3) if step_time_s is not None else "",
        round((step_len_m/step_time_s), 3) if step_time_s not in (None, 0) else "",
        batt_start, batt_end,
        (int(batt_start)-int(batt_end)) if (str(batt_start).isdigit() and str(batt_end).isdigit()) else "",
        yaw, pitch, roll, vx, vy, vz
    ]
    rows_accum.append(row)

# ---------- PLOTTING + ANIMATION ----------
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

def plot_3d_with_displacement(X, Y, Z, title, outfile):
    fig = plt.figure()
    ax = fig.add_subplot(111, projection="3d")
    ax.plot(X, Y, Z, linewidth=2)
    if len(X) >= 1:
        ax.scatter([X[0]],[Y[0]],[Z[0]], s=30); ax.text(X[0],Y[0],Z[0],"Start")
        ax.scatter([X[-1]],[Y[-1]],[Z[-1]], s=30); ax.text(X[-1],Y[-1],Z[-1],"End")
        ax.plot([X[0], X[-1]], [Y[0], Y[-1]], [Z[0], Z[-1]], color="red", linewidth=2, linestyle="--", label="Displacement")
        ax.legend()
    ax.set_title(title); ax.set_xlabel("X (m)"); ax.set_ylabel("Y (m)"); ax.set_zlabel("Z (m)")
    set_equal_3d(ax, X, Y, Z)
    fig.tight_layout(); plt.savefig(outfile); plt.close(fig)

def plot_xy_with_displacement(X, Y, title, outfile):
    plt.figure()
    plt.plot(X, Y, linewidth=2)
    if len(X) >= 1:
        plt.scatter([X[0]],[Y[0]], s=30); plt.text(X[0],Y[0],"Start")
        plt.scatter([X[-1]],[Y[-1]], s=30); plt.text(X[-1],Y[-1],"End")
        plt.plot([X[0], X[-1]], [Y[0], Y[-1]], color="red", linewidth=2, linestyle="--", label="Displacement")
        plt.legend()
    plt.gca().set_aspect('equal', adjustable='box')
    plt.title(title); plt.xlabel("X (m)"); plt.ylabel("Y (m)"); plt.grid(True, alpha=0.3)
    plt.tight_layout(); plt.savefig(outfile); plt.close()

def animate_3d_trajectory(X, Y, Z, title, outfile_base):
    """Save 3D animation as MP4 (ffmpeg) else GIF (pillow)."""
    if len(X) < 2:
        return None
    X = np.array(X); Y = np.array(Y); Z = np.array(Z)
    fig = plt.figure()
    ax = fig.add_subplot(111, projection='3d')
    set_equal_3d(ax, X.tolist(), Y.tolist(), Z.tolist())
    ax.set_title(title); ax.set_xlabel("X (m)"); ax.set_ylabel("Y (m)"); ax.set_zlabel("Z (m)")
    # plot elements
    line, = ax.plot([], [], [], lw=2)
    start = ax.scatter([X[0]], [Y[0]], [Z[0]], s=30)
    end   = ax.scatter([X[-1]], [Y[-1]], [Z[-1]], s=30)
    disp, = ax.plot([X[0], X[-1]], [Y[0], Y[-1]], [Z[0], Z[-1]], 'r--', lw=2)

    def init():
        line.set_data([], [])
        line.set_3d_properties([])
        return line, start, end, disp

    def update(i):
        line.set_data(X[:i+1], Y[:i+1])
        line.set_3d_properties(Z[:i+1])
        return line, start, end, disp

    frames = max(30, len(X))  # ensure smoothness
    ani = animation.FuncAnimation(fig, update, init_func=init, frames=frames, interval=33, blit=True)

    # Try MP4 with ffmpeg, else GIF
    mp4_path = outfile_base + "_3d_anim.mp4"
    gif_path = outfile_base + "_3d_anim.gif"
    try:
        Writer = animation.writers['ffmpeg']
        writer = Writer(fps=30, metadata=dict(artist='AerohawX'), bitrate=1800)
        ani.save(mp4_path, writer=writer)
        plt.close(fig)
        return mp4_path
    except Exception:
        try:
            from matplotlib.animation import PillowWriter
            ani.save(gif_path, writer=PillowWriter(fps=20))
            plt.close(fig)
            return gif_path
        except Exception as e:
            plt.close(fig)
            print("Animation save failed:", e)
            return None

def save_mission_csv_and_plot(mission_name: str, rows: list):
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    mission_base = f"{STUDENT}_mission_{mission_name}_{ts}"
    mission_csv = os.path.join(LOG_DIR, f"{mission_base}.csv")

    with open(mission_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerow(SESSION_HEADER); w.writerows(rows)

    write_session_header_if_needed()
    with open(SESSION_CSV, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerows(rows)

    # Static plots
    df = pd.DataFrame(rows, columns=SESSION_HEADER)
    X = pd.to_numeric(df["x_m"], errors="coerce").fillna(0.0).tolist()
    Y = pd.to_numeric(df["y_m"], errors="coerce").fillna(0.0).tolist()
    Z = pd.to_numeric(df["z_m"], errors="coerce").fillna(0.0).tolist()

    plot_path_3d = os.path.join(OUT_DIR, f"{mission_base}_3d.png")
    plot_3d_with_displacement(X, Y, Z, title=f"3D Trajectory — {mission_name} — {STUDENT}", outfile=plot_path_3d)

    plot_path_xy = os.path.join(OUT_DIR, f"{mission_base}_xy.png")
    plot_xy_with_displacement(X, Y, title=f"Top-Down XY — {mission_name} — {STUDENT}", outfile=plot_path_xy)

    # Animation
    anim_out_base = os.path.join(OUT_DIR, mission_base)
    anim_path = animate_3d_trajectory(X, Y, Z, title=f"3D Trajectory — {mission_name} — {STUDENT}", outfile_base=anim_out_base)

    print("Saved mission CSV:", mission_csv)
    print("Saved 3D plot:", plot_path_3d)
    print("Saved XY plot:", plot_path_xy)
    if anim_path:
        print("Saved 3D animation:", anim_path)
    else:
        print("3D animation not saved.")

# ---------- MISSIONS ----------
def run_mission(t: Tello, st: State, name: str, steps: list):
    b0 = read_batt(t)
    if b0 and str(b0).isdigit() and int(b0) <= LOW_BATT_AUTOLAND:
        print("Battery too low to start mission.")
        return

    if not st.in_air:
        t.takeoff()
        ensure_altitude(t, CRUISE_ALT_CM)
        st.in_air = True

    reset_trial(st, name)
    rows = []
    step_idx = 0

    batt = read_batt(t)
    log_row(st, t, rows, step_idx, "START", 0, 0, 0.0, None, batt, batt)

    for dx, dy in steps:
        step_idx += 1
        cmd = f"{'R' if dx>0 else 'L' if dx<0 else ''}{abs(dx) if dx!=0 else ''}" \
               f"{'F' if dy>0 else 'B' if dy<0 else ''}{abs(dy) if dy!=0 else ''}".strip()
        step_len = abs(dx) + abs(dy)

        batt_start = read_batt(t); t_start = time.time()
        move_grid(t, st, dx, dy)
        t_end = time.time(); batt_end = read_batt(t)

        step_time = t_end - t_start
        log_row(st, t, rows, step_idx, cmd, dx, dy, step_len, step_time, batt_start, batt_end)

        try:
            if batt_end is not None and str(batt_end).isdigit() and int(batt_end) <= LOW_BATT_AUTOLAND:
                print("Low battery — auto landing.")
                t.land(); st.in_air = False
                break
        except Exception:
            pass

    step_idx += 1
    batt_final = read_batt(t)
    log_row(st, t, rows, step_idx, "END", 0, 0, 0.0, None, batt_final, batt_final)

    save_mission_csv_and_plot(name, rows)

    try:
        if st.in_air:
            t.land(); st.in_air = False
            print("Mission complete — auto-land executed.")
    except Exception as e:
        print("Auto-land after mission failed:", e)

def mission_detour(t, st):
    steps = [(+1,0), (0,+1), (+1,0), (0,+1), (-2,0), (0,+1)]
    run_mission(t, st, "Detour", steps)

def mission_loop(t, st):
    steps = [(+1,0), (0,+2), (-1,0), (0,-2)]
    run_mission(t, st, "Loop", steps)

def mission_straight(t, st):
    steps = [(+2,0), (0,+1)]
    run_mission(t, st, "Straight", steps)

# ---------- MISSION 4: MANUAL CONTROL + COME HOME ----------
def mission_manual(t, st):
    """Manual flight with arrows (horizontal) and W/S (vertical); logs like other missions."""
    print("\nManual Flight Mode (Arrows: move, W: up, S: down, Q: save/quit)\n")
    if not st.in_air:
        t.takeoff()
        ensure_altitude(t, CRUISE_ALT_CM)
        st.in_air = True

    reset_trial(st, "Manual_Flight")
    rows = []
    step_idx = 0
    batt = read_batt(t)
    log_row(st, t, rows, step_idx, "START", 0, 0, 0.0, None, batt, batt)

    pygame.display.set_caption("Manual Flight Logger (↑ ↓ ← → / W=Up / S=Down / Q=Save)")
    run_manual = True
    clock = pygame.time.Clock()

    while run_manual:
        clock.tick(FPS)
        for e in pygame.event.get():
            if e.type == pygame.QUIT:
                run_manual = False
            elif e.type == pygame.KEYDOWN:
                k = e.key
                dx = dy = 0
                cmd = ""

                # Horizontal (1 m per tap)
                if k == pygame.K_UP:       dy = +1; cmd = "F1"
                elif k == pygame.K_DOWN:   dy = -1; cmd = "B1"
                elif k == pygame.K_RIGHT:  dx = +1; cmd = "R1"
                elif k == pygame.K_LEFT:   dx = -1; cmd = "L1"

                # Vertical (1 m per tap)
                elif k == pygame.K_w:
                    cmd = "U1"
                    batt_start = read_batt(t); t_start = time.time()
                    try:
                        t.move_up(STEP_CM)
                    except Exception:
                        run_manual = False; break
                    t_end = time.time(); batt_end = read_batt(t)
                    step_idx += 1
                    # log as vertical step: no x/y increment
                    log_row(st, t, rows, step_idx, cmd, 0, 0, 0.0, t_end - t_start, batt_start, batt_end)

                elif k == pygame.K_s:
                    cmd = "D1"
                    batt_start = read_batt(t); t_start = time.time()
                    try:
                        t.move_down(STEP_CM)
                    except Exception:
                        run_manual = False; break
                    t_end = time.time(); batt_end = read_batt(t)
                    step_idx += 1
                    log_row(st, t, rows, step_idx, cmd, 0, 0, 0.0, t_end - t_start, batt_start, batt_end)

                # Quit & save
                elif k == pygame.K_q:
                    run_manual = False
                    break

                # Execute horizontal move if any
                if dx != 0 or dy != 0:
                    batt_start = read_batt(t); t_start = time.time()
                    try:
                        move_grid(t, st, dx, dy)
                    except Exception:
                        run_manual = False
                        break
                    t_end = time.time(); batt_end = read_batt(t)
                    step_idx += 1
                    step_time = t_end - t_start
                    log_row(st, t, rows, step_idx, cmd, dx, dy,
                            abs(dx)+abs(dy), step_time, batt_start, batt_end)

        # low-battery safety during manual
        try:
            if st.in_air:
                batt_now = t.get_battery()
                if batt_now is not None and str(batt_now).isdigit() and int(batt_now) <= LOW_BATT_AUTOLAND:
                    print("Low battery — auto landing.")
                    run_manual = False
                    break
        except Exception:
            pass

    batt_final = read_batt(t)
    step_idx += 1
    log_row(st, t, rows, step_idx, "END", 0, 0, 0.0, None, batt_final, batt_final)

    save_mission_csv_and_plot("Manual_Flight", rows)

    try:
        if st.in_air:
            t.land(); st.in_air = False
            print("Manual flight ended — auto-land executed.")
    except Exception as e:
        print("Auto-land failed:", e)

def come_home(t, st):
    """Return to starting grid (0,0) and land."""
    if not st.in_air:
        print("Drone not airborne.")
        return
    print("Returning to home...")
    try:
        if st.x > 0: t.move_left(STEP_CM * abs(st.x))
        elif st.x < 0: t.move_right(STEP_CM * abs(st.x))
        if st.y > 0: t.move_back(STEP_CM * abs(st.y))
        elif st.y < 0: t.move_forward(STEP_CM * abs(st.y))
        time.sleep(0.25)
        st.x, st.y = 0, 0
        t.land(); st.in_air = False
        print("Returned home and landed.")
    except Exception as e:
        print("Return-home failed:", e)
        try: t.land()
        except Exception: pass

# ---------- MAIN + HUD ----------
def manual_hud_loop(t: Tello, st: State):
    pygame.init()
    win = pygame.display.set_mode((HUD_W, HUD_H))
    pygame.display.set_caption("Tello Vectors & 3D — Auto Missions (1/2/3/4) + Home (H)")
    font = pygame.font.SysFont(None, 24)
    clock = pygame.time.Clock()
    running = True

    while running:
        clock.tick(FPS)
        for e in pygame.event.get():
            if e.type == pygame.QUIT:
                running = False
            elif e.type == pygame.KEYDOWN:
                k = e.key
                try:
                    if k == pygame.K_ESCAPE:
                        running = False
                    elif k == pygame.K_t:
                        if not st.in_air:
                            t.takeoff(); ensure_altitude(t, CRUISE_ALT_CM)
                            st.in_air = True; reset_trial(st, "Manual")
                    elif k == pygame.K_l:
                        if st.in_air:
                            t.land(); st.in_air = False
                    elif k == pygame.K_1:
                        mission_detour(t, st)
                    elif k == pygame.K_2:
                        mission_loop(t, st)
                    elif k == pygame.K_3:
                        mission_straight(t, st)
                    elif k == pygame.K_4:
                        mission_manual(t, st)
                    elif k == pygame.K_h:
                        come_home(t, st)
                except Exception as ex:
                    print("Error during action:", ex)
                    traceback.print_exc()
                    try:
                        if st.in_air: t.land()
                        st.in_air = False
                    except Exception: pass

        try:
            if st.in_air:
                batt = t.get_battery()
                if batt is not None and str(batt).isdigit() and int(batt) <= LOW_BATT_AUTOLAND:
                    print("Low battery — auto landing.")
                    t.land(); st.in_air = False
        except Exception:
            pass

        hud_draw(win, font, st, t)

    try:
        if st.in_air: t.land()
    except Exception: pass
    pygame.quit()

def main():
    print(f"Student: {STUDENT}")
    print("Session CSV will be:", SESSION_CSV)
    write_session_header_if_needed()
    t = init_tello()
    st = State()
    manual_hud_loop(t, st)

if __name__ == "__main__":
    try: main()
    except KeyboardInterrupt: print("\nInterrupted by user.")
    except Exception as e:
        print("Fatal error:", e); traceback.print_exc()
