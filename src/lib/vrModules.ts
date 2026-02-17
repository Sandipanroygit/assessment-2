export const VR_SUBJECT_ORDER = [
  "Physics",
  "Chemistry",
  "Mathematics",
  "ESS",
  "Biology",
] as const;

export type VrSubjectKey = (typeof VR_SUBJECT_ORDER)[number];

export const DEFAULT_VR_SIMULATION_LIBRARY: Record<VrSubjectKey, string[]> = {
  Physics: [
    "Factors Affecting Resistance of Conductor (Length, Area, Material)",
    "Resistance of Resistors (Series & Parallel)",
    "Understanding Resistance & Ohm's Law",
    "Heating Effect of Electric Current & Applications",
    "Understanding Refraction of Light",
    "Refractive Index & Snell's Law",
    "Understanding Mass & Weight",
    "Pressure in Solids, Liquids & Pressure at Work",
    "Classification of Forces (I, II)",
    "Newton's First Law of Motion",
    "Understanding Archimedes' Principle",
    "Understanding Kepler's Law",
  ],
  Chemistry: [
    "Understanding Ionic Compounds",
    "Properties of Ionic Compounds",
    "Structural Integrity and Thermal Stability",
    "Solubility",
    "Electrical Conductivity",
    "Physical Properties of Metals",
    "Hardness and Lustre",
    "Malleability and Ductility",
    "Conductivity",
    "Particle Nature of Matter (I, II)",
    "States of Matter (Solid, Liquid, Gas)",
    "Interconversion of States of Matter",
    "Fusion and Solidification",
    "Vaporisation and Condensation",
    "Atomic Number and Mass Number",
    "Isotopes and Isobars",
    "Atomic Models",
    "Rutherford",
    "J.J. Thomson",
    "Bohr",
    "Valency and VSEPR Theory (Concept and Applications I-III)",
    "Hybridisation",
    "sp, sp2, sp3, sp3d",
    "Conformational Isomers",
    "Ethane",
    "n-Butane",
    "Cyclohexane",
    "SN1 and SN2 Reaction Mechanisms",
    "Atoms, Elemental Molecules and Compounds",
    "Pure Substances and Mixtures",
    "Classification of Pure Substances and Mixtures",
  ],
  Mathematics: [
    "Understanding Coordinate Geometry",
    "Right Circular Cone",
    "Surface Area",
    "Volume (visualization)",
    "Visualizing the Volume of a Sphere",
  ],
  ESS: [
    "Traditional Water Conservation: Rainwater Harvesting",
    "Modern Water Conservation: Rainwater Harvesting",
    "Easter Island",
    "Indus Valley Civilization",
    "Cultural Legacy of the Indus Valley Civilization",
    "Mission Chandrayaan",
    "India Gate and National War Memorial",
    "Taj Mahal",
    "Lotus Temple",
  ],
  Biology: [
    "Anatomy of Skeletal Muscle and Function",
    "Contractile Proteins and Sarcomere",
    "Mechanism of Muscle Contraction (Sliding Filament Theory)",
    "Structure of DNA (I and II)",
  ],
};

export const isDesignTechnologySubject = (subject?: string | null) => {
  if (!subject) return false;
  const normalized = subject.trim().toLowerCase();
  return normalized.includes("design") || normalized.includes("tech") || normalized.includes("d&t");
};

export const normalizeVrSubjectKey = (subject?: string | null): VrSubjectKey | null => {
  if (!subject) return null;
  const normalized = subject.trim().toLowerCase();
  if (normalized.includes("physics") || normalized === "phy") return "Physics";
  if (normalized.includes("chem")) return "Chemistry";
  if (normalized.includes("math")) return "Mathematics";
  if (normalized.includes("ess") || normalized.includes("environment")) return "ESS";
  if (normalized.includes("bio") || normalized.includes("life")) return "Biology";
  return null;
};

export const dedupeAndSortModuleNames = (items: string[]) =>
  Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }),
  );
