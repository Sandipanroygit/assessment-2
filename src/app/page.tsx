"use client";

/* eslint-disable react/no-unescaped-entities */

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import heroSlide1 from "../../image/image1.jpg";
import heroSlide2 from "../../image/image2.jpg";
import heroSlide3 from "../../image/image3.jpg";
import logo from "../../image/logo.jpg";
import eagleAssistant from "../../eagle/eagle.png";
import indusTrustLogo from "../../eagle/Indus Trust.jpeg";
import nasaPromo from "../../eagle/nasa.gif";
import CollaborateButton from "@/components/CollaborateButton";
import { enrichSteamhProjectWithSampleDetails, sampleSteamhProjects } from "@/data/sampleSteamhProjects";
import { buildProjectCollabPath } from "@/lib/steamhCollaboration";
import { supabase } from "@/lib/supabaseClient";
import { fetchSteamhProjects } from "@/lib/steamhProjects";
import { playUiClickTone, primeUiTone } from "@/lib/uiTone";
import type { SteamhProject } from "@/types";

const features = [
  {
    title: "Drone Flight Training",
    description:
      "Students learn by planning, flying, and reviewing real drone missions with structured safety and flight workflows.",
    focus: "Drone",
    imageSrc: "/features/cards/drone-mission.png",
    imageAlt: "Students planning and reviewing drone mission work",
  },
  {
    title: "VR Immersive Lessons",
    description:
      "VR modules turn abstract topics into interactive environments where learners explore concepts through guided simulation.",
    focus: "VR Learning",
    imageSrc: "/features/cards/vr-immersive.png",
    imageAlt: "Student learning with VR headset in a classroom setting",
  },
  {
    title: "STEAM Project Learning",
    description:
      "Interdisciplinary STEAM project tracks help students build, test, document, and present portfolio-ready outcomes.",
    focus: "STEAM Projects",
    imageSrc: "/features/cards/steamh-project-studio.png",
    imageAlt: "Students collaborating on STEAM project work using laptops",
  },
  {
    title: "Build-to-Learn Labs",
    description:
      "Stepwise labs connect theory to action using hardware kits, coding tasks, and collaborative maker challenges.",
    focus: "Lab Practice",
    imageSrc: "/features/cards/build-to-learn-labs.png",
    imageAlt: "Students building hands-on electronics and maker lab prototypes",
  },
  {
    title: "Board & Grade Flexibility",
    description:
      "Curriculum flows can be adapted by board, grade, and learner level for schools with mixed academic pathways.",
    focus: "Curriculum",
    imageSrc: "/features/cards/board-grade-flexibility.png",
    imageAlt: "Mixed student group in collaborative class learning session",
  },
  {
    title: "Assessment to Showcase",
    description:
      "From classroom assessment to project showcase, students track growth and publish work in a visible learning journey.",
    focus: "Assessment",
    imageSrc: "/features/cards/assessment-showcase.png",
    imageAlt: "Student documenting project outcomes on a laptop screen",
  },
];


const testimonials = [
  {
    name: "Aditi, STEM Coordinator",
    school: "Delhi Public School",
    quote:
      "Students shipped their first drone mission in 3 weeks. The ready-to-teach flow saved our team countless hours.",
  },
  {
    name: "Mr. Johnson, Principal",
    school: "Greenfield Academy",
    quote:
      "The immersive modules help us pitch innovation to parents-and the analytics help me see real engagement.",
  },
  {
    name: "Ravi, Robotics Lead",
    school: "Springfield High",
    quote:
      "Procurement is seamless. We bundle curriculum, drone kits, and hands-on learning tools in one checkout.",
  },
];


const heroSlides = [heroSlide1, heroSlide2, heroSlide3];

const productHighlights = [
  {
    name: "Classroom Drone Kit",
    price: "Rs 24,999",
    note: "Includes spare rotors, batteries, and STEM challenges.",
  },
  {
    name: "Hands-on Starter Pack",
    price: "Rs 18,499",
    note: "Headsets, controllers, and classroom-ready onboarding.",
  },
];

const boardLogos = [
  { label: "IB", src: "/boards/ib.png" },
  { label: "CBSE", src: "/boards/cbse.png" },
  { label: "ICSE", src: "/boards/cisce.png", imageClassName: "h-14 w-14 object-contain" },
  { label: "Cambridge", src: "/boards/cambridge.png", imageClassName: "h-8 w-8 object-contain" },
];

const isStudentLikeRole = (role: string | null) => {
  const normalized = (role ?? "").trim().toLowerCase();
  return normalized === "student" || normalized === "customer";
};

const resolveProjectCover = (project: SteamhProject) => {
  return project.imageUrls[0] ?? "";
};

const HOMEPAGE_SHOWCASE_TITLE_KEYS = [
  "strobegoggles",
  "boombucket",
  "musicyoucansee",
  "windtube",
  "growbacteria",
  "circuittiles",
];

const toProjectTitleKey = (title: string) => title.toLowerCase().replace(/[^a-z0-9]/g, "");

const resolveHomepageShowcaseProjects = (primary: SteamhProject[], fallback: SteamhProject[]) => {
  const result: SteamhProject[] = [];
  const usedIds = new Set<string>();

  for (const titleKey of HOMEPAGE_SHOWCASE_TITLE_KEYS) {
    const primaryMatch = primary.find(
      (project) => !usedIds.has(project.id) && toProjectTitleKey(project.title).includes(titleKey),
    );

    if (primaryMatch) {
      result.push(primaryMatch);
      usedIds.add(primaryMatch.id);
      continue;
    }

    const fallbackMatch = fallback.find(
      (project) => !usedIds.has(project.id) && toProjectTitleKey(project.title).includes(titleKey),
    );

    if (fallbackMatch) {
      result.push(fallbackMatch);
      usedIds.add(fallbackMatch.id);
    }
  }

  return result;
};

const TEACHER_HOME_TOUR_ENTRY_KEY = "teacher_home_tour_entry_pending_v1";
const TEACHER_TOUR_STORAGE_KEY = "teacher_feature_tour_v2";
const TEACHER_PROGRESS_TOUR_FORCE_KEY = "teacher_progress_tour_force_once_v2";
const TEACHER_PROGRESS_TOUR_CHAIN_KEY = "teacher_progress_tour_chain_meta_v2";
const TEACHER_STUDENTS_TOUR_FORCE_KEY = "teacher_students_tour_force_once_v2";
const TEACHER_STUDENTS_TOUR_CHAIN_KEY = "teacher_students_tour_chain_meta_v2";
const TEACHER_DASHBOARD_TOUR_RESUME_KEY = "teacher_dashboard_tour_resume_v2";
const TEACHER_TOUR_AUTOSTART_KEY = "teacher_dashboard_tour_autostart_v1";
const FAQ_TAB_HEIGHT = 96;
const FAQ_TAB_MARGIN = 8;
const FAQ_TAB_DEFAULT_RAISE = 40;
const FAQ_TAB_DRAG_THRESHOLD = 6;
const EAGLE_BUBBLE_DEFAULT_TOP = -1;
const EAGLE_BUBBLE_DEFAULT_RIGHT = 105;
const EAGLE_BUBBLE_MIN_TOP = -20;
const EAGLE_BUBBLE_MAX_TOP = 96;
const EAGLE_BUBBLE_MIN_RIGHT = 8;
const EAGLE_BUBBLE_MAX_RIGHT = 260;
const EAGLE_BUBBLE_DRAG_THRESHOLD = 6;
const EAGLE_BUBBLE_DRAG_ENABLED = false;
const EAGLE_BUBBLE_STORAGE_KEY = "homepage_eagle_bubble_position_v1";
const EAGLE_WIDGET_DEFAULT_BOTTOM = 80;
const EAGLE_WIDGET_DEFAULT_RIGHT = 24;
const EAGLE_WIDGET_MARGIN = 8;
const EAGLE_WIDGET_SIZE = 160;
const EAGLE_WIDGET_DRAG_THRESHOLD = 6;
const EAGLE_WIDGET_DRAG_ENABLED = false;
const EAGLE_WIDGET_STORAGE_KEY = "homepage_eagle_widget_position_v1";
const NASA_PROMO_EDIT_MODE_ENABLED = false;
const NASA_PROMO_STORAGE_KEY = "homepage_nasa_promo_layout_v1";
const NASA_PROMO_DEFAULT_WIDTH = 170;
const NASA_PROMO_MIN_WIDTH = 100;
const NASA_PROMO_MAX_WIDTH = 620;
const NASA_PROMO_MIN_X = -220;
const NASA_PROMO_MAX_X = 520;
const NASA_PROMO_MIN_Y = -70;
const NASA_PROMO_MAX_Y = 150;
const NASA_PROMO_DRAG_THRESHOLD = 4;
const NASA_PROMO_DEFAULT_SCALE = 1;
const NASA_PROMO_MIN_SCALE = 1;
const NASA_PROMO_MAX_SCALE = 2.4;
const HOME_BLOCK_TWO_SNAP_OFFSET = -290;
const CARD2_CENTER_SNAP_THRESHOLD = 10;
const CARD2_EDIT_MODE_ENABLED = false;
const CARD2_VIEWPORT_REFERENCE_WIDTH = 1440;
const CARD2_VIEWPORT_MIN_SCALE = 0.74;
const CARD4_LAYOUT_STORAGE_KEY = "homepage_block4_layout_offsets_v1";
const CARD4_CENTER_SNAP_THRESHOLD = 10;
const CARD4_EDIT_MODE_ENABLED = false;
const FOOTER_FILL_STORAGE_KEY = "homepage_footer_fill_extra_v1";
const FOOTER_FILL_MIN = 0;
const FOOTER_FILL_MAX = 640;
const FOOTER_FILL_DRAG_THRESHOLD = 4;
const FOOTER_FILL_DRAG_ENABLED = false;
const INDUS_LOGO_STORAGE_KEY = "homepage_indus_logo_position_v2";
const INDUS_LOGO_DRAG_ENABLED = false;
const INDUS_LOGO_DRAG_THRESHOLD = 4;
const INDUS_LOGO_DEFAULT_X = -18;
const INDUS_LOGO_DEFAULT_Y = 6;
const INDUS_LOGO_MIN_X = -220;
const INDUS_LOGO_MAX_X = 24;
const INDUS_LOGO_MIN_Y = -10;
const INDUS_LOGO_MAX_Y = 180;

type Card2ElementId = "header" | "content";

type Card4ElementId = "testimonials" | "bundles" | "footer";

type NasaPromoLayout = {
  x: number;
  y: number;
  width: number;
  cropScale: number;
  cropX: number;
  cropY: number;
};

const NASA_PROMO_LOCKED_LAYOUT: NasaPromoLayout = {
  x: 0,
  y: 0,
  width: NASA_PROMO_DEFAULT_WIDTH,
  cropScale: NASA_PROMO_DEFAULT_SCALE,
  cropX: 0,
  cropY: 0,
};

const CARD2_LOCKED_OFFSETS: Record<Card2ElementId, { x: number; y: number }> = {
  header: { x: 0, y: -214 },
  content: { x: 0, y: -180 },
};

const resolveCard2OffsetsForViewport = (viewportWidth: number): Record<Card2ElementId, { x: number; y: number }> => {
  const scale = Math.min(1, Math.max(CARD2_VIEWPORT_MIN_SCALE, viewportWidth / CARD2_VIEWPORT_REFERENCE_WIDTH));

  return {
    header: {
      x: Math.round(CARD2_LOCKED_OFFSETS.header.x * scale),
      y: Math.round(CARD2_LOCKED_OFFSETS.header.y * scale),
    },
    content: {
      x: Math.round(CARD2_LOCKED_OFFSETS.content.x * scale),
      y: Math.round(CARD2_LOCKED_OFFSETS.content.y * scale),
    },
  };
};

const CARD4_DEFAULT_OFFSETS: Record<Card4ElementId, { x: number; y: number }> = {
  testimonials: { x: 0, y: 0 },
  bundles: { x: 0, y: 0 },
  footer: { x: 0, y: 0 },
};

const clampFaqTabTop = (top: number, viewportHeight: number) => {
  const maxTop = Math.max(FAQ_TAB_MARGIN, viewportHeight - FAQ_TAB_HEIGHT - FAQ_TAB_MARGIN);
  return Math.min(maxTop, Math.max(FAQ_TAB_MARGIN, top));
};

const clampEagleBubblePosition = (position: { top: number; right: number }) => {
  return {
    top: Math.min(EAGLE_BUBBLE_MAX_TOP, Math.max(EAGLE_BUBBLE_MIN_TOP, position.top)),
    right: Math.min(EAGLE_BUBBLE_MAX_RIGHT, Math.max(EAGLE_BUBBLE_MIN_RIGHT, position.right)),
  };
};

const clampEagleWidgetPosition = (
  position: { bottom: number; right: number },
  viewportWidth: number,
  viewportHeight: number,
) => {
  const maxRight = Math.max(EAGLE_WIDGET_MARGIN, viewportWidth - EAGLE_WIDGET_SIZE - EAGLE_WIDGET_MARGIN);
  const maxBottom = Math.max(EAGLE_WIDGET_MARGIN, viewportHeight - EAGLE_WIDGET_SIZE - EAGLE_WIDGET_MARGIN);

  return {
    bottom: Math.min(maxBottom, Math.max(EAGLE_WIDGET_MARGIN, position.bottom)),
    right: Math.min(maxRight, Math.max(EAGLE_WIDGET_MARGIN, position.right)),
  };
};

const clampFooterFill = (value: number) => {
  return Math.min(FOOTER_FILL_MAX, Math.max(FOOTER_FILL_MIN, Math.round(value)));
};

const clampIndusLogoPosition = (position: { x: number; y: number }) => {
  return {
    x: Math.min(INDUS_LOGO_MAX_X, Math.max(INDUS_LOGO_MIN_X, Math.round(position.x))),
    y: Math.min(INDUS_LOGO_MAX_Y, Math.max(INDUS_LOGO_MIN_Y, Math.round(position.y))),
  };
};

const getNasaPromoCropLimits = (width: number, cropScale: number) => {
  const overflowFactor = Math.max(0, cropScale - 1);
  return {
    x: Math.max(0, Math.round((width * overflowFactor) / 2)),
    y: Math.max(0, Math.round((Math.max(1, width * 0.32) * overflowFactor) / 2)),
  };
};

const clampNasaPromoLayout = (layout: NasaPromoLayout): NasaPromoLayout => {
  const width = Math.min(NASA_PROMO_MAX_WIDTH, Math.max(NASA_PROMO_MIN_WIDTH, Math.round(layout.width)));
  const cropScale = Math.min(
    NASA_PROMO_MAX_SCALE,
    Math.max(NASA_PROMO_MIN_SCALE, Math.round(layout.cropScale * 100) / 100),
  );
  const cropLimits = getNasaPromoCropLimits(width, cropScale);

  return {
    x: Math.min(NASA_PROMO_MAX_X, Math.max(NASA_PROMO_MIN_X, Math.round(layout.x))),
    y: Math.min(NASA_PROMO_MAX_Y, Math.max(NASA_PROMO_MIN_Y, Math.round(layout.y))),
    width,
    cropScale,
    cropX: Math.min(cropLimits.x, Math.max(-cropLimits.x, Math.round(layout.cropX))),
    cropY: Math.min(cropLimits.y, Math.max(-cropLimits.y, Math.round(layout.cropY))),
  };
};

export default function Home() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [isAuthed, setIsAuthed] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const defaultAdminEmail = process.env.NEXT_PUBLIC_DEFAULT_ADMIN_EMAIL?.toLowerCase?.() ?? "";
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    {
      role: "assistant",
      content: "Hi! Ask me about the curriculum dashboard, shopping page, or how to get started.",
    },
  ]);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    school: "",
    message: "",
  });
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [faqOpen, setFaqOpen] = useState(false);
  const [faqTabTop, setFaqTabTop] = useState<number | null>(null);
  const [eagleSpeechReady, setEagleSpeechReady] = useState(false);
  const [eagleBubblePosition, setEagleBubblePosition] = useState<{ top: number; right: number }>({
    top: EAGLE_BUBBLE_DEFAULT_TOP,
    right: EAGLE_BUBBLE_DEFAULT_RIGHT,
  });
  const [eagleWidgetPosition, setEagleWidgetPosition] = useState<{ bottom: number; right: number }>({
    bottom: EAGLE_WIDGET_DEFAULT_BOTTOM,
    right: EAGLE_WIDGET_DEFAULT_RIGHT,
  });
  const [eagleWidgetReady, setEagleWidgetReady] = useState(false);
  const [eagleWidgetDismissed, setEagleWidgetDismissed] = useState(false);
  const [eagleWidgetCollapsedByScroll, setEagleWidgetCollapsedByScroll] = useState(false);
  const [nasaPromoEditMode] = useState(NASA_PROMO_EDIT_MODE_ENABLED);
  const [nasaPromoLayout, setNasaPromoLayout] = useState<NasaPromoLayout>(() =>
    clampNasaPromoLayout(NASA_PROMO_LOCKED_LAYOUT),
  );
  const faqTabDragRef = useRef<{ pointerId: number | null; startY: number; startTop: number; moved: boolean }>({
    pointerId: null,
    startY: 0,
    startTop: 0,
    moved: false,
  });
  const nasaPromoDragRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
    moved: boolean;
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    moved: false,
  });
  const nasaPromoResizeRef = useRef<{
    pointerId: number | null;
    startX: number;
    startWidth: number;
    moved: boolean;
  }>({
    pointerId: null,
    startX: 0,
    startWidth: NASA_PROMO_DEFAULT_WIDTH,
    moved: false,
  });
  const nasaPromoCropDragRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    startCropX: number;
    startCropY: number;
    moved: boolean;
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    startCropX: 0,
    startCropY: 0,
    moved: false,
  });
  const nasaPromoSuppressClickRef = useRef(false);
  const eagleBubbleDragRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    startTop: number;
    startRight: number;
    moved: boolean;
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    startTop: 0,
    startRight: 0,
    moved: false,
  });
  const eagleWidgetDragRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    startBottom: number;
    startRight: number;
    moved: boolean;
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    startBottom: 0,
    startRight: 0,
    moved: false,
  });
  const suppressFaqClickRef = useRef(false);
  const suppressEagleClickRef = useRef(false);
  const blockTwoAlignTimerRef = useRef<number | null>(null);
  const card2ContainerRef = useRef<HTMLDivElement | null>(null);
  const card2ItemRefs = useRef<Record<Card2ElementId, HTMLDivElement | null>>({
    header: null,
    content: null,
  });
  const card2DragRef = useRef<{
    id: Card2ElementId | null;
    pointerId: number | null;
    startClientX: number;
    startClientY: number;
    startOffsetX: number;
    startOffsetY: number;
    startCenterX: number;
    startCenterY: number;
    containerCenterX: number;
    containerCenterY: number;
    moved: boolean;
  }>({
    id: null,
    pointerId: null,
    startClientX: 0,
    startClientY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    startCenterX: 0,
    startCenterY: 0,
    containerCenterX: 0,
    containerCenterY: 0,
    moved: false,
  });
  const [card2EditMode] = useState(CARD2_EDIT_MODE_ENABLED);
  const [card2GuideState, setCard2GuideState] = useState({ vertical: false, horizontal: false });
  const [card2ActiveElement, setCard2ActiveElement] = useState<Card2ElementId | null>(null);
  const [card2Offsets, setCard2Offsets] =
    useState<Record<Card2ElementId, { x: number; y: number }>>(CARD2_LOCKED_OFFSETS);
  const card4ContainerRef = useRef<HTMLDivElement | null>(null);
  const card4ItemRefs = useRef<Record<Card4ElementId, HTMLDivElement | null>>({
    testimonials: null,
    bundles: null,
    footer: null,
  });
  const card4DragRef = useRef<{
    id: Card4ElementId | null;
    pointerId: number | null;
    startClientX: number;
    startClientY: number;
    startOffsetX: number;
    startOffsetY: number;
    startCenterX: number;
    startCenterY: number;
    containerCenterX: number;
    containerCenterY: number;
    moved: boolean;
  }>({
    id: null,
    pointerId: null,
    startClientX: 0,
    startClientY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    startCenterX: 0,
    startCenterY: 0,
    containerCenterX: 0,
    containerCenterY: 0,
    moved: false,
  });
  const [card4EditMode] = useState(CARD4_EDIT_MODE_ENABLED);
  const [card4GuideState, setCard4GuideState] = useState({ vertical: false, horizontal: false });
  const [card4ActiveElement, setCard4ActiveElement] = useState<Card4ElementId | null>(null);
  const [card4Offsets, setCard4Offsets] =
    useState<Record<Card4ElementId, { x: number; y: number }>>(CARD4_DEFAULT_OFFSETS);
  const [footerFillExtra, setFooterFillExtra] = useState(0);
  const footerFillDragRef = useRef<{
    pointerId: number | null;
    startY: number;
    startValue: number;
    moved: boolean;
  }>({
    pointerId: null,
    startY: 0,
    startValue: 0,
    moved: false,
  });
  const [indusLogoPosition, setIndusLogoPosition] = useState<{ x: number; y: number }>({
    x: INDUS_LOGO_DEFAULT_X,
    y: INDUS_LOGO_DEFAULT_Y,
  });
  const indusLogoDragRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
    moved: boolean;
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    moved: false,
  });
  const [footerExpanded, setFooterExpanded] = useState<"about" | "contact" | "privacy" | "terms" | null>(null);
  const [footfall, setFootfall] = useState<number | null>(null);
  const [footfallSpin, setFootfallSpin] = useState(0);
  const [footfallLoaded, setFootfallLoaded] = useState(false);
  const [showTeacherTourEntry, setShowTeacherTourEntry] = useState(false);
  const [steamhProjects, setSteamhProjects] = useState<SteamhProject[]>([]);
  const [steamhLoading, setSteamhLoading] = useState(true);
  const [steamhError, setSteamhError] = useState<string | null>(null);
  const [visibleHomeBlocks, setVisibleHomeBlocks] = useState<Record<string, boolean>>({
    "home-block-1": true,
    "home-block-2": false,
    "home-block-3": false,
    "home-block-4": false,
  });
  const getScrollBlockClassName = (blockId: string) =>
    `scroll-mt-24 ${blockId === "home-block-4" ? "min-h-0" : "min-h-screen"} snap-start snap-always transition-[opacity,transform,filter] duration-700 ease-out ${visibleHomeBlocks[blockId] ? "opacity-100 translate-y-0 blur-0" : "opacity-45 translate-y-8 blur-[1px]"
    }`;
  const footfallOffset = 822;
  const footfallDisplay =
    footfallLoaded && footfall !== null
      ? String(footfall + footfallOffset).padStart(4, "0")
      : String(footfallSpin).padStart(4, "0");

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroSlideIndex((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (footfallLoaded) return;
    const spin = setInterval(() => {
      setFootfallSpin((prev) => (prev + 37) % 10000);
    }, 60);
    return () => clearInterval(spin);
  }, [footfallLoaded]);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        setIsAuthed(Boolean(user));
        if (user) {
          const role = user.user_metadata?.role || null;
          const isDefaultAdmin = user.email?.toLowerCase() === defaultAdminEmail;
          setUserRole(isDefaultAdmin ? "admin" : role);
        } else {
          setUserRole(null);
        }
      } catch {
        setIsAuthed(false);
        setUserRole(null);
      }
    };
    void checkUser();
  }, [defaultAdminEmail]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = window.localStorage.getItem(CARD4_LAYOUT_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<Record<Card4ElementId, { x?: number; y?: number }>>;
      setCard4Offsets({
        testimonials: {
          x: Number.isFinite(parsed.testimonials?.x) ? Math.round(parsed.testimonials?.x ?? 0) : 0,
          y: Number.isFinite(parsed.testimonials?.y) ? Math.round(parsed.testimonials?.y ?? 0) : 0,
        },
        bundles: {
          x: Number.isFinite(parsed.bundles?.x) ? Math.round(parsed.bundles?.x ?? 0) : 0,
          y: Number.isFinite(parsed.bundles?.y) ? Math.round(parsed.bundles?.y ?? 0) : 0,
        },
        footer: {
          x: Number.isFinite(parsed.footer?.x) ? Math.round(parsed.footer?.x ?? 0) : 0,
          y: 0,
        },
      });
    } catch {
      // Ignore malformed persisted values.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || card2EditMode) return;

    const syncCard2Offsets = () => {
      setCard2Offsets(resolveCard2OffsetsForViewport(window.innerWidth));
    };

    syncCard2Offsets();
    window.addEventListener("resize", syncCard2Offsets);
    return () => window.removeEventListener("resize", syncCard2Offsets);
  }, [card2EditMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = window.localStorage.getItem(FOOTER_FILL_STORAGE_KEY);
      if (!saved) return;
      const parsed = Number(saved);
      if (!Number.isFinite(parsed)) return;
      setFooterFillExtra(clampFooterFill(parsed));
    } catch {
      // Ignore malformed persisted values.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = window.localStorage.getItem(INDUS_LOGO_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { x?: number; y?: number };
      if (!Number.isFinite(parsed?.x) || !Number.isFinite(parsed?.y)) return;
      setIndusLogoPosition(clampIndusLogoPosition({ x: parsed.x ?? 0, y: parsed.y ?? 0 }));
    } catch {
      // Ignore malformed persisted values.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!nasaPromoEditMode) {
      setNasaPromoLayout(clampNasaPromoLayout(NASA_PROMO_LOCKED_LAYOUT));
      return;
    }

    try {
      const saved = window.localStorage.getItem(NASA_PROMO_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<NasaPromoLayout>;
      if (!Number.isFinite(parsed?.x) || !Number.isFinite(parsed?.y) || !Number.isFinite(parsed?.width)) return;
      setNasaPromoLayout(
        clampNasaPromoLayout({
          x: parsed.x ?? 0,
          y: parsed.y ?? 0,
          width: parsed.width ?? NASA_PROMO_DEFAULT_WIDTH,
          cropScale: Number.isFinite(parsed.cropScale) ? parsed.cropScale ?? NASA_PROMO_DEFAULT_SCALE : NASA_PROMO_DEFAULT_SCALE,
          cropX: Number.isFinite(parsed.cropX) ? parsed.cropX ?? 0 : 0,
          cropY: Number.isFinite(parsed.cropY) ? parsed.cropY ?? 0 : 0,
        }),
      );
    } catch {
      // Ignore malformed persisted values.
    }
  }, [nasaPromoEditMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(CARD4_LAYOUT_STORAGE_KEY, JSON.stringify(card4Offsets));
    } catch {
      // Ignore storage failures.
    }
  }, [card4Offsets]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(FOOTER_FILL_STORAGE_KEY, String(footerFillExtra));
    } catch {
      // Ignore storage failures.
    }
  }, [footerFillExtra]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(INDUS_LOGO_STORAGE_KEY, JSON.stringify(indusLogoPosition));
    } catch {
      // Ignore storage failures.
    }
  }, [indusLogoPosition]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!nasaPromoEditMode) return;
    try {
      window.localStorage.setItem(NASA_PROMO_STORAGE_KEY, JSON.stringify(nasaPromoLayout));
    } catch {
      // Ignore storage failures.
    }
  }, [nasaPromoEditMode, nasaPromoLayout]);

  useEffect(() => {
    if (card2EditMode) return;
    setCard2GuideState({ vertical: false, horizontal: false });
    setCard2ActiveElement(null);
    card2DragRef.current = {
      id: null,
      pointerId: null,
      startClientX: 0,
      startClientY: 0,
      startOffsetX: 0,
      startOffsetY: 0,
      startCenterX: 0,
      startCenterY: 0,
      containerCenterX: 0,
      containerCenterY: 0,
      moved: false,
    };
  }, [card2EditMode]);

  useEffect(() => {
    if (card4EditMode) return;
    setCard4GuideState({ vertical: false, horizontal: false });
    setCard4ActiveElement(null);
    card4DragRef.current = {
      id: null,
      pointerId: null,
      startClientX: 0,
      startClientY: 0,
      startOffsetX: 0,
      startOffsetY: 0,
      startCenterX: 0,
      startCenterY: 0,
      containerCenterX: 0,
      containerCenterY: 0,
      moved: false,
    };
  }, [card4EditMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onScroll = () => {
      const firstBlock = document.getElementById("home-block-1");
      if (!firstBlock) {
        const collapsed = window.scrollY > 8;
        setHeaderCollapsed(collapsed);
        setEagleWidgetCollapsedByScroll(collapsed);
        return;
      }

      const viewportMid = window.scrollY + window.innerHeight / 2;
      const firstBlockTop = firstBlock.offsetTop;
      const firstBlockBottom = firstBlockTop + firstBlock.offsetHeight;
      const isOnFirstBlock = viewportMid >= firstBlockTop && viewportMid < firstBlockBottom;

      setHeaderCollapsed(!isOnFirstBlock);
      setEagleWidgetCollapsedByScroll(!isOnFirstBlock);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const blocks = Array.from(document.querySelectorAll<HTMLElement>("[data-scroll-block]"));
    if (blocks.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        setVisibleHomeBlocks((previous) => {
          let changed = false;
          const next = { ...previous };

          for (const entry of entries) {
            const target = entry.target as HTMLElement;
            const id = target.id;
            if (!id) continue;
            const isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.28;
            if (next[id] !== isVisible) {
              next[id] = isVisible;
              changed = true;
            }
          }

          return changed ? next : previous;
        });
      },
      { threshold: [0.28, 0.5, 0.72], rootMargin: "-8% 0px -8% 0px" },
    );

    blocks.forEach((block) => observer.observe(block));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const blockIds = ["home-block-1", "home-block-2", "home-block-3", "home-block-4"] as const;
    let snapLock = false;

    const hasScrollableAncestor = (start: HTMLElement | null) => {
      let node: HTMLElement | null = start;
      while (node && node !== document.body) {
        const style = window.getComputedStyle(node);
        const overflowY = style.overflowY;
        const scrollable = (overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight;
        if (scrollable) return true;
        node = node.parentElement;
      }
      return false;
    };

    const scheduleBlockTwoAlignment = (blockTwo: HTMLElement) => {
      if (blockTwoAlignTimerRef.current !== null) {
        window.clearTimeout(blockTwoAlignTimerRef.current);
      }

      blockTwoAlignTimerRef.current = window.setTimeout(() => {
        const currentTop = blockTwo.getBoundingClientRect().top;
        const desiredTop = -HOME_BLOCK_TWO_SNAP_OFFSET;

        const delta = currentTop - desiredTop;
        if (Math.abs(delta) > 1) {
          window.scrollBy({ top: delta, behavior: "auto" });
        }
      }, 760);
    };

    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 14) return;
      if (snapLock) {
        event.preventDefault();
        return;
      }

      const targetNode = event.target instanceof HTMLElement ? event.target : null;
      if (hasScrollableAncestor(targetNode)) return;

      const blocks = blockIds
        .map((id) => document.getElementById(id))
        .filter((node): node is HTMLElement => Boolean(node));
      if (blocks.length === 0) return;

      const viewportMid = window.scrollY + window.innerHeight / 2;
      let currentIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;

      blocks.forEach((block, index) => {
        const center = block.offsetTop + block.offsetHeight / 2;
        const distance = Math.abs(center - viewportMid);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          currentIndex = index;
        }
      });

      const nextIndex =
        event.deltaY > 0
          ? Math.min(blocks.length - 1, currentIndex + 1)
          : Math.max(0, currentIndex - 1);

      if (nextIndex === currentIndex) return;

      event.preventDefault();
      snapLock = true;
      if (nextIndex === 1) {
        const blockTwo = blocks[nextIndex];
        const targetTop = Math.max(0, blockTwo.offsetTop + HOME_BLOCK_TWO_SNAP_OFFSET);
        window.scrollTo({ top: targetTop, behavior: "smooth" });
        scheduleBlockTwoAlignment(blockTwo);
      } else {
        blocks[nextIndex].scrollIntoView({ behavior: "smooth", block: "start" });
      }
      window.setTimeout(() => {
        snapLock = false;
      }, 700);
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", handleWheel);
      if (blockTwoAlignTimerRef.current !== null) {
        window.clearTimeout(blockTwoAlignTimerRef.current);
        blockTwoAlignTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    primeUiTone();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setEagleSpeechReady(false);
    const timer = window.setTimeout(() => {
      setEagleSpeechReady(true);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!EAGLE_BUBBLE_DRAG_ENABLED) {
      setEagleBubblePosition({
        top: EAGLE_BUBBLE_DEFAULT_TOP,
        right: EAGLE_BUBBLE_DEFAULT_RIGHT,
      });
      try {
        window.localStorage.removeItem(EAGLE_BUBBLE_STORAGE_KEY);
      } catch {
        // Ignore storage failures.
      }
      return;
    }
    try {
      const saved = window.localStorage.getItem(EAGLE_BUBBLE_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { top?: number; right?: number };
      if (typeof parsed.top !== "number" || typeof parsed.right !== "number") return;
      setEagleBubblePosition(clampEagleBubblePosition({ top: parsed.top, right: parsed.right }));
    } catch {
      // Ignore malformed persisted values.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!EAGLE_BUBBLE_DRAG_ENABLED) return;
    try {
      window.localStorage.setItem(EAGLE_BUBBLE_STORAGE_KEY, JSON.stringify(eagleBubblePosition));
    } catch {
      // Ignore storage failures.
    }
  }, [eagleBubblePosition]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const defaultPosition = clampEagleWidgetPosition(
      { bottom: EAGLE_WIDGET_DEFAULT_BOTTOM, right: EAGLE_WIDGET_DEFAULT_RIGHT },
      window.innerWidth,
      window.innerHeight,
    );
    let resolvedPosition = defaultPosition;

    try {
      const saved = window.localStorage.getItem(EAGLE_WIDGET_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { bottom?: number; right?: number };
        if (typeof parsed.bottom === "number" && typeof parsed.right === "number") {
          resolvedPosition = clampEagleWidgetPosition(
            { bottom: parsed.bottom, right: parsed.right },
            window.innerWidth,
            window.innerHeight,
          );
        }
      }
    } catch {
      // Ignore malformed persisted values.
    }

    setEagleWidgetPosition(resolvedPosition);
    setEagleWidgetReady(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!EAGLE_WIDGET_DRAG_ENABLED) return;

    try {
      window.localStorage.setItem(EAGLE_WIDGET_STORAGE_KEY, JSON.stringify(eagleWidgetPosition));
    } catch {
      // Ignore storage failures.
    }
  }, [eagleWidgetPosition]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncEagleWidgetPosition = () => {
      setEagleWidgetPosition((previous) =>
        clampEagleWidgetPosition(previous, window.innerWidth, window.innerHeight),
      );
    };

    syncEagleWidgetPosition();
    window.addEventListener("resize", syncEagleWidgetPosition);
    return () => window.removeEventListener("resize", syncEagleWidgetPosition);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const shouldShow =
      isAuthed &&
      userRole === "teacher" &&
      window.sessionStorage.getItem(TEACHER_HOME_TOUR_ENTRY_KEY) === "1";
    setShowTeacherTourEntry(shouldShow);
  }, [isAuthed, userRole]);

  const launchTeacherTourFromHome = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(TEACHER_HOME_TOUR_ENTRY_KEY);
      window.sessionStorage.setItem(TEACHER_TOUR_AUTOSTART_KEY, "1");
      window.localStorage.removeItem(TEACHER_TOUR_STORAGE_KEY);
      window.localStorage.removeItem(TEACHER_DASHBOARD_TOUR_RESUME_KEY);
      window.localStorage.removeItem(TEACHER_PROGRESS_TOUR_FORCE_KEY);
      window.localStorage.removeItem(TEACHER_PROGRESS_TOUR_CHAIN_KEY);
      window.localStorage.removeItem(TEACHER_STUDENTS_TOUR_FORCE_KEY);
      window.localStorage.removeItem(TEACHER_STUDENTS_TOUR_CHAIN_KEY);
    }
    setShowTeacherTourEntry(false);
    router.push("/customer");
  };

  const dismissTeacherTourEntry = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(TEACHER_HOME_TOUR_ENTRY_KEY);
    }
    setShowTeacherTourEntry(false);
  };

  useEffect(() => {
    let active = true;

    const refreshCount = async () => {
      try {
        const res = await fetch("/api/footfall?page=home", {
          cache: "no-store",
          next: { revalidate: 0 },
        });
        if (!res.ok) throw new Error("Failed to fetch footfall.");
        const data = (await res.json()) as { count?: number };
        if (active && typeof data.count === "number") {
          setFootfall(data.count);
          setFootfallSpin((data.count + footfallOffset) % 10000);
          setFootfallLoaded(true);
        }
      } catch {
        // ignore count errors
      }
    };

    const trackAndLoad = async () => {
      try {
        const res = await fetch("/api/footfall", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page: "home" }),
          cache: "no-store",
          next: { revalidate: 0 },
        });
        if (res.ok) {
          const data = (await res.json()) as { count?: number };
          if (active && typeof data.count === "number") {
            setFootfall(data.count);
            setFootfallSpin((data.count + footfallOffset) % 10000);
            setFootfallLoaded(true);
            return;
          }
        }
      } catch {
        // ignore track errors
      }
      await refreshCount();
    };

    trackAndLoad();
    const interval = window.setInterval(refreshCount, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSteamhProjects = async () => {
      const fallbackSamples = sampleSteamhProjects.map(enrichSteamhProjectWithSampleDetails);
      try {
        setSteamhLoading(true);
        const rows = await fetchSteamhProjects({ limit: 150 });
        if (cancelled) return;
        const liveProjects = rows.map(enrichSteamhProjectWithSampleDetails);
        const selectedProjects = resolveHomepageShowcaseProjects(liveProjects, fallbackSamples);
        setSteamhProjects(selectedProjects);
        setSteamhError(selectedProjects.length > 0 ? null : "Unable to load showcase projects.");
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Unable to load showcase projects.";
        const selectedProjects = resolveHomepageShowcaseProjects([], fallbackSamples);
        setSteamhProjects(selectedProjects);
        setSteamhError(selectedProjects.length > 0 ? null : message);
      } finally {
        if (!cancelled) {
          setSteamhLoading(false);
        }
      }
    };

    loadSteamhProjects();
    return () => {
      cancelled = true;
    };
  }, []);

  const openPanel = () => {
    setPanelVisible(true);
    requestAnimationFrame(() => setPanelOpen(true));
  };

  const openAssistantChat = (source: "button" | "eagle" = "button"): void => {
    if (source === "eagle") {
      setEagleWidgetDismissed(true);
    }
    setFaqOpen(false);
    setChatOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setTimeout(() => setPanelVisible(false), 350);
  };

  const openContactDrawer = () => {
    setContactOpen(true);
    setFaqOpen(false);
    setContactSubmitted(false);
    setContactError(null);
  };

  const toggleFooterItem = (item: "about" | "contact" | "privacy" | "terms") => {
    setFooterExpanded((prev) => (prev === item ? null : item));
  };

  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      const assistantReply = data.reply ?? data.error ?? "Assistant unavailable.";
      setMessages((prev) => [...prev, { role: "assistant", content: assistantReply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const submitContact = async () => {
    if (!contactForm.name.trim() || !contactForm.email.trim() || !contactForm.message.trim()) {
      setContactError("Please fill in name, email, and message.");
      return;
    }
    setContactSubmitting(true);
    setContactError(null);
    try {
      const response = await fetch("/api/sales-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactForm.name.trim(),
          email: contactForm.email.trim(),
          school: contactForm.school.trim() || null,
          message: contactForm.message.trim(),
          sourcePage: "home",
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setContactError(body?.error ?? `Unable to submit inquiry (status ${response.status}).`);
        return;
      }
      setContactSubmitted(true);
      setContactForm({ name: "", email: "", school: "", message: "" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to submit inquiry.";
      setContactError(message);
    } finally {
      setContactSubmitting(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFaqTabTop = () => {
      setFaqTabTop((previous) => {
        const fallback = Math.round(window.innerHeight / 2 - FAQ_TAB_HEIGHT / 2 - FAQ_TAB_DEFAULT_RAISE);
        const candidate = typeof previous === "number" ? previous : fallback;
        return clampFaqTabTop(candidate, window.innerHeight);
      });
    };

    syncFaqTabTop();
    window.addEventListener("resize", syncFaqTabTop);
    return () => window.removeEventListener("resize", syncFaqTabTop);
  }, []);

  const startFaqTabDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (typeof window === "undefined") return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const fallback = Math.round(window.innerHeight / 2 - FAQ_TAB_HEIGHT / 2 - FAQ_TAB_DEFAULT_RAISE);
    const startTop = typeof faqTabTop === "number" ? faqTabTop : clampFaqTabTop(fallback, window.innerHeight);

    faqTabDragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startTop,
      moved: false,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveFaqTabDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (typeof window === "undefined") return;

    const dragState = faqTabDragRef.current;
    if (dragState.pointerId !== event.pointerId) return;

    const deltaY = event.clientY - dragState.startY;
    const nextTop = clampFaqTabTop(Math.round(dragState.startTop + deltaY), window.innerHeight);

    if (!dragState.moved && Math.abs(deltaY) >= FAQ_TAB_DRAG_THRESHOLD) {
      dragState.moved = true;
    }

    setFaqTabTop(nextTop);
  };

  const endFaqTabDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = faqTabDragRef.current;
    if (dragState.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    suppressFaqClickRef.current = dragState.moved;
    faqTabDragRef.current = {
      pointerId: null,
      startY: 0,
      startTop: 0,
      moved: false,
    };
  };

  const startFooterFillDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.stopPropagation();

    footerFillDragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startValue: footerFillExtra,
      moved: false,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveFooterFillDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = footerFillDragRef.current;
    if (dragState.pointerId !== event.pointerId) return;
    event.stopPropagation();

    const deltaY = event.clientY - dragState.startY;
    const nextValue = clampFooterFill(dragState.startValue + deltaY);
    if (!dragState.moved && Math.abs(deltaY) >= FOOTER_FILL_DRAG_THRESHOLD) {
      dragState.moved = true;
    }
    setFooterFillExtra(nextValue);
  };

  const endFooterFillDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = footerFillDragRef.current;
    if (dragState.pointerId !== event.pointerId) return;
    event.stopPropagation();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    footerFillDragRef.current = {
      pointerId: null,
      startY: 0,
      startValue: 0,
      moved: false,
    };
  };

  const startIndusLogoDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!INDUS_LOGO_DRAG_ENABLED) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.stopPropagation();

    indusLogoDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: indusLogoPosition.x,
      startOffsetY: indusLogoPosition.y,
      moved: false,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const moveIndusLogoDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = indusLogoDragRef.current;
    if (dragState.pointerId !== event.pointerId) return;
    event.stopPropagation();

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    const nextPosition = clampIndusLogoPosition({
      x: dragState.startOffsetX + deltaX,
      y: dragState.startOffsetY + deltaY,
    });

    if (
      !dragState.moved &&
      (Math.abs(deltaX) >= INDUS_LOGO_DRAG_THRESHOLD || Math.abs(deltaY) >= INDUS_LOGO_DRAG_THRESHOLD)
    ) {
      dragState.moved = true;
    }

    setIndusLogoPosition(nextPosition);
  };

  const endIndusLogoDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = indusLogoDragRef.current;
    if (dragState.pointerId !== event.pointerId) return;
    event.stopPropagation();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    indusLogoDragRef.current = {
      pointerId: null,
      startX: 0,
      startY: 0,
      startOffsetX: 0,
      startOffsetY: 0,
      moved: false,
    };
  };

  const startEagleWidgetDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!EAGLE_WIDGET_DRAG_ENABLED) return;
    if (typeof window === "undefined") return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    eagleWidgetDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startBottom: eagleWidgetPosition.bottom,
      startRight: eagleWidgetPosition.right,
      moved: false,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveEagleWidgetDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!EAGLE_WIDGET_DRAG_ENABLED) return;
    if (typeof window === "undefined") return;

    const dragState = eagleWidgetDragRef.current;
    if (dragState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    const nextPosition = clampEagleWidgetPosition(
      {
        bottom: Math.round(dragState.startBottom - deltaY),
        right: Math.round(dragState.startRight - deltaX),
      },
      window.innerWidth,
      window.innerHeight,
    );

    if (
      !dragState.moved &&
      (Math.abs(deltaX) >= EAGLE_WIDGET_DRAG_THRESHOLD || Math.abs(deltaY) >= EAGLE_WIDGET_DRAG_THRESHOLD)
    ) {
      dragState.moved = true;
    }

    setEagleWidgetPosition(nextPosition);
  };

  const endEagleWidgetDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!EAGLE_WIDGET_DRAG_ENABLED) return;

    const dragState = eagleWidgetDragRef.current;
    if (dragState.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    suppressEagleClickRef.current = dragState.moved;
    eagleWidgetDragRef.current = {
      pointerId: null,
      startX: 0,
      startY: 0,
      startBottom: 0,
      startRight: 0,
      moved: false,
    };
  };

  const startEagleBubbleDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (typeof window === "undefined") return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    eagleBubbleDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTop: eagleBubblePosition.top,
      startRight: eagleBubblePosition.right,
      moved: false,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const moveEagleBubbleDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = eagleBubbleDragRef.current;
    if (dragState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    const nextPosition = clampEagleBubblePosition({
      top: Math.round(dragState.startTop + deltaY),
      right: Math.round(dragState.startRight - deltaX),
    });

    if (
      !dragState.moved &&
      (Math.abs(deltaX) >= EAGLE_BUBBLE_DRAG_THRESHOLD || Math.abs(deltaY) >= EAGLE_BUBBLE_DRAG_THRESHOLD)
    ) {
      dragState.moved = true;
    }

    setEagleBubblePosition(nextPosition);
  };

  const endEagleBubbleDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = eagleBubbleDragRef.current;
    if (dragState.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    eagleBubbleDragRef.current = {
      pointerId: null,
      startX: 0,
      startY: 0,
      startTop: 0,
      startRight: 0,
      moved: false,
    };
  };

  const startNasaPromoDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (!nasaPromoEditMode) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-nasa-promo-stop-drag='true']")) return;

    nasaPromoDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: nasaPromoLayout.x,
      startOffsetY: nasaPromoLayout.y,
      moved: false,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const moveNasaPromoDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (!nasaPromoEditMode) return;

    const dragState = nasaPromoDragRef.current;
    if (dragState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;

    if (
      !dragState.moved &&
      (Math.abs(deltaX) >= NASA_PROMO_DRAG_THRESHOLD || Math.abs(deltaY) >= NASA_PROMO_DRAG_THRESHOLD)
    ) {
      dragState.moved = true;
    }

    setNasaPromoLayout((previous) =>
      clampNasaPromoLayout({
        ...previous,
        x: dragState.startOffsetX + deltaX,
        y: dragState.startOffsetY + deltaY,
      }),
    );
  };

  const endNasaPromoDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (!nasaPromoEditMode) return;

    const dragState = nasaPromoDragRef.current;
    if (dragState.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    nasaPromoSuppressClickRef.current = dragState.moved;
    nasaPromoDragRef.current = {
      pointerId: null,
      startX: 0,
      startY: 0,
      startOffsetX: 0,
      startOffsetY: 0,
      moved: false,
    };
  };

  const startNasaPromoResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!nasaPromoEditMode) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    nasaPromoResizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: nasaPromoLayout.width,
      moved: false,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  };

  const moveNasaPromoResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!nasaPromoEditMode) return;

    const resizeState = nasaPromoResizeRef.current;
    if (resizeState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - resizeState.startX;
    if (!resizeState.moved && Math.abs(deltaX) >= NASA_PROMO_DRAG_THRESHOLD) {
      resizeState.moved = true;
    }

    setNasaPromoLayout((previous) =>
      clampNasaPromoLayout({
        ...previous,
        width: resizeState.startWidth + deltaX,
      }),
    );
  };

  const endNasaPromoResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!nasaPromoEditMode) return;

    const resizeState = nasaPromoResizeRef.current;
    if (resizeState.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    nasaPromoSuppressClickRef.current = nasaPromoSuppressClickRef.current || resizeState.moved;
    nasaPromoResizeRef.current = {
      pointerId: null,
      startX: 0,
      startWidth: NASA_PROMO_DEFAULT_WIDTH,
      moved: false,
    };
    event.stopPropagation();
  };

  const onNasaPromoClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (nasaPromoEditMode || nasaPromoSuppressClickRef.current) {
      event.preventDefault();
      nasaPromoSuppressClickRef.current = false;
    }
  };

  const startNasaPromoCropDrag = (event: React.PointerEvent<HTMLAnchorElement>) => {
    if (!nasaPromoEditMode) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    nasaPromoCropDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startCropX: nasaPromoLayout.cropX,
      startCropY: nasaPromoLayout.cropY,
      moved: false,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  };

  const moveNasaPromoCropDrag = (event: React.PointerEvent<HTMLAnchorElement>) => {
    if (!nasaPromoEditMode) return;

    const dragState = nasaPromoCropDragRef.current;
    if (dragState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;

    if (
      !dragState.moved &&
      (Math.abs(deltaX) >= NASA_PROMO_DRAG_THRESHOLD || Math.abs(deltaY) >= NASA_PROMO_DRAG_THRESHOLD)
    ) {
      dragState.moved = true;
    }

    setNasaPromoLayout((previous) =>
      clampNasaPromoLayout({
        ...previous,
        cropX: dragState.startCropX + deltaX,
        cropY: dragState.startCropY + deltaY,
      }),
    );

    event.stopPropagation();
  };

  const endNasaPromoCropDrag = (event: React.PointerEvent<HTMLAnchorElement>) => {
    if (!nasaPromoEditMode) return;

    const dragState = nasaPromoCropDragRef.current;
    if (dragState.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    nasaPromoSuppressClickRef.current = nasaPromoSuppressClickRef.current || dragState.moved;
    nasaPromoCropDragRef.current = {
      pointerId: null,
      startX: 0,
      startY: 0,
      startCropX: 0,
      startCropY: 0,
      moved: false,
    };
    event.stopPropagation();
  };

  const updateNasaPromoCropScale = (nextScale: number) => {
    setNasaPromoLayout((previous) =>
      clampNasaPromoLayout({
        ...previous,
        cropScale: nextScale,
      }),
    );
  };

  const updateNasaPromoCropX = (nextX: number) => {
    setNasaPromoLayout((previous) =>
      clampNasaPromoLayout({
        ...previous,
        cropX: nextX,
      }),
    );
  };

  const updateNasaPromoCropY = (nextY: number) => {
    setNasaPromoLayout((previous) =>
      clampNasaPromoLayout({
        ...previous,
        cropY: nextY,
      }),
    );
  };

  const resetNasaPromoCrop = () => {
    setNasaPromoLayout((previous) =>
      clampNasaPromoLayout({
        ...previous,
        cropScale: NASA_PROMO_DEFAULT_SCALE,
        cropX: 0,
        cropY: 0,
      }),
    );
  };

  const nasaPromoCropLimits = getNasaPromoCropLimits(nasaPromoLayout.width, nasaPromoLayout.cropScale);

  const setCard2ItemRef = (id: Card2ElementId, node: HTMLDivElement | null) => {
    card2ItemRefs.current[id] = node;
  };

  const getCard2ItemStyle = (id: Card2ElementId) => ({
    transform: `translate(${card2Offsets[id].x}px, ${card2Offsets[id].y}px)`,
  });

  const getCard2ItemClassName = (id: Card2ElementId) =>
    `relative transition-transform ${card2EditMode ? "z-0 touch-none cursor-grab active:cursor-grabbing select-none [&_a]:pointer-events-none [&_button]:pointer-events-none" : ""
    } ${card2EditMode && card2ActiveElement === id
      ? "z-20 outline outline-2 outline-accent-strong/60 outline-offset-2"
      : ""
    }`;

  const startCard2ItemDrag = (id: Card2ElementId, event: React.PointerEvent<HTMLDivElement>) => {
    if (!card2EditMode) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const itemNode = card2ItemRefs.current[id];
    const containerNode = card2ContainerRef.current;
    if (!itemNode || !containerNode) return;

    const itemRect = itemNode.getBoundingClientRect();
    const containerRect = containerNode.getBoundingClientRect();
    card2DragRef.current = {
      id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: card2Offsets[id].x,
      startOffsetY: card2Offsets[id].y,
      startCenterX: itemRect.left + itemRect.width / 2,
      startCenterY: itemRect.top + itemRect.height / 2,
      containerCenterX: containerRect.left + containerRect.width / 2,
      containerCenterY: containerRect.top + containerRect.height / 2,
      moved: false,
    };

    setCard2ActiveElement(id);
    setCard2GuideState({ vertical: false, horizontal: false });
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const moveCard2ItemDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!card2EditMode) return;

    const dragState = card2DragRef.current;
    const dragId = dragState.id;
    if (!dragId || dragState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragState.startClientX;
    const deltaY = event.clientY - dragState.startClientY;
    let nextX = dragState.startOffsetX + deltaX;
    let nextY = dragState.startOffsetY + deltaY;

    const nextCenterX = dragState.startCenterX + deltaX;
    const nextCenterY = dragState.startCenterY + deltaY;
    const diffX = nextCenterX - dragState.containerCenterX;
    const diffY = nextCenterY - dragState.containerCenterY;
    const snapVertical = Math.abs(diffX) <= CARD2_CENTER_SNAP_THRESHOLD;
    const snapHorizontal = Math.abs(diffY) <= CARD2_CENTER_SNAP_THRESHOLD;

    if (snapVertical) nextX -= diffX;
    if (snapHorizontal) nextY -= diffY;

    setCard2GuideState({ vertical: snapVertical, horizontal: snapHorizontal });
    setCard2Offsets((previous) => ({
      ...previous,
      [dragId]: { x: Math.round(nextX), y: Math.round(nextY) },
    }));

    if (!dragState.moved && (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2)) {
      dragState.moved = true;
    }
  };

  const endCard2ItemDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = card2DragRef.current;
    if (dragState.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setCard2GuideState({ vertical: false, horizontal: false });
    setCard2ActiveElement(null);
    card2DragRef.current = {
      id: null,
      pointerId: null,
      startClientX: 0,
      startClientY: 0,
      startOffsetX: 0,
      startOffsetY: 0,
      startCenterX: 0,
      startCenterY: 0,
      containerCenterX: 0,
      containerCenterY: 0,
      moved: false,
    };
  };

  const setCard4ItemRef = (id: Card4ElementId, node: HTMLDivElement | null) => {
    card4ItemRefs.current[id] = node;
  };

  const getCard4ItemStyle = (id: Card4ElementId) => ({
    transform: `translate(${card4Offsets[id].x}px, ${card4Offsets[id].y}px)`,
  });

  const getCard4ItemClassName = (id: Card4ElementId) =>
    `relative transition-transform ${card4EditMode ? "z-0 touch-none cursor-grab active:cursor-grabbing select-none" : ""
    } ${card4EditMode && card4ActiveElement === id
      ? "z-20 outline outline-2 outline-accent-strong/60 outline-offset-2"
      : ""
    }`;

  const startCard4ItemDrag = (id: Card4ElementId, event: React.PointerEvent<HTMLDivElement>) => {
    if (!card4EditMode) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const itemNode = card4ItemRefs.current[id];
    const containerNode = card4ContainerRef.current;
    if (!itemNode || !containerNode) return;

    const itemRect = itemNode.getBoundingClientRect();
    const containerRect = containerNode.getBoundingClientRect();
    card4DragRef.current = {
      id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: card4Offsets[id].x,
      startOffsetY: card4Offsets[id].y,
      startCenterX: itemRect.left + itemRect.width / 2,
      startCenterY: itemRect.top + itemRect.height / 2,
      containerCenterX: containerRect.left + containerRect.width / 2,
      containerCenterY: containerRect.top + containerRect.height / 2,
      moved: false,
    };

    setCard4ActiveElement(id);
    setCard4GuideState({ vertical: false, horizontal: false });
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const moveCard4ItemDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!card4EditMode) return;

    const dragState = card4DragRef.current;
    const dragId = dragState.id;
    if (!dragId || dragState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragState.startClientX;
    const deltaY = event.clientY - dragState.startClientY;
    let nextX = dragState.startOffsetX + deltaX;
    let nextY = dragState.startOffsetY + deltaY;

    const nextCenterX = dragState.startCenterX + deltaX;
    const nextCenterY = dragState.startCenterY + deltaY;
    const diffX = nextCenterX - dragState.containerCenterX;
    const diffY = nextCenterY - dragState.containerCenterY;
    const snapVertical = Math.abs(diffX) <= CARD4_CENTER_SNAP_THRESHOLD;
    const snapHorizontal = Math.abs(diffY) <= CARD4_CENTER_SNAP_THRESHOLD;

    if (snapVertical) nextX -= diffX;
    if (snapHorizontal) nextY -= diffY;

    setCard4GuideState({ vertical: snapVertical, horizontal: snapHorizontal });
    setCard4Offsets((previous) => ({
      ...previous,
      [dragId]: { x: Math.round(nextX), y: Math.round(nextY) },
    }));

    if (!dragState.moved && (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2)) {
      dragState.moved = true;
    }
  };

  const endCard4ItemDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = card4DragRef.current;
    if (dragState.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setCard4GuideState({ vertical: false, horizontal: false });
    setCard4ActiveElement(null);
    card4DragRef.current = {
      id: null,
      pointerId: null,
      startClientX: 0,
      startClientY: 0,
      startOffsetX: 0,
      startOffsetY: 0,
      startCenterX: 0,
      startCenterY: 0,
      containerCenterX: 0,
      containerCenterY: 0,
      moved: false,
    };
  };

  useEffect(() => {
    if (faqOpen) {
      const timer = setTimeout(() => setFaqOpen(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [faqOpen]);


  return (
    <main className="min-h-screen text-foreground">
      {showTeacherTourEntry && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" style={{ background: "rgba(15, 23, 42, 0.14)" }}>
          <div
            className="w-full max-w-xl rounded-2xl p-5"
            style={{
              border: "1px solid color-mix(in srgb, var(--accent) 28%, transparent)",
              background: "var(--surface)",
              color: "var(--foreground)",
              boxShadow:
                "0 18px 42px rgba(15, 23, 42, 0.18), 0 0 0 1px color-mix(in srgb, var(--accent) 12%, transparent)",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 999,
                border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
                background: "color-mix(in srgb, var(--accent) 10%, #ffffff)",
                padding: "2px 10px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--accent-strong)",
              }}
            >
              Teacher Walkthrough
            </span>
            <h2 className="mt-3 text-3xl font-semibold" style={{ color: "var(--accent-strong)" }}>
              Take Tour
            </h2>
            <p className="mt-3 text-sm" style={{ color: "color-mix(in srgb, var(--foreground) 82%, #64748b)" }}>
              You are signed in as teacher. Start from dashboard and continue the guided feature walkthrough.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  void playUiClickTone();
                  launchTeacherTourFromHome();
                }}
                style={{
                  borderRadius: 8,
                  border: "1px solid color-mix(in srgb, var(--accent-strong) 42%, transparent)",
                  background: "var(--accent)",
                  color: "#ffffff",
                  padding: "8px 14px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Take tour
              </button>
              <button
                type="button"
                onClick={dismissTeacherTourEntry}
                style={{
                  borderRadius: 8,
                  border: "1px solid color-mix(in srgb, var(--accent) 32%, transparent)",
                  background: "color-mix(in srgb, var(--background-2) 70%, #ffffff)",
                  color: "var(--accent-strong)",
                  padding: "8px 12px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Not now
              </button>
              <button
                type="button"
                onClick={() => {
                  dismissTeacherTourEntry();
                  router.push("/customer");
                }}
                style={{
                  borderRadius: 8,
                  border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
                  background: "color-mix(in srgb, var(--card) 75%, #ffffff)",
                  color: "var(--accent-strong)",
                  padding: "8px 12px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Go to dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      <header
        className={`relative sticky top-0 z-40 flex items-center justify-between border border-accent/50 bg-gradient-to-r from-white/40 via-white/20 to-white/40 supports-[backdrop-filter]:bg-white/10 shadow-[0_12px_36px_rgba(0,0,0,0.12)] backdrop-blur-3xl backdrop-saturate-200 transition-all duration-300 ${headerCollapsed ? "px-4 md:px-6 py-3" : "px-6 md:px-9 py-6"
          }`}
      >
        <div
          className={`hidden md:flex items-center gap-2 text-sm font-semibold text-slate-200 uppercase tracking-[0.2em] absolute right-6 transition-all duration-300 ${headerCollapsed ? "top-1 opacity-0 -translate-y-2 pointer-events-none" : "top-4 opacity-100"
            }`}
        >
          <span className="inline-flex h-4 w-6 overflow-hidden rounded-sm border border-white/20">
            <svg viewBox="0 0 24 16" aria-hidden="true" className="h-full w-full">
              <rect width="24" height="5.33" y="0" fill="#ff9933" />
              <rect width="24" height="5.33" y="5.33" fill="#ffffff" />
              <rect width="24" height="5.34" y="10.66" fill="#138808" />
            </svg>
          </span>
          Proudly Made in India
        </div>
        <div className={`flex flex-col transition-all duration-300 ${headerCollapsed ? "gap-1" : "gap-3"}`}>
          <div
            className={`relative transition-all duration-300 ${headerCollapsed ? "h-12 w-44 md:w-52 p-1" : "h-[70px] w-[250px] md:w-[300px] p-3"
              }`}
          >
            <Image
              src={logo}
              alt="Curriculum Dashboard logo"
              fill
              sizes="144px"
              className="object-contain"
              priority
            />
          </div>
          <div
            className={`flex flex-wrap items-center gap-3 text-slate-200 transition-all duration-300 overflow-hidden ${headerCollapsed ? "max-h-0 opacity-0 pointer-events-none" : "max-h-56 opacity-100"
              }`}
          >
            <div className="flex flex-wrap items-center gap-3">
              {boardLogos.map((board) => (
                <div
                  key={board.label}
                  className="flex items-center gap-4 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm uppercase tracking-[0.18em]"
                >
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/90">
                    <Image
                      src={board.src}
                      alt={`${board.label} board logo`}
                      width={56}
                      height={56}
                      className={board.imageClassName ?? "h-10 w-10 object-contain"}
                    />
                  </span>
                  {board.label}
                </div>
              ))}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100">
              <span className="h-2 w-2 rounded-full bg-accent-strong shadow-glow animate-pulse" />
              Compatible with all major boards
            </div>
          </div>
        </div>
        <nav className={`hidden md:flex items-center text-sm transition-all duration-300 ${headerCollapsed ? "gap-2" : "gap-4"}`}>
          {!headerCollapsed && (
            <div
              className={`relative flex-none nasa-promo-shimmer ${nasaPromoEditMode ? "select-none outline outline-1 outline-amber-300/70 rounded-md" : ""
                }`}
              style={{
                width: `${headerCollapsed ? Math.min(nasaPromoLayout.width, 120) : nasaPromoLayout.width}px`,
                transform: `translate(${nasaPromoLayout.x}px, ${nasaPromoLayout.y}px)`,
                overflow: nasaPromoEditMode ? "visible" : undefined,
              }}
              onPointerDown={startNasaPromoDrag}
              onPointerMove={moveNasaPromoDrag}
              onPointerUp={endNasaPromoDrag}
              onPointerCancel={endNasaPromoDrag}
            >
              <a
                href="https://www3.nasa.gov/send-your-name-with-artemis/"
                target="_blank"
                rel="noopener noreferrer"
                className="relative inline-flex items-center w-full overflow-hidden rounded-sm"
                data-nasa-promo-stop-drag="true"
                aria-label="NASA Artemis campaign"
                title="NASA Artemis campaign"
                onClick={onNasaPromoClick}
                onPointerDown={startNasaPromoCropDrag}
                onPointerMove={moveNasaPromoCropDrag}
                onPointerUp={endNasaPromoCropDrag}
                onPointerCancel={endNasaPromoCropDrag}
              >
                <Image
                  src={nasaPromo}
                  alt="NASA Artemis promotion"
                  className="block h-auto w-full object-contain nasa-promo-image-breath"
                  priority={false}
                />
              </a>
              {nasaPromoEditMode && (
                <button
                  type="button"
                  aria-label="Move NASA promo"
                  data-nasa-promo-control="true"
                  className="absolute -top-1.5 -left-1.5 h-5 w-5 rounded-md border border-amber-100 bg-amber-300/95 text-[10px] font-black leading-none text-slate-900 shadow cursor-grab active:cursor-grabbing"
                  onPointerDown={(event) => {
                    startNasaPromoDrag(event);
                    event.stopPropagation();
                  }}
                  onPointerMove={(event) => {
                    moveNasaPromoDrag(event);
                    event.stopPropagation();
                  }}
                  onPointerUp={(event) => {
                    endNasaPromoDrag(event);
                    event.stopPropagation();
                  }}
                  onPointerCancel={(event) => {
                    endNasaPromoDrag(event);
                    event.stopPropagation();
                  }}
                >
                  +
                </button>
              )}
              {nasaPromoEditMode && (
                <div
                  data-nasa-promo-stop-drag="true"
                  className="absolute left-0 top-full z-30 mt-2 w-[220px] rounded-md border border-amber-200/40 bg-slate-950/84 px-2 py-2 text-xs text-amber-100 shadow-lg backdrop-blur"
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerMove={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="mb-1 flex items-center justify-between gap-1">
                    <span className="font-semibold tracking-wide">Crop</span>
                    <button
                      type="button"
                      className="rounded border border-amber-100/50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-100 hover:bg-amber-100/10"
                      onClick={resetNasaPromoCrop}
                    >
                      Reset
                    </button>
                  </div>
                  <label className="mb-1.5 flex items-center gap-1.5">
                    <span className="w-10 shrink-0 font-semibold">Zoom</span>
                    <input
                      type="range"
                      min={NASA_PROMO_MIN_SCALE}
                      max={NASA_PROMO_MAX_SCALE}
                      step={0.01}
                      value={nasaPromoLayout.cropScale}
                      onChange={(event) => updateNasaPromoCropScale(Number(event.target.value))}
                      className="w-full accent-amber-300"
                      aria-label="NASA promo crop zoom"
                    />
                  </label>
                  <label className="mb-1.5 flex items-center gap-1.5">
                    <span className="w-10 shrink-0 font-semibold">X</span>
                    <input
                      type="range"
                      min={-nasaPromoCropLimits.x}
                      max={nasaPromoCropLimits.x}
                      step={1}
                      value={nasaPromoLayout.cropX}
                      onChange={(event) => updateNasaPromoCropX(Number(event.target.value))}
                      className="w-full accent-amber-300"
                      aria-label="NASA promo crop horizontal"
                    />
                  </label>
                  <label className="flex items-center gap-1.5">
                    <span className="w-10 shrink-0 font-semibold">Y</span>
                    <input
                      type="range"
                      min={-nasaPromoCropLimits.y}
                      max={nasaPromoCropLimits.y}
                      step={1}
                      value={nasaPromoLayout.cropY}
                      onChange={(event) => updateNasaPromoCropY(Number(event.target.value))}
                      className="w-full accent-amber-300"
                      aria-label="NASA promo crop vertical"
                    />
                  </label>
                  <p className="mt-1.5 text-[10px] text-amber-100/75">Drag image to crop. Use + handle to move the whole promo.</p>
                </div>
              )}
              {nasaPromoEditMode && (
                <button
                  type="button"
                  aria-label="Resize NASA promo"
                  data-nasa-promo-stop-drag="true"
                  className="absolute -bottom-1.5 -right-1.5 h-5 w-5 rounded-md border border-amber-100 bg-amber-300/95 shadow cursor-ew-resize"
                  onPointerDown={startNasaPromoResize}
                  onPointerMove={moveNasaPromoResize}
                  onPointerUp={endNasaPromoResize}
                  onPointerCancel={endNasaPromoResize}
                />
              )}
            </div>
          )}
          <div className="hidden md:flex flex-col items-start gap-1">
            {!isAuthed ? (
              <Link
                href="/login"
                className="bg-accent text-slate-50 font-semibold px-4 py-2 rounded-full shadow-glow hover:translate-y-[-1px] transition-transform"
              >
                Login / Sign In
              </Link>
            ) : (
              <Link
                href={userRole === "admin" ? "/admin" : "/customer"}
                className="bg-accent text-slate-50 font-semibold px-4 py-2 rounded-full shadow-glow hover:translate-y-[-1px] transition-transform"
              >
                Go to dashboard
              </Link>
            )}
          </div>
          <button
            onClick={openPanel}
            className="h-11 w-11 rounded-full border border-accent/20 bg-white/70 grid place-items-center hover:border-accent-strong hover:bg-white shadow-glow transition"
            aria-label="Open quick panel"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-6 w-6 text-foreground"
            >
              <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
              <path d="M19.4 13.5a7.5 7.5 0 0 0 .05-3l1.65-1.23a.6.6 0 0 0 .14-.78l-1.56-2.7a.6.6 0 0 0-.75-.24l-1.94.78a7.6 7.6 0 0 0-2.6-1.5l-.3-2.05A.6.6 0 0 0 13.5 2h-3a.6.6 0 0 0-.6.51l-.3 2.05a7.6 7.6 0 0 0-2.6 1.5l-1.94-.78a.6.6 0 0 0-.75.24l-1.56 2.7a.6.6 0 0 0 .14.78L4.55 10.5a7.5 7.5 0 0 0 0 3l-1.65 1.23a.6.6 0 0 0-.14.78l1.56 2.7a.6.6 0 0 0 .75.24l1.94-.78a7.6 7.6 0 0 0 2.6 1.5l.3 2.05a.6.6 0 0 0 .6.51h3a.6.6 0 0 0 .6-.51l.3-2.05a7.6 7.6 0 0 0 2.6-1.5l1.94.78a.6.6 0 0 0 .75-.24l1.56-2.7a.6.6 0 0 0-.14-.78Z" />
            </svg>
          </button>
        </nav>
        <button
          className="md:hidden h-10 w-10 rounded-full border border-accent/20 bg-white/80 grid place-items-center shadow z-50"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="Toggle menu"
        >
          <span className="block w-6 h-0.5 bg-foreground mb-1.5"></span>
          <span className="block w-6 h-0.5 bg-foreground mb-1.5"></span>
          <span className="block w-6 h-0.5 bg-foreground"></span>
        </button>
        {menuOpen && (
          <div className="absolute left-4 right-4 top-full mt-3 z-50 rounded-2xl border border-accent/20 bg-white/95 backdrop-blur-lg shadow-2xl p-4 flex flex-col gap-3 md:hidden text-foreground">
            <Link href="/shop" className="hover:text-accent-strong transition-colors">
              Shopping Page
            </Link>
            <Link href="#features" className="hover:text-accent-strong transition-colors">
              Features
            </Link>
            <Link href="#steamh-showcase" className="hover:text-accent-strong transition-colors">
              STEAM-H Showcase
            </Link>
            <button
              onClick={() => {
                openContactDrawer();
                setMenuOpen(false);
              }}
              className="hover:text-accent-strong text-left transition-colors"
            >
              Talk to sales
            </button>
            {!isAuthed ? (
              <Link
                href="/login"
                className="bg-accent text-slate-50 font-semibold px-4 py-2 rounded-xl text-center"
              >
                Login / Sign In
              </Link>
            ) : (
              <Link
                href="/customer"
                className="bg-accent text-slate-50 font-semibold px-4 py-2 rounded-xl text-center"
              >
                Go to dashboard
              </Link>
            )}
            <button
              onClick={openPanel}
              className="px-4 py-2 rounded-xl border border-accent/30 text-foreground"
            >
              Open Panel
            </button>
          </div>
        )}
      </header>

      <div id="home-block-1" data-scroll-block="hero" className={`${getScrollBlockClassName("home-block-1")}`}>
        <div className="pt-3 bg-red-900 w-screen relative left-1/2 -translate-x-1/2">
          <div className="rounded-none border-y border-accent bg-accent-strong pl-2 pr-4 py-0 flex items-stretch gap-0 overflow-x-auto">
            <Link
              href="#company-details"
              className="inline-flex items-center justify-center rounded-none bg-accent-strong px-4 py-3 text-sm font-semibold text-true-white hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              About
            </Link>
            <Link
              href="/shop"
              className="inline-flex items-center justify-center rounded-none border-l border-white/30 bg-accent-strong px-4 py-3 text-sm font-semibold text-true-white hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              Shopping Page
            </Link>
            <Link
              href="#features"
              className="inline-flex items-center justify-center rounded-none border-l border-white/30 bg-accent-strong px-4 py-3 text-sm font-semibold text-true-white hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              Features
            </Link>
            <Link
              href="#steamh-showcase"
              className="inline-flex items-center justify-center rounded-none border-l border-white/30 bg-accent-strong px-4 py-3 text-sm font-semibold text-true-white hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              STEAM-H Showcase
            </Link>
            <button
              onClick={openContactDrawer}
              className="inline-flex items-center justify-center rounded-none border-l border-white/30 bg-accent-strong px-4 py-3 text-sm font-semibold text-true-white hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              Talk to sales
            </button>
          </div>
        </div>
        <section className="section-padding relative overflow-hidden">
          <div className="absolute inset-0 opacity-60 bg-hero-grid [background-size:50px_50px]" />
          <div className="relative grid lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-white border border-black/35">
                <span className="h-2 w-2 rounded-full bg-accent-strong shadow-glow" />
                Built for modern STEM classrooms
              </div>
              <h1 className="text-4xl lg:text-5xl font-semibold leading-tight text-white">
                Redefining Education through Drones, VR, and STEAM-H Learning
              </h1>
              <p className="text-lg text-accent-strong max-w-2xl">
                A future-focused learning ecosystem where students explore real-world concepts through
                drone missions, immersive VR experiences, and hands-on STEAM-H projects.
              </p>
              <div className="flex flex-wrap gap-4">
                {!isAuthed ? (
                  <Link
                    href="/login"
                    className="bg-accent text-slate-50 px-6 py-3 rounded-full font-semibold shadow-glow hover:translate-y-[-1px] transition-transform"
                  >
                    Login / Sign In
                  </Link>
                ) : (
                  <Link
                    href="/customer"
                    className="bg-accent text-slate-50 px-6 py-3 rounded-full font-semibold shadow-glow hover:translate-y-[-1px] transition-transform"
                  >
                    Go to dashboard
                  </Link>
                )}
                <Link
                  href="/shop"
                  className="border border-accent/30 px-6 py-3 rounded-full font-semibold text-white hover:border-accent-strong transition bg-white/70"
                >
                  Browse Products
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-200">
                <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-white/10 px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-accent-strong shadow-glow" />
                  Universal board compatibility
                </div>
                <span className="text-slate-300">Works across all major boards.</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm text-slate-200">
                {[
                  ["120+", "Curriculum modules"],
                  ["80+", "Schools onboarded"],
                  ["24/7", "Support & analytics"],
                ].map(([stat, label]) => (
                  <div key={label} className="glass-panel rounded-2xl p-4">
                    <p className="text-2xl font-semibold text-white">{stat}</p>
                    <p className="text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel relative rounded-3xl overflow-hidden border border-accent/15">
              <Image
                key={heroSlides[heroSlideIndex].src}
                src={heroSlides[heroSlideIndex]}
                alt="Drone and hands-on learning in a classroom"
                width={1200}
                height={900}
                className="h-full w-full object-cover opacity-90 transition-opacity duration-700"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 space-y-3 bg-gradient-to-t from-white/80 via-white/40 to-transparent text-foreground backdrop-blur-[2px]">
                <div className="flex flex-wrap gap-2">
                  {["Drones", "Hands-on learning", "Self Assessment"].map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-full bg-white/70 text-sm text-accent-strong border border-accent/20 shadow-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="text-slate-800 text-sm font-bold">
                  Purpose-built content with videos, code files, and printable docs. Ready for admins
                  to manage and for learners to explore.
                </p>
                <div className="flex gap-2 pt-1">
                  {heroSlides.map((slide, index) => (
                    <span
                      key={slide.src}
                      className={`h-1.5 w-6 rounded-full border border-accent/20 transition-colors ${index === heroSlideIndex ? "bg-accent-strong" : "bg-accent/25"
                        }`}
                      aria-label={`Slide ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div id="home-block-2" data-scroll-block="showcase" className={getScrollBlockClassName("home-block-2")}>
        <div ref={card2ContainerRef} className="relative">
          {card2EditMode && (
            <div className="pointer-events-none absolute inset-0 z-0">
              <div
                className={`absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 ${card2GuideState.vertical ? "bg-accent-strong/80" : "bg-accent/35"
                  }`}
              />
              <div
                className={`absolute top-1/2 left-0 right-0 h-px -translate-y-1/2 ${card2GuideState.horizontal ? "bg-accent-strong/80" : "bg-accent/35"
                  }`}
              />
            </div>
          )}
          <section
            id="steamh-showcase"
            className="section-padding space-y-8"
          >
            <div
              ref={(node) => setCard2ItemRef("header", node)}
              style={getCard2ItemStyle("header")}
              className={getCard2ItemClassName("header")}
              onPointerDown={(event) => startCard2ItemDrag("header", event)}
              onPointerMove={moveCard2ItemDrag}
              onPointerUp={endCard2ItemDrag}
              onPointerCancel={endCard2ItemDrag}
            >
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-accent-strong uppercase text-xs tracking-[0.2em]">Open Access</p>
                  <h2 className="text-3xl font-semibold text-white">Student STEAM-H Showcase</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href="/steamh-projects"
                    className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-true-white shadow-glow hover:opacity-90"
                  >
                    View full gallery
                  </Link>
                  {isAuthed && isStudentLikeRole(userRole) ? (
                    <Link
                      href="/student/steamh-projects"
                      className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-true-white shadow-glow"
                    >
                      Upload your project
                    </Link>
                  ) : (
                    <Link
                      href="/login"
                      className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-true-white shadow-glow hover:opacity-90"
                    >
                      Student login to upload
                    </Link>
                  )}
                </div>
              </div>
            </div>
            <div
              ref={(node) => setCard2ItemRef("content", node)}
              style={getCard2ItemStyle("content")}
              className={getCard2ItemClassName("content")}
              onPointerDown={(event) => startCard2ItemDrag("content", event)}
              onPointerMove={moveCard2ItemDrag}
              onPointerUp={endCard2ItemDrag}
              onPointerCancel={endCard2ItemDrag}
            >
              {steamhLoading ? (
                <div className="grid md:grid-cols-3 gap-6">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="glass-panel rounded-2xl h-72 animate-pulse border border-accent/15 bg-white/70"
                    />
                  ))}
                </div>
              ) : steamhError ? (
                <div className="glass-panel rounded-2xl p-5">
                  <p className="text-sm text-rose-700">{steamhError}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    If this is a new deployment, apply `supabase/steamh_projects_patch.sql` in Supabase SQL Editor.
                  </p>
                </div>
              ) : steamhProjects.length === 0 ? (
                <div className="glass-panel rounded-2xl p-8 text-center">
                  <h3 className="text-xl font-semibold text-white">No published projects yet</h3>
                  <p className="mt-2 text-sm text-slate-300">Students can start publishing from their dashboard upload page.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {steamhProjects.map((project) => {
                      const coverUrl = resolveProjectCover(project);
                      return (
                        <article key={project.id} className="glass-panel h-full rounded-2xl border border-accent/15 bg-white/70 overflow-hidden">
                          <div className="grid h-full min-h-[248px] grid-cols-[40%_60%]">
                            <div className="relative h-full border-r border-accent/15 bg-gradient-to-br from-emerald-100 via-cyan-100 to-blue-100">
                              {coverUrl ? (
                                <Image
                                  src={coverUrl}
                                  alt={`${project.title} preview`}
                                  fill
                                  sizes="(max-width: 768px) 40vw, 38vw"
                                  className="object-cover object-left-top"
                                  unoptimized
                                />
                              ) : (
                                <div className="h-full w-full grid place-items-center text-4xl font-semibold text-accent-strong/60">
                                  {project.title.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>

                            <div className="p-5 space-y-3 flex flex-col">
                              <div className="flex flex-wrap gap-2">
                                {project.subject && (
                                  <span className="rounded-full border border-accent/25 bg-white px-2.5 py-1 text-[11px] font-semibold text-accent-strong">
                                    {project.subject}
                                  </span>
                                )}
                                <span className="rounded-full border border-accent/20 bg-white px-2.5 py-1 text-[11px] font-semibold text-accent-strong">
                                  Grade 11
                                </span>
                              </div>
                              <h3 className="truncate text-lg font-semibold leading-snug text-white">{project.title}</h3>
                              <p
                                className="text-sm leading-relaxed text-slate-300"
                                style={{
                                  display: "-webkit-box",
                                  WebkitLineClamp: 3,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                }}
                              >
                                {project.summary}
                              </p>

                              {project.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {project.tags.slice(0, 4).map((tag) => (
                                    <span
                                      key={`${project.id}-${tag}`}
                                      className="rounded-md border border-accent/15 bg-white/80 px-2 py-1 text-[11px] font-medium text-slate-700"
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div className="flex flex-wrap gap-2 text-xs">
                                {project.videoUrls.length > 0 && (
                                  <span className="rounded-full bg-white px-2.5 py-1 text-slate-700 border border-accent/15">
                                    {project.videoUrls.length} video demo
                                  </span>
                                )}
                              </div>
                              <div className="pt-1 mt-auto flex flex-wrap gap-2">
                                <Link
                                  href={`/steamh-projects/${encodeURIComponent(project.id)}`}
                                  className="inline-flex items-center justify-center rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-true-white shadow-glow hover:opacity-90"
                                >
                                  View
                                </Link>
                                <CollaborateButton
                                  href={buildProjectCollabPath(project.id)}
                                  label="Collaborate"
                                  compact
                                />
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  {steamhProjects.length >= 6 && (
                    <div className="flex w-full items-center py-1">
                      <span aria-hidden="true" className="pointer-events-none relative h-3 flex-1">
                        <span className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-[3px] bg-[#1e3932]/60 blur-[0.8px]" />
                        <span className="absolute inset-x-0 top-1/2 h-[2px] translate-y-[3px] bg-[#1e3932]/60 blur-[0.8px]" />
                      </span>
                      <Link
                        href="/steamh-projects"
                        className="relative mx-6 inline-flex items-center rounded-full border border-accent-strong/40 bg-gradient-to-r from-accent-strong to-accent px-6 py-2.5 text-sm font-semibold text-true-white shadow-[0_10px_24px_rgba(0,98,65,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(0,98,65,0.45)]"
                      >
                        View more projects
                      </Link>
                      <span aria-hidden="true" className="pointer-events-none relative h-3 flex-1">
                        <span className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-[3px] bg-[#1e3932]/60 blur-[0.8px]" />
                        <span className="absolute inset-x-0 top-1/2 h-[2px] translate-y-[3px] bg-[#1e3932]/60 blur-[0.8px]" />
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <div id="home-block-3" data-scroll-block="platform" className={getScrollBlockClassName("home-block-3")}>
        <section id="features" className="section-padding space-y-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-accent-strong uppercase text-xs tracking-[0.2em]">Platform</p>
              <h2 className="text-3xl font-semibold text-white">What makes us different</h2>
            </div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="group glass-panel rounded-t-2xl rounded-b-none border-2 border-accent-strong/40 bg-white/90 p-4 sm:p-5 space-y-4 overflow-hidden shadow-[0_14px_28px_rgba(15,23,42,0.14)]"
              >
                <div className="relative h-56 sm:h-64 overflow-hidden rounded-t-xl rounded-b-none border-2 border-accent-strong/25 bg-slate-100/85">
                  <Image
                    src={feature.imageSrc}
                    alt={feature.imageAlt}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover object-center transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/30 via-black/5 to-transparent" />
                  <span className="absolute left-3 top-3 rounded-full border border-white/60 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-strong">
                    {feature.focus}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white">{feature.title}</h3>
                <p className="text-slate-200 text-sm font-semibold leading-relaxed">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div id="home-block-4" data-scroll-block="remaining" className={getScrollBlockClassName("home-block-4")}>
        <div ref={card4ContainerRef} className="relative">
          {card4EditMode && (
            <div className="pointer-events-none absolute inset-0 z-0">
              <div
                className={`absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 ${card4GuideState.vertical ? "bg-accent-strong/80" : "bg-accent/35"
                  }`}
              />
              <div
                className={`absolute top-1/2 left-0 right-0 h-px -translate-y-1/2 ${card4GuideState.horizontal ? "bg-accent-strong/80" : "bg-accent/35"
                  }`}
              />
            </div>
          )}

          <div
            ref={(node) => setCard4ItemRef("testimonials", node)}
            style={getCard4ItemStyle("testimonials")}
            className={getCard4ItemClassName("testimonials")}
            onPointerDown={(event) => startCard4ItemDrag("testimonials", event)}
            onPointerMove={moveCard4ItemDrag}
            onPointerUp={endCard4ItemDrag}
            onPointerCancel={endCard4ItemDrag}
          >
            <section className="section-padding space-y-8">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-accent-strong uppercase text-xs tracking-[0.2em]">Testimonials</p>
                  <h2 className="text-3xl font-semibold text-white">Schools seeing results</h2>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                {testimonials.map((item) => (
                  <div key={item.name} className="glass-panel rounded-2xl p-6 space-y-3">
                    <p className="text-slate-300 text-sm leading-relaxed">&ldquo;{item.quote}&rdquo;</p>
                    <div className="pt-2 text-sm">
                      <p className="text-white font-semibold">{item.name}</p>
                      <p className="text-slate-400">{item.school}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div
            ref={(node) => setCard4ItemRef("bundles", node)}
            style={getCard4ItemStyle("bundles")}
            className={getCard4ItemClassName("bundles")}
            onPointerDown={(event) => startCard4ItemDrag("bundles", event)}
            onPointerMove={moveCard4ItemDrag}
            onPointerUp={endCard4ItemDrag}
            onPointerCancel={endCard4ItemDrag}
          >
            <section className="section-padding space-y-6">
              <div className="glass-panel rounded-3xl p-6 grid md:grid-cols-2 gap-6 items-center">
                <div>
                  <p className="text-accent-strong uppercase text-xs tracking-[0.2em]">Bundles</p>
                  <h3 className="text-2xl font-semibold text-white">Shopping made for schools</h3>
                  <p className="text-slate-300 text-sm mt-3">
                    Browse hardware that pairs with your curriculum. Add to cart, checkout, and track
                    orders with Supabase-powered fulfillment.
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {productHighlights.map((product) => (
                    <div key={product.name} className="rounded-2xl border border-accent/20 p-4 bg-white">
                      <p className="text-sm text-accent-strong">Featured</p>
                      <h4 className="text-white font-semibold mt-1">{product.name}</h4>
                      <p className="text-lg font-semibold text-white mt-2">{product.price}</p>
                      <p className="text-slate-400 text-sm mt-1">{product.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <div
            ref={(node) => setCard4ItemRef("footer", node)}
            style={getCard4ItemStyle("footer")}
            className={`${getCard4ItemClassName("footer")} bg-accent-strong`}
            onPointerDown={(event) => startCard4ItemDrag("footer", event)}
            onPointerMove={moveCard4ItemDrag}
            onPointerUp={endCard4ItemDrag}
            onPointerCancel={endCard4ItemDrag}
          >
            <footer
              id="contact"
              className="relative pt-[clamp(2rem,4vw,3.5rem)] px-[clamp(1.25rem,4vw,4rem)] border-t border-accent/70 bg-accent-strong mt-12 text-sm text-true-white"
              style={{ paddingBottom: `calc(clamp(1.25rem,2.5vw,2.25rem) + ${footerFillExtra}px)` }}
            >
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <p className="text-true-white font-semibold">
                    <span className="inline-block origin-left scale-110">Curriculum Dashboard</span>
                  </p>
                  <p>Made for STEM programs focused on drones, innovation, and hands-on learning.</p>
                </div>
                <div id="company-details" className="space-y-2 scroll-mt-28">
                  <p className="text-true-white font-semibold">Company</p>
                  <button
                    type="button"
                    onClick={() => toggleFooterItem("about")}
                    className="block text-left text-true-white hover:text-true-white/90"
                    aria-expanded={footerExpanded === "about"}
                  >
                    About Us
                  </button>
                  {footerExpanded === "about" && (
                    <p className="text-xs leading-relaxed rounded-xl border border-white/30 bg-accent-strong/55 p-3">
                      AerohawX helps students learn STEM through practical drone activities, guided
                      projects, and real-world problem solving. Our goal is to make learning active,
                      creative, and future-ready.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleFooterItem("contact")}
                    className="block text-left text-true-white hover:text-true-white/90"
                    aria-expanded={footerExpanded === "contact"}
                  >
                    Contact
                  </button>
                  {footerExpanded === "contact" && (
                    <div className="text-xs leading-relaxed rounded-xl border border-white/30 bg-accent-strong/55 p-3 space-y-1">
                      <p>
                        Email:{" "}
                        <a href="mailto:connectaerohawx@gmail.com" className="text-true-white hover:text-true-white/90">
                          connectaerohawx@gmail.com
                        </a>
                      </p>
                      <p>
                        Contact Number:{" "}
                        <a href="tel:+918573079779" className="text-true-white hover:text-true-white/90">
                          +91 8573079779
                        </a>
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-true-white font-semibold">Legal</p>
                  <button
                    type="button"
                    onClick={() => toggleFooterItem("privacy")}
                    className="block text-left text-true-white hover:text-true-white/90"
                    aria-expanded={footerExpanded === "privacy"}
                  >
                    Privacy Policy
                  </button>
                  {footerExpanded === "privacy" && (
                    <p className="text-xs leading-relaxed rounded-xl border border-white/30 bg-accent-strong/55 p-3">
                      We collect only the information needed to run and improve the platform, including
                      account details, learning progress, and support messages. We do not sell personal
                      data.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleFooterItem("terms")}
                    className="block text-left text-true-white hover:text-true-white/90"
                    aria-expanded={footerExpanded === "terms"}
                  >
                    Terms of Service
                  </button>
                  {footerExpanded === "terms" && (
                    <p className="text-xs leading-relaxed rounded-xl border border-white/30 bg-accent-strong/55 p-3">
                      Users agree to use AerohawX responsibly for educational purposes and follow
                      school/program policies. Platform features may be updated over time.
                    </p>
                  )}
                </div>
              </div>
              <div
                className={`absolute right-[clamp(0.9rem,3.2vw,3.25rem)] top-[clamp(1.35rem,3.1vw,2.7rem)] z-10 hidden lg:flex ${INDUS_LOGO_DRAG_ENABLED ? "touch-none cursor-grab active:cursor-grabbing select-none" : ""
                  }`}
                style={{ transform: `translate(${indusLogoPosition.x}px, ${indusLogoPosition.y}px)` }}
                onPointerDown={INDUS_LOGO_DRAG_ENABLED ? startIndusLogoDrag : undefined}
                onPointerMove={INDUS_LOGO_DRAG_ENABLED ? moveIndusLogoDrag : undefined}
                onPointerUp={INDUS_LOGO_DRAG_ENABLED ? endIndusLogoDrag : undefined}
                onPointerCancel={INDUS_LOGO_DRAG_ENABLED ? endIndusLogoDrag : undefined}
                onDragStart={INDUS_LOGO_DRAG_ENABLED ? (event) => event.preventDefault() : undefined}
                aria-label="Drag Indus Trust logo"
                title="Drag to position logo"
              >
                <Image
                  src={indusTrustLogo}
                  alt="Indus Trust logo"
                  width={105}
                  height={42}
                  draggable={false}
                  className="pointer-events-none h-auto w-[105px] rounded-xl border border-white/25 object-contain shadow-[0_8px_20px_rgba(0,0,0,0.2)]"
                />
              </div>
              <div className="mt-8 border-t border-white/30 pt-4 flex items-center justify-center gap-3 text-xs uppercase tracking-[0.2em] text-true-white/85">
                <div className="flex items-center gap-2">
                  {footfallDisplay.split("").map((digit, index) => (
                    <span
                      key={`${digit}-${index}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/70 bg-white text-black text-base font-semibold tracking-normal shadow-glow"
                    >
                      {digit}
                    </span>
                  ))}
                </div>
                <span className="text-[10px] text-true-white/80">visits</span>
              </div>
              {FOOTER_FILL_DRAG_ENABLED && (
                <div className="mt-4 flex items-center justify-center">
                  <button
                    type="button"
                    onPointerDown={startFooterFillDrag}
                    onPointerMove={moveFooterFillDrag}
                    onPointerUp={endFooterFillDrag}
                    onPointerCancel={endFooterFillDrag}
                    className="inline-flex items-center rounded-full border border-white/40 bg-accent-strong/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-true-white/90 touch-none cursor-ns-resize select-none"
                    title="Drag up or down to adjust dark footer space"
                    aria-label="Drag to adjust dark footer space"
                  >
                    Drag To Extend Footer
                  </button>
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pr-44 text-xs text-true-white/70">
                <p>&copy; {new Date().getFullYear()} AerohawX. All rights reserved.</p>
                <div className="flex items-center gap-2">
                  <a
                    href="https://www.linkedin.com/company/aerohawx/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="AerohawX LinkedIn"
                    className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-md ring-1 ring-white/30 transition-transform hover:-translate-y-0.5 hover:scale-105"
                  >
                    <Image
                      src="/social/linkedin-square.svg"
                      alt="LinkedIn logo"
                      width={32}
                      height={32}
                      className="h-full w-full object-cover"
                    />
                  </a>
                  <a
                    href="mailto:connectaerohawx@gmail.com"
                    aria-label="AerohawX Gmail"
                    className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-md ring-1 ring-white/30 transition-transform hover:-translate-y-0.5 hover:scale-105"
                  >
                    <Image
                      src="/social/gmail-square.svg"
                      alt="Gmail logo"
                      width={32}
                      height={32}
                      className="h-full w-full object-cover"
                    />
                  </a>
                  <a
                    href="https://x.com/aerohawx"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="AerohawX on X"
                    className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-md ring-1 ring-white/30 transition-transform hover:-translate-y-0.5 hover:scale-105"
                  >
                    <Image
                      src="/social/x-square.svg"
                      alt="X logo"
                      width={32}
                      height={32}
                      className="h-full w-full object-cover"
                    />
                  </a>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </div>

      <div
        className="fixed z-50 transition-[opacity,transform] duration-300 ease-out"
        style={{
          bottom: `${eagleWidgetPosition.bottom}px`,
          right: `${eagleWidgetPosition.right}px`,
          opacity:
            eagleWidgetReady &&
              !chatOpen &&
              !eagleWidgetDismissed &&
              !eagleWidgetCollapsedByScroll
              ? 1
              : 0,
          transform: !eagleWidgetReady
            ? "translateY(44px) scale(0.76)"
            : chatOpen || eagleWidgetCollapsedByScroll
              ? "translateY(18px) scale(0.82)"
              : "translateY(0) scale(1)",
          transformOrigin: "bottom right",
          pointerEvents:
            eagleWidgetReady &&
              !chatOpen &&
              !eagleWidgetDismissed &&
              !eagleWidgetCollapsedByScroll
              ? "auto"
              : "none",
        }}
      >
        <div className="relative h-40 w-40">
          <button
            type="button"
            className={`h-40 w-40 ${EAGLE_WIDGET_DRAG_ENABLED ? "touch-none cursor-grab active:cursor-grabbing select-none" : ""}`}
            onPointerDown={startEagleWidgetDrag}
            onPointerMove={moveEagleWidgetDrag}
            onPointerUp={endEagleWidgetDrag}
            onPointerCancel={endEagleWidgetDrag}
            onClick={(event) => {
              if (suppressEagleClickRef.current) {
                suppressEagleClickRef.current = false;
                event.preventDefault();
                return;
              }
              openAssistantChat("eagle");
            }}
            aria-label="Open assistant chat"
          >
            <Image
              src={eagleAssistant}
              alt="Eagle assistant"
              width={168}
              height={168}
              className={`h-40 w-40 object-contain drop-shadow-[0_8px_20px_rgba(0,98,65,0.25)] ${!eagleSpeechReady ? "eagle-wave" : ""
                }`}
              priority={false}
            />
          </button>
          <div
            className="pointer-events-none absolute whitespace-nowrap rounded-[18px] border-2 border-accent/35 bg-white/95 px-3.5 py-2 text-xs font-semibold text-accent-strong shadow-[0_10px_22px_rgba(0,98,65,0.2)]"
            style={{ right: `${eagleBubblePosition.right}px`, top: `${eagleBubblePosition.top}px` }}
          >
            {eagleSpeechReady ? (
              <span className="text-sm font-bold">I&apos;m Eagle. Here to help you.</span>
            ) : (
              <span className="inline-flex min-h-[16px] items-center gap-1" aria-label="Eagle is typing">
                <span className="sr-only">Eagle is typing</span>
                <span className="h-1.5 w-1.5 rounded-full bg-accent-strong animate-bounce" />
                <span className="h-1.5 w-1.5 rounded-full bg-accent-strong animate-bounce" style={{ animationDelay: "120ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-accent-strong animate-bounce" style={{ animationDelay: "240ms" }} />
              </span>
            )}
          </div>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute h-2.5 w-2.5 rounded-full border border-accent/20 bg-white shadow-[0_4px_10px_rgba(0,98,65,0.12)]"
            style={{ right: `${eagleBubblePosition.right - 9}px`, top: `${eagleBubblePosition.top + 30}px` }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute h-1.5 w-1.5 rounded-full border border-accent/20 bg-white"
            style={{ right: `${eagleBubblePosition.right - 17}px`, top: `${eagleBubblePosition.top + 40}px` }}
          />
          {EAGLE_BUBBLE_DRAG_ENABLED && (
            <>
              <button
                type="button"
                aria-label="Drag Eagle bubble"
                className="absolute rounded-full border border-accent/30 bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-accent-strong shadow-[0_6px_14px_rgba(0,98,65,0.18)] touch-none cursor-grab active:cursor-grabbing select-none"
                style={{ right: `${eagleBubblePosition.right - 10}px`, top: `${eagleBubblePosition.top - 14}px` }}
                onPointerDown={startEagleBubbleDrag}
                onPointerMove={moveEagleBubbleDrag}
                onPointerUp={endEagleBubbleDrag}
                onPointerCancel={endEagleBubbleDrag}
              >
                Drag
              </button>
              <span
                aria-label="Eagle bubble position"
                className="absolute rounded-md border border-accent/20 bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-accent-strong shadow-[0_4px_10px_rgba(0,98,65,0.14)] select-none"
                style={{ right: `${eagleBubblePosition.right - 46}px`, top: `${eagleBubblePosition.top - 36}px` }}
              >
                T:{eagleBubblePosition.top} R:{eagleBubblePosition.right}
              </span>
            </>
          )}
        </div>
      </div>

      <button
        className="fixed bottom-6 right-6 h-12 px-5 rounded-full bg-accent text-slate-50 font-semibold ring-2 ring-accent/30 shadow-[0_12px_30px_rgba(0,98,65,0.35)] hover:ring-accent/50 hover:shadow-[0_16px_40px_rgba(0,98,65,0.45)] hover:-translate-y-1 transition-transform transition-shadow flex items-center gap-2 z-50"
        onClick={() => openAssistantChat("button")}
      >
        Need help?
      </button>

      {faqOpen && (
        <div className="fixed top-1/2 right-14 -translate-y-1/2 w-72 rounded-2xl border border-accent/20 bg-white/95 backdrop-blur-md shadow-2xl p-4 space-y-3 z-50">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-accent-strong">Quick FAQ</p>
            <button
              className="h-8 w-8 rounded-full border border-accent/20 text-accent-strong grid place-items-center bg-white"
              onClick={() => setFaqOpen(false)}
              aria-label="Close FAQ"
            >
              x
            </button>
          </div>
          <div className="space-y-2 text-sm text-slate-700">
            <div>
              <p className="font-semibold text-foreground">How do I get a demo?</p>
              <p>Use &ldquo;Talk to sales&rdquo; and we&apos;ll share a guided walkthrough.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Can students self-learn?</p>
              <p>Yes. Modules include videos, docs, and code for independent practice.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Do you support schools?</p>
              <p>We onboard districts with admin controls and class-ready kits.</p>
            </div>
          </div>
        </div>
      )}

      <button
        className="fixed right-1 h-24 w-10 border border-accent-strong/30 bg-[#0b1d36] text-slate-50 text-sm shadow-[0_10px_24px_rgba(11,29,54,0.28)] hover:bg-[#11264a] transition-colors z-50 rotate-180 [writing-mode:vertical-rl] tracking-wide rounded-xl touch-none cursor-grab active:cursor-grabbing select-none"
        style={{ top: `${faqTabTop ?? FAQ_TAB_MARGIN}px` }}
        onPointerDown={startFaqTabDrag}
        onPointerMove={moveFaqTabDrag}
        onPointerUp={endFaqTabDrag}
        onPointerCancel={endFaqTabDrag}
        onClick={(event) => {
          if (suppressFaqClickRef.current) {
            suppressFaqClickRef.current = false;
            event.preventDefault();
            return;
          }
          setFaqOpen((v) => !v);
          setChatOpen(false);
        }}
      >
        Quick FAQ
      </button>

      {chatOpen && (
        <div className="fixed bottom-24 right-6 w-80 rounded-2xl border border-accent/20 bg-white p-3 z-40 space-y-3 shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-accent-strong uppercase tracking-[0.2em]">Assistant</p>
              <p className="text-white font-semibold">How may I help you today?</p>
            </div>
            <button
              className="h-8 w-8 rounded-full border border-accent/30 text-accent-strong grid place-items-center bg-white"
              onClick={() => setChatOpen(false)}
              aria-label="Close chat"
            >
              x
            </button>
          </div>
          <div className="h-56 overflow-auto space-y-2 pr-1">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`rounded-xl px-3 py-2 text-sm ${msg.role === "user"
                    ? "bg-accent text-slate-50 ml-auto max-w-[85%]"
                    : "bg-white text-slate-900 mr-auto max-w-[90%] border border-accent/20"
                  }`}
              >
                {msg.content}
              </div>
            ))}
            {chatLoading && <p className="text-xs text-slate-400">Thinking...</p>}
          </div>
          <div className="flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              className="flex-1 rounded-lg bg-white border border-accent/20 px-3 py-2 text-sm text-slate-900"
              placeholder="Ask about curriculum, shopping, dashboards..."
            />
            <button
              className="px-3 py-2 rounded-lg bg-accent text-slate-50 font-semibold shadow-glow disabled:opacity-60"
              onClick={sendMessage}
              disabled={chatLoading}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {contactOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setContactOpen(false)}
            aria-label="Close contact form"
          />
          <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[420px] bg-white border-l border-accent/20 shadow-2xl p-6 flex flex-col gap-4 transition-transform duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-accent-strong uppercase tracking-[0.2em]">Talk to sales</p>
                <p className="text-lg font-semibold text-foreground">We&apos;ll reach out within a day</p>
              </div>
              <button
                className="h-9 w-9 rounded-full border border-accent/20 text-accent-strong grid place-items-center bg-white"
                onClick={() => setContactOpen(false)}
                aria-label="Close contact form"
              >
                x
              </button>
            </div>
            <div className="space-y-3">
              <input
                value={contactForm.name}
                onChange={(e) => {
                  setContactSubmitted(false);
                  setContactError(null);
                  setContactForm((prev) => ({ ...prev, name: e.target.value }));
                }}
                className="w-full rounded-xl border border-accent/20 bg-white/80 px-3 py-2 text-sm text-foreground placeholder:text-slate-400 focus:border-accent-strong outline-none"
                placeholder="Your name"
              />
              <input
                value={contactForm.email}
                onChange={(e) => {
                  setContactSubmitted(false);
                  setContactError(null);
                  setContactForm((prev) => ({ ...prev, email: e.target.value }));
                }}
                className="w-full rounded-xl border border-accent/20 bg-white/80 px-3 py-2 text-sm text-foreground placeholder:text-slate-400 focus:border-accent-strong outline-none"
                placeholder="Work email"
              />
              <input
                value={contactForm.school}
                onChange={(e) => {
                  setContactSubmitted(false);
                  setContactError(null);
                  setContactForm((prev) => ({ ...prev, school: e.target.value }));
                }}
                className="w-full rounded-xl border border-accent/20 bg-white/80 px-3 py-2 text-sm text-foreground placeholder:text-slate-400 focus:border-accent-strong outline-none"
                placeholder="School / organization (optional)"
              />
              <textarea
                value={contactForm.message}
                onChange={(e) => {
                  setContactSubmitted(false);
                  setContactError(null);
                  setContactForm((prev) => ({ ...prev, message: e.target.value }));
                }}
                className="w-full rounded-xl border border-accent/20 bg-white/80 px-3 py-2 text-sm text-foreground placeholder:text-slate-400 focus:border-accent-strong outline-none h-28 resize-none"
                placeholder="What do you need? e.g., curriculum demo, pricing, onboarding..."
              />
            </div>
            {contactError && (
              <div className="rounded-xl bg-red-100 border border-red-200 px-3 py-2 text-sm text-red-700">
                {contactError}
              </div>
            )}
            {contactSubmitted && (
              <div className="rounded-xl bg-accent/10 border border-accent/20 px-3 py-2 text-sm text-accent-strong">
                Got it! We&apos;ll email you with next steps.
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">We respond within 1 business day.</p>
              <button
                className="px-4 py-2 rounded-full bg-accent text-slate-50 font-semibold shadow-glow disabled:opacity-60"
                onClick={submitContact}
                disabled={contactSubmitted || contactSubmitting}
              >
                {contactSubmitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {panelVisible && (
        <div className="fixed inset-0 z-50">
          <div
            className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${panelOpen ? "opacity-100" : "opacity-0"
              }`}
            onClick={closePanel}
          />
          <div
            className={`absolute right-0 top-0 bottom-0 w-72 bg-surface border-l border-accent/20 shadow-2xl p-6 flex flex-col gap-4 transition-transform duration-400 ${panelOpen ? "translate-x-0" : "translate-x-full"
              }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold text-white">Quick Access</p>
              <button
                aria-label="Close panel"
                onClick={closePanel}
                className="h-9 w-9 rounded-full border border-accent/20 grid place-items-center text-white"
              >
                x
              </button>
            </div>
            <Link
              href="/shop"
              className="w-full px-4 py-3 rounded-xl bg-accent text-slate-50 font-semibold text-center"
              onClick={closePanel}
            >
              Shopping
            </Link>
            <Link
              href="/steamh-projects"
              className="w-full px-4 py-3 rounded-xl border border-accent/20 text-white text-center hover:border-accent-strong"
              onClick={closePanel}
            >
              STEAM-H Showcase
            </Link>
            <Link
              href="/settings"
              className="w-full px-4 py-3 rounded-xl border border-accent/20 text-white text-center hover:border-accent-strong"
              onClick={closePanel}
            >
              Settings
            </Link>
            <Link
              href="#contact"
              className="w-full px-4 py-3 rounded-xl border border-accent/20 text-white text-center hover:border-accent-strong"
              onClick={closePanel}
            >
              Contact
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
