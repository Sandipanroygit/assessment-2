"use client";

import { useMemo, useState, type CSSProperties } from "react";

type GradeLevel = 9 | 10 | 11 | 12;

type SimulationLink = {
  title: string;
  provider: string;
  url: string;
  grades: GradeLevel[];
  focus: string;
};

type SubjectSimulationGroup = {
  subject: string;
  simulations: SimulationLink[];
};

type AssignSimulationPayload = {
  subject: string;
  simulation: SimulationLink;
};

type SimulationLibraryViewProps = {
  enableTeacherAssign?: boolean;
  onAssignSimulation?: (payload: AssignSimulationPayload) => void;
  studentOnlyView?: boolean;
  studentAssignedButton?: {
    label: string;
    onClick: () => void;
    count?: number;
    ring?: boolean;
  } | null;
};

const ALL_GRADES: GradeLevel[] = [9, 10, 11, 12];

const titleFromSlug = (slug: string) =>
  slug
    .split("-")
    .map((part) => {
      if (part.toLowerCase() === "ac") return "AC";
      if (part.toLowerCase() === "2d") return "2D";
      if (!part) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");

const ck12FocusFromSlug = (stream: "physics" | "chemistry", slug: string) => {
  const moduleTitle = titleFromSlug(slug);
  if (stream === "physics") {
    return `${moduleTitle} module for core physics concepts`;
  }
  return `${moduleTitle} module for core chemistry concepts`;
};

const buildCk12Simulation = (
  stream: "physics" | "chemistry",
  slug: string,
  grades: GradeLevel[] = ALL_GRADES,
): SimulationLink => ({
  title: titleFromSlug(slug),
  provider: "CK-12 Simulations",
  url: `https://interactives.ck12.org/simulations/${stream}/${slug}/app/index.html`,
  grades,
  focus: ck12FocusFromSlug(stream, slug),
});

const CK12_PHYSICS_SIMULATIONS: SimulationLink[] = [
  "ac-transformer",
  "airplane",
  "archery",
  "astronaut-training-chamber",
  "atomic-colors",
  "ballistics-tests",
  "black-hole",
  "block-and-tackle",
  "bobsled",
  "bow-and-arrow",
  "bowling-alley",
  "bumper-cars",
  "butterfly-stroke",
  "cassegrain-telescope",
  "centripetal-force",
  "clarkes-dream",
  "cliff-diver",
  "collisions",
  "contact-lens",
  "coulombs-law",
  "crash-test-dummy",
  "diamond-cut",
  "dollhouse",
  "doorbell",
  "doppler-ducks",
  "drawbridge",
  "driverless-car",
  "electric-analogies",
  "electric-field",
  "electric-motor",
  "elevator",
  "everglades-airboat",
  "field-lines",
  "first-law",
  "flashing-neon-light",
  "galvanometer",
  "heat-engine",
  "high-energy-particles",
  "horse-and-cart",
  "hot-air-balloon",
  "hot-oven",
  "irwin-2d",
  "irwin-and-ruthie",
  "journey-to-mars",
  "least-time",
  "lightning-rod",
  "light-wave",
  "loop-the-loop",
  "magnifying-glass",
  "malt-shop",
  "marie-curies-classroom",
  "marquee-lights",
  "model-rocket",
  "newtons-apple",
  "newtons-cannon",
  "orbital-motion",
  "pan-flute",
  "particle-tracks",
  "phases-of-the-moon",
  "pirate-ship",
  "portrait-gallery",
  "power-lines",
  "prom-night",
  "touch-screen",
  "unicycle",
  "yo-yo",
].map((slug) => buildCk12Simulation("physics", slug));

const CK12_CHEMISTRY_SIMULATIONS: SimulationLink[] = [
  "atom-builder",
  "average-atomic-mass",
  "balancing-chemical-equations",
  "boiling-point",
  "campout",
  "decomposition-reaction",
  "density",
  "diffusion",
  "exothermic-and-endothermic",
  "freezing-point",
  "gold-foil",
  "intermolecular-forces",
  "kinetic-theory",
  "le-chateliers-principle",
  "mole-carnival",
  "phases-of-matter",
  "redox-reaction",
  "soap",
  "solubility",
  "states-of-matter",
  "what-is-air",
].map((slug) => buildCk12Simulation("chemistry", slug));

const SIMULATION_LIBRARY: SubjectSimulationGroup[] = [
  {
    subject: "Physics",
    simulations: [
      {
        title: "Projectile Motion",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/projectile-motion",
        grades: [9, 10, 11, 12],
        focus: "Kinematics and vectors",
      },
      {
        title: "Forces and Motion Basics",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/forces-and-motion-basics",
        grades: [9, 10, 11],
        focus: "Newtonian mechanics",
      },
      {
        title: "Energy Skate Park Basics",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/energy-skate-park-basics",
        grades: [9, 10, 11, 12],
        focus: "Potential and kinetic energy",
      },
      {
        title: "Wave on a String",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/wave-on-a-string",
        grades: [9, 10, 11, 12],
        focus: "Waves and frequency",
      },
      {
        title: "Young's Double Slit Experiment",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/wave-interference",
        grades: [10, 11, 12],
        focus: "Interference, diffraction, and YDSE fringe formation",
      },
      {
        title: "Young's Double Slit",
        provider: "Virtual Labs",
        url: "https://ep2-iitb.vlabs.ac.in/exp/young-double-slit/simulation.html",
        grades: [11, 12],
        focus: "Measure wavelength using YDSE parameters and fringe positions",
      },
      {
        title: "Double Slit Interference",
        provider: "GeoGebra",
        url: "https://www.geogebra.org/m/ynwgtfk8",
        grades: [10, 11, 12],
        focus: "Interference + diffraction profile in Young's double slit experiment",
      },
      {
        title: "Interference at a Double Slit",
        provider: "Walter Fendt",
        url: "https://www.walter-fendt.de/html5/phen/doubleslit_en.htm",
        grades: [10, 11, 12],
        focus: "Classical YDSE maxima/minima with parameter controls",
      },
      {
        title: "Young's Double Slit Simulation",
        provider: "JavaLab",
        url: "https://javalab.org/en/youngs_double_slit_en/",
        grades: [10, 11, 12],
        focus: "Adjust slit spacing, wavelength, and screen distance",
      },
      {
        title: "Ripple Tank Double Slit Setup",
        provider: "Falstad",
        url: "https://www.falstad.com/ripple/",
        grades: [9, 10, 11, 12],
        focus: "Wave interference/diffraction; use Setup -> Double Slit",
      },
      {
        title: "Circuit Construction Kit (DC)",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/circuit-construction-kit-dc",
        grades: [9, 10, 11, 12],
        focus: "Current, voltage, and resistance",
      },
      {
        title: "Gravity Force Lab",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/gravity-force-lab",
        grades: [10, 11, 12],
        focus: "Gravitational force",
      },
      {
        title: "Understanding Resistance & Ohm's Law",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/ohms-law",
        grades: [10, 11, 12],
        focus: "I-V relationships",
      },
      {
        title: "Resistance of Resistors (Series & Parallel)",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/circuit-construction-kit-dc#series-parallel",
        grades: [9, 10, 11, 12],
        focus: "Equivalent resistance in series and parallel combinations",
      },
      {
        title: "Heating Effect of Electric Current & Applications",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/resistance-in-a-wire",
        grades: [9, 10, 11, 12],
        focus: "Dependence on resistance/temperature and Joule heating context",
      },
      {
        title: "Pendulum Lab",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/pendulum-lab",
        grades: [10, 11, 12],
        focus: "Periodic motion",
      },
      {
        title: "Faraday's Electromagnetic Lab",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/faradays-electromagnetic-lab",
        grades: [11, 12],
        focus: "Electromagnetic induction",
      },
      {
        title: "Pressure in Solids, Liquids & Pressure at Work",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/under-pressure",
        grades: [10, 11, 12],
        focus: "Pressure concepts in solids/liquids and real-life applications",
      },
      {
        title: "MyPhysicsLab",
        provider: "MyPhysicsLab",
        url: "https://www.myphysicslab.com/",
        grades: [11, 12],
        focus: "Advanced mechanics simulations",
      },
      {
        title: "HTML5 Physics Simulations",
        provider: "Walter Fendt",
        url: "https://www.walter-fendt.de/html5/phen/",
        grades: [9, 10, 11, 12],
        focus: "Topic-wise physics interactives",
      },
      {
        title: "Virtual Labs India",
        provider: "vLab",
        url: "https://www.vlab.co.in/",
        grades: [9, 10, 11, 12],
        focus: "Virtual experiments for school and engineering science",
      },
      {
        title: "OLabs Virtual Labs",
        provider: "OLabs",
        url: "https://www.olabs.edu.in/",
        grades: [9, 10, 11, 12],
        focus: "School-level practical simulations",
      },
      {
        title: "Charge Launcher",
        provider: "ExploreLearning Gizmos",
        url: "https://gizmos.explorelearning.com/find-gizmos/launch-gizmo?resourceId=632",
        grades: [9, 10, 11, 12],
        focus: "Electrostatics and particle trajectory (free list / timed guest)",
      },
      ...CK12_PHYSICS_SIMULATIONS,
    ],
  },
  {
    subject: "Chemistry",
    simulations: [
      {
        title: "Balancing Chemical Equations",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/balancing-chemical-equations",
        grades: [9, 10, 11],
        focus: "Stoichiometry basics",
      },
      {
        title: "Concentration",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/concentration",
        grades: [10, 11, 12],
        focus: "Solutions and molarity",
      },
      {
        title: "Molecule Shapes",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/molecule-shapes",
        grades: [10, 11, 12],
        focus: "VSEPR theory",
      },
      {
        title: "pH Scale",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/ph-scale",
        grades: [9, 10, 11, 12],
        focus: "Acids and bases",
      },
      {
        title: "Reactants, Products and Leftovers",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/reactants-products-and-leftovers",
        grades: [9, 10, 11],
        focus: "Reaction ratios",
      },
      {
        title: "Beer's Law Lab",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/beers-law-lab",
        grades: [11, 12],
        focus: "Absorbance and concentration",
      },
      {
        title: "Build a Molecule",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/build-a-molecule",
        grades: [9, 10],
        focus: "Chemical formulas and bonding",
      },
      {
        title: "States of Matter Basics",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/states-of-matter-basics",
        grades: [9, 10],
        focus: "Particle model",
      },
      {
        title: "Molarity",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/molarity",
        grades: [11, 12],
        focus: "Moles and concentration",
      },
      {
        title: "Acid-Base Solutions",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/acid-base-solutions",
        grades: [10, 11, 12],
        focus: "Strong/weak acids and bases",
      },
      {
        title: "Virtual Chemistry Lab",
        provider: "ChemCollective",
        url: "https://chemcollective.org/vlab",
        grades: [11, 12],
        focus: "Virtual experiments",
      },
      {
        title: "MolView",
        provider: "MolView",
        url: "https://molview.org/",
        grades: [10, 11, 12],
        focus: "Molecular visualization",
      },
      {
        title: "Periodic Trends",
        provider: "ExploreLearning Gizmos",
        url: "https://gizmos.explorelearning.com/find-gizmos/launch-gizmo?resourceId=1077",
        grades: [10, 11, 12],
        focus: "Atomic radius and ionization trends (free list / timed guest)",
      },
      ...CK12_CHEMISTRY_SIMULATIONS,
    ],
  },
  {
    subject: "Biology",
    simulations: [
      {
        title: "Natural Selection",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/natural-selection",
        grades: [9, 10, 11, 12],
        focus: "Evolution and adaptation",
      },
      {
        title: "Gene Expression Essentials",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/gene-expression-essentials",
        grades: [11, 12],
        focus: "Gene regulation",
      },
      {
        title: "Membrane Channels",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/membrane-channels",
        grades: [10, 11, 12],
        focus: "Cell transport",
      },
      {
        title: "Neuron",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/neuron",
        grades: [11, 12],
        focus: "Nerve impulse transmission",
      },
      {
        title: "LabXchange Biology Library",
        provider: "LabXchange",
        url: "https://labxchange.org/library",
        grades: [9, 10, 11, 12],
        focus: "Biology labs and interactives",
      },
      {
        title: "Concord Modeler",
        provider: "Concord Consortium",
        url: "https://mw.concord.org/modeler/",
        grades: [10, 11, 12],
        focus: "Biology and chemistry model-based labs",
      },
      {
        title: "NetLogo Web",
        provider: "Northwestern University",
        url: "https://www.netlogoweb.org/",
        grades: [11, 12],
        focus: "Population and ecosystem models",
      },
      {
        title: "OneZoom Tree of Life",
        provider: "OneZoom",
        url: "https://www.onezoom.org/",
        grades: [9, 10, 11, 12],
        focus: "Biodiversity exploration",
      },
      {
        title: "HHMI BioInteractive",
        provider: "BioInteractive",
        url: "https://www.biointeractive.org/",
        grades: [9, 10, 11, 12],
        focus: "Biology simulations and interactive resources",
      },
      {
        title: "DNA Profiling",
        provider: "ExploreLearning Gizmos",
        url: "https://gizmos.explorelearning.com/find-gizmos/launch-gizmo?resourceId=1092",
        grades: [11, 12],
        focus: "Genetics and forensic biology (free list / timed guest)",
      },
      {
        title: "Virus Lytic Cycle",
        provider: "ExploreLearning Gizmos",
        url: "https://gizmos.explorelearning.com/find-gizmos/launch-gizmo?resourceId=448",
        grades: [10, 11, 12],
        focus: "Virology and infection dynamics (free list / timed guest)",
      },
      {
        title: "Circulatory System",
        provider: "ExploreLearning Gizmos",
        url: "https://gizmos.explorelearning.com/find-gizmos/launch-gizmo?resourceId=662",
        grades: [9, 10, 11, 12],
        focus: "Human body systems (free list / timed guest)",
      },
      {
        title: "Gene Machine: The Lac Operon",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/gene-machine-lac-operon",
        grades: [10, 11, 12],
        focus: "Gene regulation and protein synthesis concepts",
      },
      {
        title: "BioMan Biology Virtual Labs",
        provider: "BioMan Biology",
        url: "https://biomanbio.com/",
        grades: [9, 10, 11, 12],
        focus: "Topic-wise virtual labs across cells, ecology, genetics, and physiology",
      },
      {
        title: "Virtual Biology Lab",
        provider: "Virtual Biology Lab",
        url: "https://virtualbiologylab.org/",
        grades: [10, 11, 12],
        focus: "Population, ecology, and evolutionary simulation experiments",
      },
      {
        title: "Geniventure",
        provider: "Concord Consortium",
        url: "https://concord.org/teaching-genetics/dragons/",
        grades: [9, 10, 11, 12],
        focus: "Interactive heredity and meiosis with genetics modeling",
      },
      {
        title: "Learn.Genetics Virtual Labs",
        provider: "University of Utah",
        url: "https://learn.genetics.utah.edu/",
        grades: [9, 10, 11, 12],
        focus: "Free genetics, cell biology, evolution, and health interactives",
      },
      {
        title: "LabXchange Enzyme Activity Lab",
        provider: "LabXchange",
        url: "https://about.labxchange.org/sim-landing-page/enzyme-activity-lab",
        grades: [9, 10, 11, 12],
        focus: "Virtual enzyme experiment with pH and reaction-rate analysis",
      },
      {
        title: "NetLogo Wolf Sheep Predation",
        provider: "NetLogo",
        url: "https://ccl.northwestern.edu/netlogo/models/WolfSheepPredation",
        grades: [10, 11, 12],
        focus: "Predator-prey population dynamics and ecosystem stability",
      },
      {
        title: "The Biology Project",
        provider: "University of Arizona",
        url: "https://biology.arizona.edu/the_biology_project/the_biology_project.html",
        grades: [9, 10, 11, 12],
        focus: "Interactive biology modules and concept practice sets",
      },
      {
        title: "Cell Collective",
        provider: "Cell Collective",
        url: "https://cellcollective.org/",
        grades: [11, 12],
        focus: "Systems-biology pathway and network behavior simulations",
      },
    ],
  },
  {
    subject: "Mathematics",
    simulations: [
      {
        title: "Graphing Calculator",
        provider: "GeoGebra",
        url: "https://www.geogebra.org/graphing",
        grades: [9, 10, 11, 12],
        focus: "Functions and graphing",
      },
      {
        title: "Geometry",
        provider: "GeoGebra",
        url: "https://www.geogebra.org/geometry",
        grades: [9, 10, 11, 12],
        focus: "Euclidean constructions",
      },
      {
        title: "3D Calculator",
        provider: "GeoGebra",
        url: "https://www.geogebra.org/3d",
        grades: [10, 11, 12],
        focus: "3D geometry and vectors",
      },
      {
        title: "Probability Calculator",
        provider: "GeoGebra",
        url: "https://www.geogebra.org/probability",
        grades: [10, 11, 12],
        focus: "Distributions and statistics",
      },
      {
        title: "Graphing Calculator",
        provider: "Desmos",
        url: "https://www.desmos.com/calculator",
        grades: [9, 10, 11, 12],
        focus: "Graphing and analysis",
      },
      {
        title: "Geometry Tool",
        provider: "Desmos",
        url: "https://www.desmos.com/geometry",
        grades: [9, 10, 11, 12],
        focus: "Interactive geometry",
      },
      {
        title: "3D Calculator",
        provider: "Desmos",
        url: "https://www.desmos.com/3d",
        grades: [10, 11, 12],
        focus: "Surfaces and vectors",
      },
      {
        title: "Graphing Lines",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/graphing-lines",
        grades: [9, 10],
        focus: "Linear functions",
      },
      {
        title: "Graphing Quadratics",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/graphing-quadratics",
        grades: [10, 11],
        focus: "Quadratic functions",
      },
      {
        title: "Function Builder",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/function-builder",
        grades: [9, 10, 11],
        focus: "Function transformations",
      },
      {
        title: "Least Squares Regression",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/least-squares-regression",
        grades: [11, 12],
        focus: "Data fitting",
      },
      {
        title: "Vector Addition",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/vector-addition",
        grades: [10, 11, 12],
        focus: "Vectors and components",
      },
      {
        title: "Polypad",
        provider: "Mathigon",
        url: "https://mathigon.org/polypad",
        grades: [9, 10, 11, 12],
        focus: "Manipulatives and visual math",
      },
      {
        title: "Exponential Growth and Decay",
        provider: "ExploreLearning Gizmos",
        url: "https://gizmos.explorelearning.com/find-gizmos/launch-gizmo?resourceId=105",
        grades: [9, 10, 11, 12],
        focus: "Functions and modeling change (free list / timed guest)",
      },
      {
        title: "Least-Squares Best Fit Lines",
        provider: "ExploreLearning Gizmos",
        url: "https://gizmos.explorelearning.com/find-gizmos/launch-gizmo?resourceId=144",
        grades: [10, 11, 12],
        focus: "Statistics and regression (free list / timed guest)",
      },
    ],
  },
  {
    subject: "Computer Science",
    simulations: [
      {
        title: "Python Tutor",
        provider: "Python Tutor",
        url: "https://pythontutor.com/",
        grades: [9, 10, 11, 12],
        focus: "Step-by-step code execution",
      },
      {
        title: "VisuAlgo",
        provider: "VisuAlgo",
        url: "https://visualgo.net/en",
        grades: [10, 11, 12],
        focus: "Data structures and algorithms",
      },
      {
        title: "CPUlator",
        provider: "CPUlator",
        url: "https://cpulator.01xz.net/",
        grades: [11, 12],
        focus: "Computer architecture simulation",
      },
      {
        title: "Wokwi",
        provider: "Wokwi",
        url: "https://wokwi.com/",
        grades: [9, 10, 11, 12],
        focus: "Arduino/IoT simulation",
      },
      {
        title: "Scratch",
        provider: "Scratch",
        url: "https://scratch.mit.edu/",
        grades: [9, 10],
        focus: "Block coding simulation",
      },
      {
        title: "Blockly Games",
        provider: "Blockly",
        url: "https://blockly.games/",
        grades: [9, 10],
        focus: "Programming logic games",
      },
      {
        title: "CircuitVerse",
        provider: "CircuitVerse",
        url: "https://circuitverse.org/simulator",
        grades: [10, 11, 12],
        focus: "Digital logic circuits",
      },
      {
        title: "NandGame",
        provider: "NandGame",
        url: "https://nandgame.com/",
        grades: [11, 12],
        focus: "Build a computer from logic gates",
      },
      {
        title: "p5.js Web Editor",
        provider: "p5.js",
        url: "https://editor.p5js.org/",
        grades: [9, 10, 11, 12],
        focus: "Creative coding sandbox",
      },
      {
        title: "Algorithm Visualizer",
        provider: "Algorithm Visualizer",
        url: "https://algorithm-visualizer.org/",
        grades: [10, 11, 12],
        focus: "Algorithm animation",
      },
      {
        title: "Tinkercad Circuits",
        provider: "Tinkercad",
        url: "https://www.tinkercad.com/circuits",
        grades: [9, 10, 11, 12],
        focus: "Embedded systems and circuits",
      },
    ],
  },
  {
    subject: "Design Technology",
    simulations: [
      {
        title: "Tinkercad 3D Design",
        provider: "Tinkercad",
        url: "https://www.tinkercad.com/things",
        grades: [9, 10, 11, 12],
        focus: "CAD prototyping",
      },
      {
        title: "Tinkercad Circuits",
        provider: "Tinkercad",
        url: "https://www.tinkercad.com/circuits",
        grades: [9, 10, 11, 12],
        focus: "Electronics prototyping",
      },
      {
        title: "Onshape Education",
        provider: "Onshape",
        url: "https://www.onshape.com/en/education/",
        grades: [10, 11, 12],
        focus: "Cloud CAD and assemblies",
      },
      {
        title: "SketchUp Free",
        provider: "SketchUp",
        url: "https://www.sketchup.com/plans-and-pricing/sketchup-free",
        grades: [9, 10, 11, 12],
        focus: "3D modeling in browser",
      },
      {
        title: "Falstad Circuit Simulator",
        provider: "Falstad",
        url: "https://falstad.com/",
        grades: [10, 11, 12],
        focus: "Analog and digital circuits",
      },
      {
        title: "Wokwi",
        provider: "Wokwi",
        url: "https://wokwi.com/",
        grades: [9, 10, 11, 12],
        focus: "Microcontroller simulation",
      },
      {
        title: "CircuitVerse",
        provider: "CircuitVerse",
        url: "https://circuitverse.org/simulator",
        grades: [10, 11, 12],
        focus: "Digital electronics",
      },
      {
        title: "Fusion for Personal Use",
        provider: "Autodesk",
        url: "https://www.autodesk.com/products/fusion-360/personal",
        grades: [11, 12],
        focus: "CAD/CAM practice",
      },
      {
        title: "MakerCase",
        provider: "MakerCase",
        url: "https://www.makercase.com/",
        grades: [9, 10, 11, 12],
        focus: "Laser-cut box design generator",
      },
    ],
  },
  {
    subject: "Environmental Systems and Society (ESS)",
    simulations: [
      {
        title: "EN-ROADS Climate Simulator",
        provider: "Climate Interactive",
        url: "https://en-roads.climateinteractive.org/scenario.html",
        grades: [9, 10, 11, 12],
        focus: "Climate policy scenarios",
      },
      {
        title: "Earth Wind Map",
        provider: "earth.nullschool",
        url: "https://earth.nullschool.net/",
        grades: [9, 10, 11, 12],
        focus: "Atmospheric and ocean patterns",
      },
      {
        title: "NASA Worldview",
        provider: "NASA EOSDIS",
        url: "https://worldview.earthdata.nasa.gov/",
        grades: [9, 10, 11, 12],
        focus: "Earth observation layers",
      },
      {
        title: "NOAA Sea Level Rise Viewer",
        provider: "NOAA",
        url: "https://coast.noaa.gov/slr/",
        grades: [10, 11, 12],
        focus: "Coastal impact modeling",
      },
      {
        title: "USGS Earthquake Map",
        provider: "USGS",
        url: "https://earthquake.usgs.gov/earthquakes/map/",
        grades: [9, 10, 11, 12],
        focus: "Live seismic activity",
      },
      {
        title: "Global Forest Watch",
        provider: "WRI",
        url: "https://www.globalforestwatch.org/map",
        grades: [10, 11, 12],
        focus: "Forest change monitoring",
      },
      {
        title: "Climate Time Machine",
        provider: "NASA",
        url: "https://climate.nasa.gov/interactives/climate-time-machine/",
        grades: [9, 10, 11, 12],
        focus: "Global climate trends",
      },
      {
        title: "Windy Interactive Map",
        provider: "Windy",
        url: "https://www.windy.com/",
        grades: [9, 10, 11, 12],
        focus: "Weather and forecast layers",
      },
      {
        title: "Relative Humidity",
        provider: "ExploreLearning Gizmos",
        url: "https://gizmos.explorelearning.com/find-gizmos/launch-gizmo?resourceId=425",
        grades: [9, 10, 11, 12],
        focus: "Weather, humidity, and dew point (free list / timed guest)",
      },
      {
        title: "Disease Spread",
        provider: "ExploreLearning Gizmos",
        url: "https://gizmos.explorelearning.com/find-gizmos/launch-gizmo?resourceId=379",
        grades: [9, 10, 11, 12],
        focus: "Population-level epidemiology model (free list / timed guest)",
      },
    ],
  },
  {
    subject: "Geography",
    simulations: [
      {
        title: "Google Earth Web",
        provider: "Google",
        url: "https://earth.google.com/web/",
        grades: [9, 10, 11, 12],
        focus: "Global terrain and place exploration",
      },
      {
        title: "NASA Worldview",
        provider: "NASA EOSDIS",
        url: "https://worldview.earthdata.nasa.gov/",
        grades: [9, 10, 11, 12],
        focus: "Satellite imagery by date/layer",
      },
      {
        title: "Earth Wind Map",
        provider: "earth.nullschool",
        url: "https://earth.nullschool.net/",
        grades: [9, 10, 11, 12],
        focus: "Atmosphere and ocean circulation",
      },
      {
        title: "USGS Earthquake Map",
        provider: "USGS",
        url: "https://earthquake.usgs.gov/earthquakes/map/",
        grades: [9, 10, 11, 12],
        focus: "Plate tectonics and seismic activity",
      },
      {
        title: "NOAA Sea Level Rise Viewer",
        provider: "NOAA",
        url: "https://coast.noaa.gov/slr/",
        grades: [10, 11, 12],
        focus: "Coastal geography impacts",
      },
      {
        title: "ArcGIS Living Atlas",
        provider: "Esri",
        url: "https://livingatlas.arcgis.com/en/home/",
        grades: [10, 11, 12],
        focus: "Interactive geographic datasets",
      },
      {
        title: "Global Forest Watch",
        provider: "WRI",
        url: "https://www.globalforestwatch.org/map",
        grades: [10, 11, 12],
        focus: "Land-use and forest change",
      },
    ],
  },
  {
    subject: "Economics and Business Studies",
    simulations: [
      {
        title: "EN-ROADS Climate Policy Simulator",
        provider: "Climate Interactive",
        url: "https://en-roads.climateinteractive.org/scenario.html",
        grades: [10, 11, 12],
        focus: "Policy, energy, and macro-level outcomes",
      },
      {
        title: "Gapminder Tools",
        provider: "Gapminder",
        url: "https://www.gapminder.org/tools/",
        grades: [9, 10, 11, 12],
        focus: "Development and economic indicators",
      },
      {
        title: "Our World in Data Grapher",
        provider: "Our World in Data",
        url: "https://ourworldindata.org/grapher",
        grades: [10, 11, 12],
        focus: "Comparative social-economic data modeling",
      },
      {
        title: "FRED Data Explorer",
        provider: "Federal Reserve Bank of St. Louis",
        url: "https://fred.stlouisfed.org/",
        grades: [11, 12],
        focus: "Macroeconomic time-series analysis",
      },
      {
        title: "IMF DataMapper",
        provider: "IMF",
        url: "https://www.imf.org/external/datamapper/",
        grades: [11, 12],
        focus: "Global economy and country comparisons",
      },
      {
        title: "World Bank Data",
        provider: "World Bank",
        url: "https://data.worldbank.org/",
        grades: [10, 11, 12],
        focus: "Economic and development indicators",
      },
      {
        title: "The Fiscal Ship",
        provider: "Wilson Center / Brookings",
        url: "https://teach.fiscalship.org/",
        grades: [10, 11, 12],
        focus: "Budget trade-off simulator for deficit and public-policy choices",
      },
      {
        title: "Econ Lowdown Online Learning",
        provider: "Federal Reserve Bank of St. Louis",
        url: "https://www.stlouisfed.org/education/econ-lowdown-online-learning",
        grades: [9, 10, 11, 12],
        focus: "Free macro, micro, and finance interactives for classrooms",
      },
      {
        title: "World Bank DataBank",
        provider: "World Bank",
        url: "https://databank.worldbank.org/",
        grades: [10, 11, 12],
        focus: "Interactive chart, table, and map exploration for global economic datasets",
      },
      {
        title: "WITS Trade Data Platform",
        provider: "World Bank",
        url: "https://wits.worldbank.org/",
        grades: [11, 12],
        focus: "Global trade, tariff, and competitiveness analysis tools",
      },
      {
        title: "WITS Simulation Tools",
        provider: "World Bank",
        url: "https://wits.worldbank.org/simulationtool.html",
        grades: [11, 12],
        focus: "Tariff-cut and trade-outcome simulation modules",
      },
      {
        title: "OECD Data Explorer",
        provider: "OECD",
        url: "https://www.oecd.org/en/data/datasets/oecd-DE.html",
        grades: [10, 11, 12],
        focus: "Cross-country economic indicators with interactive comparisons",
      },
      {
        title: "IMF Data Portal",
        provider: "IMF",
        url: "https://www.imf.org/data",
        grades: [11, 12],
        focus: "Macroeconomic indicators and DataMapper-style visual exploration",
      },
      {
        title: "UNCTAD Data Hub",
        provider: "UNCTAD",
        url: "https://unctadstat.unctad.org/",
        grades: [10, 11, 12],
        focus: "Trade, development, and macroeconomic data visual analytics",
      },
      {
        title: "Experiencing Economics",
        provider: "CORE Econ",
        url: "https://www.core-econ.org/project/experiencing-economics/",
        grades: [10, 11, 12],
        focus: "Classroom economics experiments and game-based interactive activities",
      },
      {
        title: "Doing Economics",
        provider: "CORE Econ",
        url: "https://www.core-econ.org/project/doing-economics/",
        grades: [10, 11, 12],
        focus: "Data-driven economics projects with interactive analytical workflows",
      },
      {
        title: "Imagine Economics",
        provider: "Imagine Economics",
        url: "https://imagineeconomics.org/",
        grades: [9, 10, 11, 12],
        focus: "Interactive economic models for markets, behavior, and policy intuition",
      },
    ],
  },
  {
    subject: "Astronomy and Space Science",
    simulations: [
      {
        title: "NASA Eyes",
        provider: "NASA",
        url: "https://eyes.nasa.gov/",
        grades: [9, 10, 11, 12],
        focus: "Missions and solar system visualization",
      },
      {
        title: "Stellarium Web",
        provider: "Stellarium",
        url: "https://stellarium-web.org/",
        grades: [9, 10, 11, 12],
        focus: "Night sky simulation",
      },
      {
        title: "ESA Sky",
        provider: "European Space Agency",
        url: "https://sky.esa.int/",
        grades: [9, 10, 11, 12],
        focus: "Astronomical map explorer",
      },
      {
        title: "WorldWide Telescope Web Client",
        provider: "AAS",
        url: "https://worldwidetelescope.org/webclient/",
        grades: [9, 10, 11, 12],
        focus: "Planetarium and dataset tours",
      },
      {
        title: "Eyes on Exoplanets",
        provider: "NASA",
        url: "https://eyes.nasa.gov/apps/exo/#/",
        grades: [10, 11, 12],
        focus: "Exoplanet exploration",
      },
      {
        title: "Solar System Scope",
        provider: "INOVE",
        url: "https://www.solarsystemscope.com/",
        grades: [9, 10, 11, 12],
        focus: "Interactive solar system model",
      },
      {
        title: "Gravity and Orbits",
        provider: "PhET",
        url: "https://phet.colorado.edu/en/simulation/gravity-and-orbits",
        grades: [9, 10, 11, 12],
        focus: "Orbital mechanics",
      },
    ],
  },
];

export const SIMULATION_LIBRARY_TOTAL = SIMULATION_LIBRARY.reduce(
  (sum, group) => sum + group.simulations.length,
  0,
);

const GRADE_FILTERS: Array<{ value: "all" | GradeLevel; label: string }> = [
  { value: "all", label: "All (9-12)" },
  { value: 9, label: "Grade 9" },
  { value: 10, label: "Grade 10" },
  { value: 11, label: "Grade 11" },
  { value: 12, label: "Grade 12" },
];

const SUBJECT_FILTERS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All subjects" },
  ...SIMULATION_LIBRARY.map((group) => ({ value: group.subject, label: group.subject })),
];

type SubjectTheme = {
  accent: string;
  border: string;
  surface: string;
  badgeBackground: string;
  badgeText: string;
};

const DEFAULT_SUBJECT_THEME: SubjectTheme = {
  accent: "#0f766e",
  border: "#a7f3d0",
  surface: "#ecfdf5",
  badgeBackground: "#d1fae5",
  badgeText: "#065f46",
};

const SUBJECT_THEMES: Record<string, SubjectTheme> = {
  Physics: {
    accent: "#1d4ed8",
    border: "#bfdbfe",
    surface: "#eff6ff",
    badgeBackground: "#dbeafe",
    badgeText: "#1e3a8a",
  },
  Chemistry: {
    accent: "#c2410c",
    border: "#fed7aa",
    surface: "#fff7ed",
    badgeBackground: "#ffedd5",
    badgeText: "#9a3412",
  },
  Biology: {
    accent: "#15803d",
    border: "#bbf7d0",
    surface: "#f0fdf4",
    badgeBackground: "#dcfce7",
    badgeText: "#166534",
  },
  Mathematics: {
    accent: "#0f766e",
    border: "#99f6e4",
    surface: "#f0fdfa",
    badgeBackground: "#ccfbf1",
    badgeText: "#115e59",
  },
  "Computer Science": {
    accent: "#334155",
    border: "#cbd5e1",
    surface: "#f8fafc",
    badgeBackground: "#e2e8f0",
    badgeText: "#1e293b",
  },
  "Design Technology": {
    accent: "#be123c",
    border: "#fecdd3",
    surface: "#fff1f2",
    badgeBackground: "#ffe4e6",
    badgeText: "#9f1239",
  },
  "Environmental Systems and Society (ESS)": {
    accent: "#0e7490",
    border: "#bae6fd",
    surface: "#f0f9ff",
    badgeBackground: "#e0f2fe",
    badgeText: "#155e75",
  },
  Geography: {
    accent: "#92400e",
    border: "#fde68a",
    surface: "#fffbeb",
    badgeBackground: "#fef3c7",
    badgeText: "#78350f",
  },
  "Economics and Business Studies": {
    accent: "#4338ca",
    border: "#c7d2fe",
    surface: "#eef2ff",
    badgeBackground: "#e0e7ff",
    badgeText: "#312e81",
  },
  "Astronomy and Space Science": {
    accent: "#1e3a8a",
    border: "#bfdbfe",
    surface: "#eff6ff",
    badgeBackground: "#dbeafe",
    badgeText: "#1e3a8a",
  },
};

const getSubjectTheme = (subject: string): SubjectTheme =>
  SUBJECT_THEMES[subject] ?? DEFAULT_SUBJECT_THEME;

export function SimulationLibraryView({
  enableTeacherAssign = false,
  onAssignSimulation,
  studentOnlyView = false,
  studentAssignedButton = null,
}: SimulationLibraryViewProps) {
  const [gradeFilter, setGradeFilter] = useState<"all" | GradeLevel>("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const showGradeDetails = !studentOnlyView;

  const filteredLibrary = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return SIMULATION_LIBRARY
      .filter((group) => subjectFilter === "all" || group.subject === subjectFilter)
      .map((group) => {
      const simulations = group.simulations.filter((simulation) => {
        const matchesGrade =
          !showGradeDetails || gradeFilter === "all" || simulation.grades.includes(gradeFilter);
        if (!matchesGrade) return false;
        if (!normalizedSearch) return true;
        const haystack = `${group.subject} ${simulation.title} ${simulation.focus}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      });
      return { ...group, simulations };
    }).filter((group) => group.simulations.length > 0);
  }, [gradeFilter, searchTerm, showGradeDetails, subjectFilter]);

  const totalLinks = useMemo(
    () => filteredLibrary.reduce((sum, group) => sum + group.simulations.length, 0),
    [filteredLibrary],
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 shadow-[0_12px_30px_rgba(15,23,42,0.08)]" data-tour="admin-simulations-section">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5">
                <path d="M7 4h10" />
                <path d="M9 4v3l-4.5 8a3 3 0 0 0 2.6 4.5h10.8a3 3 0 0 0 2.6-4.5L16 7V4" />
                <path d="M8 13h8" />
                <path d="M10 16h4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold leading-none text-slate-900">Simulation Library</h2>
            </div>
          </div>
          {studentAssignedButton ? (
            <button
              type="button"
              onClick={studentAssignedButton.onClick}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-700 pl-2.5 pr-3.5 py-2 text-sm font-semibold text-true-white hover:bg-emerald-600 transition"
              aria-label="Open assigned simulations"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="#facc15"
                stroke="#facc15"
                strokeWidth="1.8"
                className={`h-6 w-6 shrink-0 ${studentAssignedButton.ring ? "customer-bell-ring" : ""}`}
              >
                <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.172V11a6 6 0 1 0-12 0v3.172a2 2 0 0 1-.6 1.428L4 17h5" />
                <path d="M9 17a3 3 0 0 0 6 0" />
              </svg>
              <span>{studentAssignedButton.label}</span>
            </button>
          ) : (
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <span className="rounded-full bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-true-white">
                {filteredLibrary.length} subjects visible
              </span>
              <span className="rounded-full bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-true-white">
                {totalLinks} Simulations
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-300 bg-emerald-100 p-4">
        <div className="flex flex-col gap-3">
          <div className={`grid gap-3 ${showGradeDetails ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
            {showGradeDetails && (
              <label className="space-y-2 text-sm text-slate-800">
                <span className="text-[11px] uppercase tracking-[0.14em] text-emerald-800">Grade Filter</span>
                <select
                  value={String(gradeFilter)}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "all") {
                      setGradeFilter("all");
                      return;
                    }
                    setGradeFilter(Number(value) as GradeLevel);
                  }}
                  className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-slate-900 focus:border-emerald-500 focus:outline-none"
                >
                  {GRADE_FILTERS.map((grade) => (
                    <option key={String(grade.value)} value={String(grade.value)} className="text-black">
                      {grade.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="space-y-2 text-sm text-slate-800">
              <span className="text-[11px] uppercase tracking-[0.14em] text-emerald-800">Select Subject</span>
              <select
                value={subjectFilter}
                onChange={(event) => setSubjectFilter(event.target.value)}
                className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-slate-900 focus:border-emerald-500 focus:outline-none"
              >
                {SUBJECT_FILTERS.map((subject) => (
                  <option key={subject.value} value={subject.value} className="text-black">
                    {subject.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="space-y-2 text-sm text-slate-800">
            <span className="text-[11px] uppercase tracking-[0.14em] text-emerald-800">Search By Topic</span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="e.g. circuits, climate, vectors, gravity"
              className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </label>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setGradeFilter("all");
                setSubjectFilter("all");
                setSearchTerm("");
              }}
              className="rounded-lg border border-emerald-700 bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-true-white hover:bg-emerald-600 transition"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {filteredLibrary.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-700">
          No simulations match this filter.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLibrary.map((group) => {
            const theme = getSubjectTheme(group.subject);
            const rowOddColor = `color-mix(in srgb, ${theme.accent} 10%, white)`;
            const rowEvenColor = `color-mix(in srgb, ${theme.accent} 4%, white)`;
            const rowHoverColor = `color-mix(in srgb, ${theme.accent} 16%, white)`;
            const articleStyle = {
              borderColor: theme.border,
              ["--accent" as string]: theme.accent,
              ["--table-grid-border" as string]: `color-mix(in srgb, ${theme.accent} 24%, transparent)`,
              backgroundImage: `linear-gradient(160deg, ${theme.surface} 0%, #ffffff 56%, ${theme.badgeBackground} 100%)`,
            } as CSSProperties;

            return (
              <article
                key={group.subject}
                className="rounded-2xl border overflow-hidden shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
                style={articleStyle}
              >
                <div
                  className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3"
                  style={{
                    borderColor: theme.border,
                    backgroundImage: `linear-gradient(90deg, ${theme.surface} 0%, #ffffff 62%, ${theme.badgeBackground} 100%)`,
                  }}
                >
                  <h3 className="text-base font-semibold text-slate-900">{group.subject}</h3>
                  <span
                    className="rounded-full border px-2.5 py-1 text-xs font-semibold"
                    style={{
                      borderColor: theme.border,
                      backgroundColor: theme.badgeBackground,
                      color: theme.badgeText,
                    }}
                  >
                    {group.simulations.length} Simulations
                  </span>
                </div>
                <div
                  className="overflow-auto"
                  style={{
                    backgroundImage: `linear-gradient(180deg, ${theme.surface} 0%, #ffffff 70%)`,
                  }}
                >
                  <table className="table-v1 table-fixed">
                    <colgroup>
                      <col className={showGradeDetails ? "w-[30%]" : "w-[34%]"} />
                      <col className={showGradeDetails ? "w-[36%]" : "w-[46%]"} />
                      {showGradeDetails && <col className="w-[16%]" />}
                      <col className={showGradeDetails ? "w-[18%]" : "w-[20%]"} />
                    </colgroup>
                    <thead>
                      <tr className="text-left text-slate-700 border-b border-slate-200">
                        <th className="py-2 pr-3">Simulation</th>
                        <th className="py-2 pr-3">Focus</th>
                        {showGradeDetails && <th className="py-2 pr-3">Grades</th>}
                        <th className="py-2 pr-3 whitespace-nowrap">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.simulations.map((simulation, index) => {
                        const rowStyle = {
                          borderColor: theme.border,
                          background: index % 2 === 0 ? rowOddColor : rowEvenColor,
                          ["--row-hover" as string]: rowHoverColor,
                        } as CSSProperties;
                        return (
                        <tr
                          key={`${group.subject}-${simulation.url}-${simulation.title}-${index}`}
                          className="border-b transition-colors hover:bg-[var(--row-hover)]"
                          style={rowStyle}
                        >
                          <td className="py-2 pr-3 align-top font-semibold text-slate-900">{simulation.title}</td>
                          <td className="py-2 pr-3 align-top text-slate-700">{simulation.focus}</td>
                          {showGradeDetails && (
                            <td className="py-2 pr-3 align-top whitespace-nowrap text-slate-700">{simulation.grades.join(", ")}</td>
                          )}
                          <td className="py-2 pr-3 align-top whitespace-nowrap">
                            <div className="flex flex-wrap gap-1.5">
                              <a
                                href={simulation.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-semibold text-true-white transition whitespace-nowrap"
                                style={{
                                  borderColor: theme.accent,
                                  backgroundImage: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.badgeText} 100%)`,
                                }}
                              >
                                Open
                              </a>
                              {enableTeacherAssign && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onAssignSimulation?.({
                                      subject: group.subject,
                                      simulation,
                                    })
                                  }
                                  className="inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap"
                                  style={{
                                    borderColor: theme.accent,
                                    color: theme.badgeText,
                                    background: "white",
                                  }}
                                >
                                  Assign
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
