# ============================================================
# DRONE TRAJECTORY SIM — CLEAN 3D + PRO HUD (NO OVERLAP) + SOUND + EXPORTS (9 FILES)
#
# Exports (same folder as this .py):
#   Mission 1:  _xy.png, _3d.png, _3d_anim.gif
#   Mission 2:  _xy.png, _3d.png, _3d_anim.gif
#   Mission 3:  _xy.png, _3d.png, _3d_anim.gif
#
# Visual theme:
#   - White background
#   - Blue trajectory
#   - Red dotted displacement
#   - Light XY grid at z=0 + axes (NO lattice)
#
# Sound:
#   - Procedurally generated drone hum
#   - Plays only while moving
# ============================================================

import os
import time
import math
import io
import wave
import struct
from dataclasses import dataclass, field

import pygame

# --- Matplotlib exports (PNG + GIF) ---
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import animation


# ----------------------------
# CONFIG
# ----------------------------
FPS = 60
STEP_DURATION = 2.0
STEP_PAUSE = 0.5

TAKEOFF_Z = 1
HOME = (0, 0, TAKEOFF_Z)

TRAIL_MAX_POINTS = 4000
GRID_XY_RANGE = 10
ISO_Z_SCALE = 1.0
DOT_RADIUS = 7

SESSION_TS = time.strftime("%Y%m%d_%H%M%S")

# ----------------------------
# THEME / COLORS
# ----------------------------
BG = (255, 255, 255)
PANEL_EDGE = (210, 210, 210)
PANEL_FILL = (255, 255, 255)
PANEL_TITLE_BG = (248, 248, 248)

GRID_LINE = (235, 235, 235)
AXIS = (90, 90, 90)

TEXT = (35, 35, 35)
SUBTEXT = (90, 90, 90)

TRAJ_BLUE = (0, 102, 204)
DISP_RED = (220, 0, 0)

DOT_BLUE = (0, 102, 204)
DOT_OUTLINE = (20, 20, 20)

# Metrics colors (as you asked)
METRIC_BLUE = (0, 102, 204)   # Distance
METRIC_RED = (220, 0, 0)      # Displacement
METRIC_GREEN = (0, 160, 80)   # Path Efficiency


# ----------------------------
# MISSIONS (EXACT FROM YOUR CODE)
# ----------------------------
MISSION_1_DETOUR = [(+1,0), (0,+1), (+1,0), (0,+1), (-2,0), (0,+1)]
MISSION_2_LOOP   = [(+1,0), (0,+2), (-1,0), (0,-2)]
MISSION_3_STRAIGHT = [(+2,0), (0,+1)]

MISSIONS = {
    1: [(dx, dy, 0) for (dx, dy) in MISSION_1_DETOUR],
    2: [(dx, dy, 0) for (dx, dy) in MISSION_2_LOOP],
    3: [(dx, dy, 0) for (dx, dy) in MISSION_3_STRAIGHT],
}

MISSION_NAMES = {
    1: "MISSION 1 (DETOUR / CONTOUR)",
    2: "MISSION 2 (LOOP / CLOSED)",
    3: "MISSION 3 (STRAIGHT)",
}


# ----------------------------
# STATE
# ----------------------------
@dataclass
class DroneState:
    # current animated position
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0

    # integer target grid position
    tx: int = 0
    ty: int = 0
    tz: int = 0

    flying: bool = False
    mission: str = "IDLE"
    t0: float = 0.0

    # continuous trail (x,y,z) for current mission / current session view
    trail: list = field(default_factory=list)


@dataclass
class MotionSegment:
    active: bool = False
    start: tuple = (0.0, 0.0, 0.0)
    end: tuple = (0.0, 0.0, 0.0)
    t_start: float = 0.0
    duration: float = STEP_DURATION


@dataclass
class MissionRunner:
    active: bool = False
    mission_id: int = 0
    steps: list = field(default_factory=list)
    idx: int = 0
    waiting_until: float = 0.0
    phase: str = "IDLE"      # "IDLE" | "GO_HOME" | "RUN"
    pending_manual: bool = False


# ----------------------------
# METRICS
# ----------------------------
def path_distance(trail):
    """Total path length in 3D along the trail points."""
    if len(trail) < 2:
        return 0.0
    dist = 0.0
    for i in range(1, len(trail)):
        x1, y1, z1 = trail[i - 1]
        x2, y2, z2 = trail[i]
        dist += math.sqrt((x2 - x1)**2 + (y2 - y1)**2 + (z2 - z1)**2)
    return dist

def displacement_3d(trail):
    """Straight-line displacement in 3D from start to end."""
    if len(trail) < 2:
        return 0.0
    x1, y1, z1 = trail[0]
    x2, y2, z2 = trail[-1]
    return math.sqrt((x2 - x1)**2 + (y2 - y1)**2 + (z2 - z1)**2)


# ----------------------------
# MOTION HELPERS
# ----------------------------
def clamp(v, a, b):
    return max(a, min(b, v))

def lerp(a, b, t):
    return a + (b - a) * t

def smoothstep(t):
    t = clamp(t, 0.0, 1.0)
    return t * t * (3 - 2 * t)

def start_motion(seg: MotionSegment, st: DroneState, end_xyz, duration=STEP_DURATION):
    seg.active = True
    seg.start = (st.x, st.y, st.z)
    seg.end = end_xyz
    seg.t_start = time.time()
    seg.duration = max(0.05, float(duration))

def update_motion(seg: MotionSegment, st: DroneState):
    if not seg.active:
        return False
    t = (time.time() - seg.t_start) / seg.duration
    if t >= 1.0:
        st.x, st.y, st.z = seg.end
        seg.active = False
        return True
    s = smoothstep(t)
    st.x = lerp(seg.start[0], seg.end[0], s)
    st.y = lerp(seg.start[1], seg.end[1], s)
    st.z = lerp(seg.start[2], seg.end[2], s)
    return False

def clear_trajectory(st: DroneState):
    st.trail.clear()

def set_target(st: DroneState, x, y, z):
    st.tx, st.ty, st.tz = int(x), int(y), int(z)

def next_step_target(st: DroneState, dx, dy, dz):
    st.tx += int(dx)
    st.ty += int(dy)
    st.tz = max(0, st.tz + int(dz))
    return (float(st.tx), float(st.ty), float(st.tz))


# ----------------------------
# SOUND (drone hum generated in code)
# ----------------------------
def build_drone_hum_sound(sample_rate=44100, seconds=1.2):
    """
    Loopable drone hum WAV in memory -> pygame.mixer.Sound.
    Plays only while moving.
    """
    n = int(sample_rate * seconds)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)   # 16-bit
        wf.setframerate(sample_rate)

        f1 = 140.0
        f2 = 280.0
        for i in range(n):
            t = i / sample_rate
            wobble = 1.0 + 0.06 * math.sin(2 * math.pi * 2.2 * t)
            s = (0.55 * math.sin(2 * math.pi * f1 * t) +
                 0.25 * math.sin(2 * math.pi * f2 * t)) * wobble
            v = int(clamp(s, -1.0, 1.0) * 13000)
            wf.writeframesraw(struct.pack("<h", v))

    return pygame.mixer.Sound(buffer=buf.getvalue())


# ----------------------------
# PLOT EXPORTS (PNG + GIF) into SAME folder as script
# ----------------------------
def _script_dir():
    try:
        return os.path.dirname(os.path.abspath(__file__))
    except Exception:
        return os.getcwd()

def _set_equal_3d(ax, X, Y, Z):
    X = X if len(X) else [0]
    Y = Y if len(Y) else [0]
    Z = Z if len(Z) else [0]
    xr = (max(X) - min(X)) if len(X) > 1 else 1.0
    yr = (max(Y) - min(Y)) if len(Y) > 1 else 1.0
    zr = (max(Z) - min(Z)) if len(Z) > 1 else 1.0
    maxr = max(xr, yr, zr, 1e-6)
    xmid = (max(X) + min(X)) / 2
    ymid = (max(Y) + min(Y)) / 2
    zmid = (max(Z) + min(Z)) / 2
    ax.set_xlim(xmid - maxr/2, xmid + maxr/2)
    ax.set_ylim(ymid - maxr/2, ymid + maxr/2)
    ax.set_zlim(zmid - maxr/2, zmid + maxr/2)

def save_xy_png(X, Y, title, outpath):
    plt.figure()
    plt.plot(X, Y, linewidth=2)  # default matplotlib blue
    plt.plot([X[0], X[-1]], [Y[0], Y[-1]], "r--", linewidth=2, label="Displacement")
    plt.scatter([X[0]], [Y[0]], s=30)
    plt.scatter([X[-1]], [Y[-1]], s=30)
    plt.gca().set_aspect("equal", adjustable="box")
    plt.title(title)
    plt.xlabel("X (m)")
    plt.ylabel("Y (m)")
    plt.grid(True, alpha=0.25)
    plt.legend()
    plt.tight_layout()
    plt.savefig(outpath, dpi=200)
    plt.close()

def save_3d_png(X, Y, Z, title, outpath):
    fig = plt.figure()
    ax = fig.add_subplot(111, projection="3d")
    ax.plot(X, Y, Z, linewidth=2)  # default blue
    ax.plot([X[0], X[-1]], [Y[0], Y[-1]], [Z[0], Z[-1]], "r--", linewidth=2, label="Displacement")
    ax.scatter([X[0]], [Y[0]], [Z[0]], s=30)
    ax.scatter([X[-1]], [Y[-1]], [Z[-1]], s=30)
    ax.set_title(title)
    ax.set_xlabel("X (m)")
    ax.set_ylabel("Y (m)")
    ax.set_zlabel("Z (m)")
    ax.legend()
    _set_equal_3d(ax, X, Y, Z)
    fig.tight_layout()
    plt.savefig(outpath, dpi=200)
    plt.close(fig)

def save_3d_gif(X, Y, Z, title, outpath_gif):
    X = np.array(X); Y = np.array(Y); Z = np.array(Z)
    fig = plt.figure()
    ax = fig.add_subplot(111, projection="3d")
    ax.set_title(title)
    ax.set_xlabel("X (m)")
    ax.set_ylabel("Y (m)")
    ax.set_zlabel("Z (m)")
    _set_equal_3d(ax, X.tolist(), Y.tolist(), Z.tolist())

    line, = ax.plot([], [], [], lw=2)
    disp, = ax.plot([X[0], X[-1]], [Y[0], Y[-1]], [Z[0], Z[-1]], "r--", lw=2)

    def init():
        line.set_data([], [])
        line.set_3d_properties([])
        return line, disp

    def update(i):
        line.set_data(X[:i+1], Y[:i+1])
        line.set_3d_properties(Z[:i+1])
        return line, disp

    ani = animation.FuncAnimation(fig, update, init_func=init, frames=len(X), interval=60, blit=True)
    from matplotlib.animation import PillowWriter
    ani.save(outpath_gif, writer=PillowWriter(fps=15))
    plt.close(fig)

def export_mission_outputs(mission_id: int, trail_points: list):
    """Writes 3 files per mission in the same folder as the .py."""
    if len(trail_points) < 2:
        return

    # downsample for manageable gif size
    step = max(1, len(trail_points) // 220)
    pts = trail_points[::step]

    X = [p[0] for p in pts]
    Y = [p[1] for p in pts]
    Z = [p[2] for p in pts]

    base = os.path.join(_script_dir(), f"mission{mission_id}_{SESSION_TS}")
    save_xy_png(X, Y, f"Top-Down XY — Mission {mission_id}", base + "_xy.png")
    save_3d_png(X, Y, Z, f"3D Trajectory — Mission {mission_id}", base + "_3d.png")
    save_3d_gif(X, Y, Z, f"3D Trajectory — Mission {mission_id}", base + "_3d_anim.gif")


# ----------------------------
# PYGAME DRAWING
# ----------------------------
def draw_dotted_line(surface, color, start, end, dot_len=8, gap_len=7, width=3):
    x1, y1 = start
    x2, y2 = end
    dx = x2 - x1
    dy = y2 - y1
    dist = math.hypot(dx, dy)
    if dist <= 0.5:
        return
    ux = dx / dist
    uy = dy / dist
    step = dot_len + gap_len
    n = int(dist // step) + 1
    for i in range(n):
        a = i * step
        b = min(a + dot_len, dist)
        sx = x1 + ux * a
        sy = y1 + uy * a
        ex = x1 + ux * b
        ey = y1 + uy * b
        pygame.draw.line(surface, color, (sx, sy), (ex, ey), width)

def compute_iso_scale(rect):
    return max(18, int(min(rect.w, rect.h) * 0.090))

def project_3d_iso(x, y, z, scale):
    px = (x - y) * scale
    py = (x + y) * scale * 0.5 - (z * ISO_Z_SCALE) * scale
    return px, py

def draw_3d_clean(surface, rect, st: DroneState):
    cx = rect.centerx
    cy = rect.centery
    scale = compute_iso_scale(rect)

    xs = range(-GRID_XY_RANGE, GRID_XY_RANGE + 1)
    ys = range(-GRID_XY_RANGE, GRID_XY_RANGE + 1)

    # XY grid at z=0
    for y in ys:
        p1 = project_3d_iso(-GRID_XY_RANGE, y, 0, scale)
        p2 = project_3d_iso( GRID_XY_RANGE, y, 0, scale)
        pygame.draw.line(surface, GRID_LINE, (cx+p1[0], cy+p1[1]), (cx+p2[0], cy+p2[1]), 1)

    for x in xs:
        p1 = project_3d_iso(x, -GRID_XY_RANGE, 0, scale)
        p2 = project_3d_iso(x,  GRID_XY_RANGE, 0, scale)
        pygame.draw.line(surface, GRID_LINE, (cx+p1[0], cy+p1[1]), (cx+p2[0], cy+p2[1]), 1)

    # Axes
    o  = project_3d_iso(0, 0, 0, scale)
    xA = project_3d_iso(GRID_XY_RANGE, 0, 0, scale)
    yA = project_3d_iso(0, GRID_XY_RANGE, 0, scale)
    zA = project_3d_iso(0, 0, 7, scale)

    pygame.draw.line(surface, AXIS, (cx+o[0], cy+o[1]), (cx+xA[0], cy+xA[1]), 3)
    pygame.draw.line(surface, AXIS, (cx+o[0], cy+o[1]), (cx+yA[0], cy+yA[1]), 3)
    pygame.draw.line(surface, AXIS, (cx+o[0], cy+o[1]), (cx+zA[0], cy+zA[1]), 3)

    # Path + displacement
    if len(st.trail) >= 2:
        pts = []
        for (x, y, z) in st.trail[-TRAIL_MAX_POINTS:]:
            p = project_3d_iso(x, y, z, scale)
            pts.append((cx+p[0], cy+p[1]))
        if len(pts) >= 2:
            pygame.draw.lines(surface, TRAJ_BLUE, False, pts, 3)
            draw_dotted_line(surface, DISP_RED, pts[0], pts[-1], dot_len=8, gap_len=7, width=3)

    # Drone point + drop line
    p  = project_3d_iso(st.x, st.y, st.z, scale)
    p0 = project_3d_iso(st.x, st.y, 0, scale)
    pygame.draw.line(surface, (170,170,170), (cx+p[0], cy+p[1]), (cx+p0[0], cy+p0[1]), 1)

    pygame.draw.circle(surface, DOT_BLUE, (int(cx+p[0]), int(cy+p[1])), DOT_RADIUS)
    pygame.draw.circle(surface, DOT_OUTLINE, (int(cx+p[0]), int(cy+p[1])), DOT_RADIUS, 2)


# ----------------------------
# PROFESSIONAL PANEL LAYOUT (NO OVERLAP)
# ----------------------------
def draw_panel_frame(surface, rect, title, title_font):
    pygame.draw.rect(surface, PANEL_FILL, rect, border_radius=14)
    pygame.draw.rect(surface, PANEL_EDGE, rect, 1, border_radius=14)

    title_h = 44
    title_rect = pygame.Rect(rect.x, rect.y, rect.w, title_h)
    pygame.draw.rect(surface, PANEL_TITLE_BG, title_rect, border_radius=14)
    pygame.draw.line(surface, PANEL_EDGE, (rect.x, rect.y + title_h), (rect.right, rect.y + title_h), 1)

    t = title_font.render(title, True, TEXT)
    surface.blit(t, (rect.x + 14, rect.y + 10))

    content = pygame.Rect(rect.x + 14, rect.y + title_h + 12, rect.w - 28, rect.h - title_h - 24)
    return content

def safe_blit_lines(surface, content_rect, font, lines):
    x = content_rect.x
    y = content_rect.y
    line_h = font.get_height() + 6
    bottom = content_rect.bottom

    for text, color, is_divider in lines:
        if y + line_h > bottom:
            break
        if is_divider:
            pygame.draw.line(surface, PANEL_EDGE, (x, y + 6), (content_rect.right, y + 6), 1)
            y += line_h
        else:
            surface.blit(font.render(text, True, color), (x, y))
            y += line_h

def fit_fonts(screen_h):
    title = max(20, screen_h // 44)
    body = max(15, screen_h // 62)
    return title, body


# ----------------------------
# MISSION CONTROL (HOME FIRST)
# ----------------------------
def begin_go_home(runner: MissionRunner, st: DroneState, seg: MotionSegment, label_after_home: str):
    runner.phase = "GO_HOME"
    st.mission = f"GOING HOME → {label_after_home}"
    set_target(st, HOME[0], HOME[1], HOME[2])
    clear_trajectory(st)
    start_motion(seg, st, (float(st.tx), float(st.ty), float(st.tz)), duration=0.9)

def start_auto_mission_from_home(runner: MissionRunner, st: DroneState, mission_id: int):
    runner.active = True
    runner.mission_id = mission_id
    runner.steps = list(MISSIONS[mission_id])
    runner.idx = 0
    runner.waiting_until = 0.0
    runner.phase = "RUN"
    runner.pending_manual = False

    st.mission = MISSION_NAMES.get(mission_id, f"MISSION {mission_id} (AUTO)")
    set_target(st, HOME[0], HOME[1], HOME[2])
    st.x, st.y, st.z = float(st.tx), float(st.ty), float(st.tz)
    clear_trajectory(st)

def start_manual_from_home(runner: MissionRunner, st: DroneState):
    runner.active = False
    runner.phase = "RUN"
    runner.pending_manual = True
    st.mission = "MISSION 4 (MANUAL)"
    set_target(st, HOME[0], HOME[1], HOME[2])
    st.x, st.y, st.z = float(st.tx), float(st.ty), float(st.tz)
    clear_trajectory(st)

def update_autorun(runner: MissionRunner, st: DroneState, seg: MotionSegment):
    if runner.phase == "GO_HOME":
        if not seg.active:
            if runner.pending_manual:
                start_manual_from_home(runner, st)
            elif runner.mission_id in MISSIONS:
                start_auto_mission_from_home(runner, st, runner.mission_id)
            else:
                runner.phase = "IDLE"
        return

    if not runner.active:
        return
    if seg.active:
        return

    now = time.time()
    if runner.waiting_until and now < runner.waiting_until:
        return

    if runner.idx >= len(runner.steps):
        runner.active = False
        st.mission = f"{st.mission} — DONE"
        return

    dx, dy, dz = runner.steps[runner.idx]
    runner.idx += 1

    end_xyz = next_step_target(st, dx, dy, dz)
    start_motion(seg, st, end_xyz, duration=STEP_DURATION)
    runner.waiting_until = time.time() + STEP_DURATION + STEP_PAUSE


# ----------------------------
# MAIN
# ----------------------------
def main():
    pygame.init()

    # sound init
    drone_sound = None
    drone_channel = None
    try:
        pygame.mixer.init(frequency=44100, size=-16, channels=1, buffer=512)
        drone_sound = build_drone_hum_sound()
        drone_sound.set_volume(0.35)
        drone_channel = pygame.mixer.Channel(0)
    except Exception:
        drone_sound = None
        drone_channel = None

    screen = pygame.display.set_mode((0, 0), pygame.FULLSCREEN)
    clock = pygame.time.Clock()

    W, H = screen.get_size()
    title_size, body_size = fit_fonts(H)
    title_font = pygame.font.SysFont("consolas", title_size, bold=True)
    body_font = pygame.font.SysFont("consolas", body_size)

    # layout
    M = 18
    hud_w = int(W * 0.28)
    hud_rect = pygame.Rect(M, M, hud_w, H - 2*M)
    plot_rect = pygame.Rect(hud_rect.right + M, M, W - hud_rect.width - 3*M, H - 2*M)

    st = DroneState()
    seg = MotionSegment()
    runner = MissionRunner()

    # for exporting exactly once per mission
    exporting_mission_id = None
    exported_done_flag = False

    def hard_reset():
        nonlocal exporting_mission_id, exported_done_flag
        st.x = st.y = st.z = 0.0
        set_target(st, 0, 0, 0)
        clear_trajectory(st)
        st.flying = False
        st.mission = "IDLE"
        st.t0 = 0.0
        seg.active = False
        runner.active = False
        runner.phase = "IDLE"
        runner.mission_id = 0
        runner.pending_manual = False
        exporting_mission_id = None
        exported_done_flag = False

    hard_reset()

    def should_play_sound():
        moving = seg.active or runner.phase == "GO_HOME" or runner.active
        return st.flying and moving

    running = True
    while running:
        clock.tick(FPS)

        update_motion(seg, st)

        # record trail for current view (and for exports per mission)
        st.trail.append((st.x, st.y, st.z))
        if len(st.trail) > TRAIL_MAX_POINTS:
            st.trail = st.trail[-TRAIL_MAX_POINTS:]

        update_autorun(runner, st, seg)

        # sound control
        if drone_sound and drone_channel:
            if should_play_sound():
                if not drone_channel.get_busy():
                    drone_channel.play(drone_sound, loops=-1)
            else:
                if drone_channel.get_busy():
                    drone_channel.stop()

        # metrics
        dist = path_distance(st.trail)
        disp = displacement_3d(st.trail)
        pe = (disp / dist) if dist > 1e-9 else 0.0
        elapsed = (time.time() - st.t0) if st.t0 else 0.0

        # export on mission completion (missions 1-3 only)
        if exporting_mission_id in (1, 2, 3) and ("— DONE" in st.mission) and (not exported_done_flag):
            export_mission_outputs(exporting_mission_id, st.trail)
            exported_done_flag = True  # prevent duplicate exports

        # draw background
        screen.fill(BG)

        # HUD
        hud_content = draw_panel_frame(screen, hud_rect, "HUD", title_font)
        hud_lines = [
            ("STATUS", SUBTEXT, False),
            ("", TEXT, True),
            (f"Mode: {st.mission}", TEXT, False),
            (f"Flying: {'YES' if st.flying else 'NO'}", TEXT, False),
            (f"Time: {elapsed:.1f}s", TEXT, False),

            ("", TEXT, True),
            ("POSITION", SUBTEXT, False),
            ("", TEXT, True),
            (f"X, Y, Z: {st.x:.2f}, {st.y:.2f}, {st.z:.2f}", TEXT, False),
            (f"Target: ({st.tx}, {st.ty}, {st.tz})", TEXT, False),
            (f"Home:   {HOME}", TEXT, False),

            ("", TEXT, True),
            ("METRICS", SUBTEXT, False),
            ("", TEXT, True),
            (f"Distance: {dist:.2f} m", METRIC_BLUE, False),
            (f"Displacement: {disp:.2f} m", METRIC_RED, False),
            (f"Path Efficiency: {pe:.2f}", METRIC_GREEN, False),

            ("", TEXT, True),
            ("CONTROLS", SUBTEXT, False),
            ("", TEXT, True),
            ("T: Takeoff   L: Land", TEXT, False),
            ("1/2/3: Missions   4: Manual", TEXT, False),
            ("Arrows: XY   PgUp/PgDn: Z", TEXT, False),
            ("R: Reset   ESC: Exit", TEXT, False),
        ]
        safe_blit_lines(screen, hud_content, body_font, hud_lines)

        # PLOT panel
        plot_content = draw_panel_frame(screen, plot_rect, "3D Plot (Blue Path, Red Dotted Displacement)", title_font)

        # clip plot drawing to plot area (hard separation)
        old_clip = screen.get_clip()
        screen.set_clip(plot_content)
        draw_3d_clean(screen, plot_content, st)
        screen.set_clip(old_clip)

        pygame.display.flip()

        # events
        for e in pygame.event.get():
            if e.type == pygame.QUIT:
                running = False

            elif e.type == pygame.KEYDOWN:
                if e.key == pygame.K_ESCAPE:
                    running = False

                elif e.key == pygame.K_r:
                    hard_reset()

                elif e.key == pygame.K_t:
                    if not st.flying and not seg.active:
                        st.flying = True
                        st.t0 = time.time() if not st.t0 else st.t0
                        st.mission = "TAKEOFF"
                        set_target(st, HOME[0], HOME[1], HOME[2])
                        clear_trajectory(st)
                        exporting_mission_id = None
                        exported_done_flag = False
                        start_motion(seg, st, (float(st.tx), float(st.ty), float(st.tz)), duration=1.0)

                elif e.key == pygame.K_l:
                    if st.flying and not seg.active:
                        runner.active = False
                        runner.phase = "IDLE"
                        st.mission = "LANDING"
                        st.tz = 0
                        start_motion(seg, st, (float(st.tx), float(st.ty), float(st.tz)), duration=1.0)
                        st.flying = False
                        exporting_mission_id = None
                        exported_done_flag = False

                # Missions 1-3: always start from home, clear trail, export at end
                elif e.key in (pygame.K_1, pygame.K_2, pygame.K_3):
                    if st.flying and not seg.active:
                        m_id = int(e.unicode)
                        if m_id in MISSIONS:
                            runner.active = False
                            runner.mission_id = m_id
                            runner.pending_manual = False
                            exporting_mission_id = m_id
                            exported_done_flag = False
                            begin_go_home(runner, st, seg, MISSION_NAMES.get(m_id, f"MISSION {m_id}"))

                # Manual mission 4: home-start, clear trail (no exports required)
                elif e.key == pygame.K_4:
                    if st.flying and not seg.active:
                        runner.active = False
                        runner.mission_id = 0
                        runner.pending_manual = True
                        exporting_mission_id = None
                        exported_done_flag = False
                        begin_go_home(runner, st, seg, "MISSION 4 (MANUAL)")

                # Manual movement
                elif st.mission == "MISSION 4 (MANUAL)" and st.flying and (not seg.active) and (not runner.active):
                    dx = dy = dz = 0
                    if e.key == pygame.K_LEFT:  dx = -1
                    if e.key == pygame.K_RIGHT: dx = 1
                    if e.key == pygame.K_UP:    dy = 1
                    if e.key == pygame.K_DOWN:  dy = -1
                    if e.key == pygame.K_PAGEUP:   dz = 1
                    if e.key == pygame.K_PAGEDOWN: dz = -1

                    if dx or dy or dz:
                        end_xyz = next_step_target(st, dx, dy, dz)
                        start_motion(seg, st, end_xyz, duration=STEP_DURATION)

        # normalize landing label
        if not st.flying and not seg.active and st.z <= 0.0001 and st.tz == 0 and st.mission == "LANDING":
            st.z = 0.0
            st.mission = "LANDED"

    try:
        if drone_channel and drone_channel.get_busy():
            drone_channel.stop()
    except Exception:
        pass

    pygame.quit()


if __name__ == "__main__":
    main()
