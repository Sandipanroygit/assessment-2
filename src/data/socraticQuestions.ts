import { Question } from "@/app/socratic-ai/page";

export const SOCRATIC_QUESTION_BANK: Question[] = [
  // =========================================================================
  // JEE MAINS - 50 QUESTIONS (Moderate / Conceptual)
  // =========================================================================

  // --- PHYSICS (17) ---
  {
    id: "jm-phy-01",
    exam: "JEE Mains",
    subject: "Physics",
    year: 2024,
    text: "A particle moves in a circle of radius R with a constant speed v. The magnitude of average acceleration during the time it covers a semi-circle is:",
    options: [
      { label: "A", text: "v²/R" },
      { label: "B", text: "2v²/πR" },
      { label: "C", text: "v²/2πR" },
      { label: "D", text: "Zero" }
    ],
    correctAnswer: "B",
    logicContext: "1. Time taken for semi-circle: t = πR/v. 2. Change in velocity: Initial v, Final -v (opposite direction). Δv = 2v. 3. Average acceleration = Δv/t = 2v / (πR/v) = 2v²/πR."
  },
  {
    id: "jm-phy-02",
    exam: "JEE Mains",
    subject: "Physics",
    year: 2024,
    text: "The ratio of escape velocity at earth (ve) to the escape velocity at a planet (vp) whose radius and mean density are twice as that of earth is:",
    options: [
      { label: "A", text: "1 : 2" },
      { label: "B", text: "1 : 2√2" },
      { label: "C", text: "1 : 4" },
      { label: "D", text: "1 : √2" }
    ],
    correctAnswer: "B",
    logicContext: "1. Escape velocity v = √(2GM/R). 2. M = ρ * (4/3)πR³, so v ∝ R√ρ. 3. ve/vp = (Re√ρe) / (Rp√ρp) = (Re√ρe) / (2Re√2ρe) = 1 / (2√2)."
  },
  {
    id: "jm-phy-03",
    exam: "JEE Mains",
    subject: "Physics",
    year: 2023,
    text: "If the temperature of a black body increases by 50%, the percentage increase in the rate of radiation of energy is:",
    options: [
      { label: "A", text: "125%" },
      { label: "B", text: "406%" },
      { label: "C", text: "50%" },
      { label: "D", text: "225%" }
    ],
    correctAnswer: "B",
    logicContext: "1. Stefan-Boltzmann Law: E ∝ T⁴. 2. T' = 1.5T. 3. E' ∝ (1.5T)⁴ = 5.0625 T⁴. 4. Percentage increase = (5.0625 - 1) * 100 = 406.25%."
  },
  {
    id: "jm-phy-04",
    exam: "JEE Mains",
    subject: "Physics",
    year: 2024,
    text: "In a Young's Double Slit Experiment, the fringe width is β. If the entire apparatus is immersed in a liquid of refractive index n, the new fringe width is:",
    options: [
      { label: "A", text: "nβ" },
      { label: "B", text: "β/n" },
      { label: "C", text: "β/(n-1)" },
      { label: "D", text: "β" }
    ],
    correctAnswer: "B",
    logicContext: "1. Fringe width β = λD/d. 2. When immersed, wavelength λ changes to λ' = λ/n. 3. New width β' = λ'D/d = (λ/n)D/d = β/n."
  },
  {
    id: "jm-phy-05",
    exam: "JEE Mains",
    subject: "Physics",
    year: 2023,
    text: "A wire of resistance R is stretched to twice its original length. The new resistance is:",
    options: [
      { label: "A", text: "2R" },
      { label: "B", text: "4R" },
      { label: "C", text: "R/2" },
      { label: "D", text: "R/4" }
    ],
    correctAnswer: "B",
    logicContext: "1. Volume V = AL remains constant. 2. If L' = 2L, then A' = A/2. 3. R = ρL/A. 4. R' = ρ(2L)/(A/2) = 4(ρL/A) = 4R."
  },
  {
    id: "jm-phy-06",
    exam: "JEE Mains",
    subject: "Physics",
    year: 2024,
    text: "The de Broglie wavelength of an electron accelerated through a potential difference of 100 V is approximately:",
    options: [
      { label: "A", text: "1.23 Å" },
      { label: "B", text: "12.3 Å" },
      { label: "C", text: "0.123 Å" },
      { label: "D", text: "123 Å" }
    ],
    correctAnswer: "A",
    logicContext: "1. λ = 12.27 / √V Å. 2. V = 100, √V = 10. 3. λ = 12.27 / 10 = 1.227 Å ≈ 1.23 Å."
  },
  {
    id: "jm-phy-07",
    exam: "JEE Mains",
    subject: "Physics",
    year: 2024,
    text: "In an adiabatic process, the pressure of a gas is proportional to the cube of its temperature. The ratio of CP/CV for the gas is:",
    options: [
      { label: "A", text: "3/2" },
      { label: "B", text: "4/3" },
      { label: "C", text: "5/3" },
      { label: "D", text: "2" }
    ],
    correctAnswer: "A",
    logicContext: "1. For adiabatic: P^(1-γ) T^γ = constant => P ∝ T^(γ/(γ-1)). 2. Given P ∝ T³. 3. γ/(γ-1) = 3 => γ = 3γ - 3 => 2γ = 3 => γ = 3/2."
  },
  {
    id: "jm-phy-08",
    exam: "JEE Mains",
    subject: "Physics",
    year: 2023,
    text: "The magnetic field at the center of a circular coil of radius R carrying current I is B. If the radius is doubled and current is halved, the new magnetic field is:",
    options: [
      { label: "A", text: "B/2" },
      { label: "B", text: "B/4" },
      { label: "C", text: "B/8" },
      { label: "D", text: "4B" }
    ],
    correctAnswer: "B",
    logicContext: "1. B = μ0 I / 2R. 2. B' = μ0 (I/2) / 2(2R) = (1/4) (μ0 I / 2R) = B/4."
  },
  {
    id: "jm-phy-09",
    exam: "JEE Mains",
    subject: "Physics",
    year: 2024,
    text: "A logic gate which gives output '1' only when both inputs are '1' is:",
    options: [
      { label: "A", text: "OR gate" },
      { label: "B", text: "AND gate" },
      { label: "C", text: "NAND gate" },
      { label: "D", text: "NOR gate" }
    ],
    correctAnswer: "B",
    logicContext: "1. AND gate follows the logic Y = A.B. 2. Output is 1 only if A=1 AND B=1. 3. For OR, 1+0=1. For NAND, 1.1=0."
  },
  {
    id: "jm-phy-10",
    exam: "JEE Mains",
    subject: "Physics",
    year: 2024,
    text: "The displacement of a particle is given by x = a sin(ωt + φ). If at t=0, x=a/2 and moving towards positive x-axis, the phase φ is:",
    options: [
      { label: "A", text: "π/6" },
      { label: "B", text: "π/3" },
      { label: "C", text: "5π/6" },
      { label: "D", text: "π/2" }
    ],
    correctAnswer: "A",
    logicContext: "1. At t=0, x = a sin φ. 2. a/2 = a sin φ => sin φ = 1/2. 3. φ = π/6 or 5π/6. 4. Since moving towards positive x (v > 0), cos φ > 0. 5. cos(π/6) > 0, so φ = π/6."
  },
  {
    id: "jm-phy-11",
    exam: "JEE Mains",
    subject: "Physics",
    year: 2024,
    text: "Work done in moving a charge q once round a circle of radius r with a charge Q at the center is:",
    options: [
      { label: "A", text: "qQ / 4πε0r" },
      { label: "B", text: "qQ / 4πε0r²" },
      { label: "C", text: "Zero" },
      { label: "D", text: "Infinite" }
    ],
    correctAnswer: "C",
    logicContext: "1. Electrostatic force is conservative. 2. Work done in a closed path in a conservative field is zero. 3. Also, force is radial and displacement is tangential, so F.dr = 0."
  },
  {
    id: "jm-phy-12",
    exam: "JEE Mains",
    subject: "Physics",
    year: 2023,
    text: "A lens has a power of +2.0 D. Its focal length is:",
    options: [
      { label: "A", text: "50 cm" },
      { label: "B", text: "-50 cm" },
      { label: "C", text: "20 cm" },
      { label: "D", text: "100 cm" }
    ],
    correctAnswer: "A",
    logicContext: "1. P = 1/f (in meters). 2. f = 1/P = 1/2.0 = 0.5 m. 3. 0.5 m = 50 cm."
  },
  {
    id: "jm-phy-13",
    exam: "JEE Mains",
    subject: "Physics",
    year: 2024,
    text: "The dimension of torque is:",
    options: [
      { label: "A", text: "[ML²T⁻²]" },
      { label: "B", text: "[MLT⁻²]" },
      { label: "C", text: "[ML²T⁻¹]" },
      { label: "D", text: "[ML⁻¹T⁻²]" }
    ],
    correctAnswer: "A",
    logicContext: "1. Torque τ = Force * perpendicular distance. 2. Units: [MLT⁻²] * [L] = [ML²T⁻²]. 3. This is the same as the dimension of Work/Energy."
  },
  {
    id: "jm-phy-14",
    exam: "JEE Mains",
    subject: "Physics",
    year: 2024,
    text: "A capillary tube of radius r is immersed in water and water rises to a height h. If the radius is doubled, the height will be:",
    options: [
      { label: "A", text: "h/2" },
      { label: "B", text: "2h" },
      { label: "C", text: "h" },
      { label: "D", text: "4h" }
    ],
    correctAnswer: "A",
    logicContext: "1. Jurin's Law: h = 2T cos θ / (rρg). 2. h ∝ 1/r. 3. If r' = 2r, then h' = h/2."
  },
  {
    id: "jm-phy-15",
    exam: "JEE Mains",
    subject: "Physics",
    year: 2023,
    text: "The rms speed of gas molecules at temperature T is v. If temperature is increased to 4T, the new rms speed is:",
    options: [
      { label: "A", text: "2v" },
      { label: "B", text: "4v" },
      { label: "C", text: "v/2" },
      { label: "D", text: "v/4" }
    ],
    correctAnswer: "A",
    logicContext: "1. v_rms = √(3RT/M). 2. v_rms ∝ √T. 3. If T' = 4T, then v' = √4 * v = 2v."
  },
  {
    id: "jm-phy-16",
    exam: "JEE Mains",
    subject: "Physics",
    year: 2024,
    text: "In a series LCR circuit at resonance, the impedance is:",
    options: [
      { label: "A", text: "Zero" },
      { label: "B", text: "Purely resistive" },
      { label: "C", text: "Purely inductive" },
      { label: "D", text: "Purely capacitive" }
    ],
    correctAnswer: "B",
    logicContext: "1. Impedance Z = √[R² + (XL - XC)²]. 2. At resonance, XL = XC. 3. Z = √R² = R. 4. Circuit behaves as a purely resistive circuit."
  },
  {
    id: "jm-phy-17",
    exam: "JEE Mains",
    subject: "Physics",
    year: 2024,
    text: "The acceleration due to gravity at a height h above the earth's surface (h << R) is given by:",
    options: [
      { label: "A", text: "g(1 - h/R)" },
      { label: "B", text: "g(1 - 2h/R)" },
      { label: "C", text: "g(1 + h/R)" },
      { label: "D", text: "g(1 + 2h/R)" }
    ],
    correctAnswer: "B",
    logicContext: "1. g' = g [R/(R+h)]² = g [1 + h/R]⁻². 2. Using binomial expansion for h << R: g' ≈ g [1 - 2h/R]."
  },

  // --- CHEMISTRY (17) ---
  {
    id: "jm-chm-01",
    exam: "JEE Mains",
    subject: "Chemistry",
    year: 2024,
    text: "The number of σ and π bonds in benzene are respectively:",
    options: [
      { label: "A", text: "12, 3" },
      { label: "B", text: "6, 3" },
      { label: "C", text: "9, 3" },
      { label: "D", text: "12, 6" }
    ],
    correctAnswer: "A",
    logicContext: "1. Benzene (C6H6) has a hexagonal ring. 2. 6 C-C σ bonds + 6 C-H σ bonds = 12 σ bonds. 3. 3 alternating double bonds = 3 π bonds."
  },
  {
    id: "jm-chm-02",
    exam: "JEE Mains",
    subject: "Chemistry",
    year: 2024,
    text: "The oxidation state of Cr in K2Cr2O7 is:",
    options: [
      { label: "A", text: "+3" },
      { label: "B", text: "+6" },
      { label: "C", text: "+7" },
      { label: "D", text: "+2" }
    ],
    correctAnswer: "B",
    logicContext: "1. Sum of oxidation states = 0. 2. 2(+1) + 2(x) + 7(-2) = 0. 3. 2 + 2x - 14 = 0 => 2x = 12 => x = +6."
  },
  {
    id: "jm-chm-03",
    exam: "JEE Mains",
    subject: "Chemistry",
    year: 2023,
    text: "Which of the following has the highest boiling point?",
    options: [
      { label: "A", text: "He" },
      { label: "B", text: "Ne" },
      { label: "C", text: "Ar" },
      { label: "D", text: "Kr" }
    ],
    correctAnswer: "D",
    logicContext: "1. Noble gases are monatomic and held by London dispersion forces. 2. Dispersion forces increase with atomic size/mass. 3. Kr > Ar > Ne > He."
  },
  {
    id: "jm-chm-04",
    exam: "JEE Mains",
    subject: "Chemistry",
    year: 2024,
    text: "The shape of PCl5 is:",
    options: [
      { label: "A", text: "Octahedral" },
      { label: "B", text: "Trigonal bipyramidal" },
      { label: "C", text: "Square pyramidal" },
      { label: "D", text: "Tetrahedral" }
    ],
    correctAnswer: "B",
    logicContext: "1. Phosphorus has 5 valence electrons. All 5 are bonded to Cl. 2. Steric number = 5. Sp³d hybridization. 3. Molecular geometry is Trigonal Bipyramidal."
  },
  {
    id: "jm-chm-05",
    exam: "JEE Mains",
    subject: "Chemistry",
    year: 2024,
    text: "Which of the following is an intensive property?",
    options: [
      { label: "A", text: "Volume" },
      { label: "B", text: "Mass" },
      { label: "C", text: "Density" },
      { label: "D", text: "Enthalpy" }
    ],
    correctAnswer: "C",
    logicContext: "1. Intensive properties are independent of the amount of substance. 2. Density = Mass / Volume. Ratio of two extensive properties is intensive. 3. Volume, Mass, and Enthalpy change with amount."
  },
  {
    id: "jm-chm-06",
    exam: "JEE Mains",
    subject: "Chemistry",
    year: 2023,
    text: "The unit of rate constant for a second-order reaction is:",
    options: [
      { label: "A", text: "s⁻¹" },
      { label: "B", text: "mol L⁻¹ s⁻¹" },
      { label: "C", text: "L mol⁻¹ s⁻¹" },
      { label: "D", text: "L² mol⁻² s⁻¹" }
    ],
    correctAnswer: "C",
    logicContext: "1. Rate = k [A]². 2. k = Rate / [A]² = (mol L⁻¹ s⁻¹) / (mol L⁻¹)² = L mol⁻¹ s⁻¹."
  },
  {
    id: "jm-chm-07",
    exam: "JEE Mains",
    subject: "Chemistry",
    year: 2024,
    text: "Most stable carbonium ion is:",
    options: [
      { label: "A", text: "Methyl" },
      { label: "B", text: "Ethyl" },
      { label: "C", text: "Isopropyl" },
      { label: "D", text: "Tert-butyl" }
    ],
    correctAnswer: "D",
    logicContext: "1. Stability follows 3° > 2° > 1° > methyl. 2. Tert-butyl has 9 alpha-hydrogens for hyperconjugation and +I effect from 3 methyl groups."
  },
  {
    id: "jm-chm-08",
    exam: "JEE Mains",
    subject: "Chemistry",
    year: 2024,
    text: "The IUPAC name of CH3COCH2CH3 is:",
    options: [
      { label: "A", text: "Butan-2-one" },
      { label: "B", text: "Butan-1-one" },
      { label: "C", text: "Propanone" },
      { label: "D", text: "Pentan-2-one" }
    ],
    correctAnswer: "A",
    logicContext: "1. Longest chain has 4 carbons (Butane). 2. Carbonyl group is at C2. 3. Suffix is 'one'. Result: Butan-2-one."
  },
  {
    id: "jm-chm-09",
    exam: "JEE Mains",
    subject: "Chemistry",
    year: 2023,
    text: "Which of the following is a buffer solution?",
    options: [
      { label: "A", text: "CH3COOH + CH3COONa" },
      { label: "B", text: "HCl + NaCl" },
      { label: "C", text: "NaOH + NaCl" },
      { label: "D", text: "NH4Cl + HCl" }
    ],
    correctAnswer: "A",
    logicContext: "1. An acidic buffer consists of a weak acid and its salt with a strong base. 2. CH3COOH is weak acid, CH3COONa is its salt with NaOH."
  },
  {
    id: "jm-chm-10",
    exam: "JEE Mains",
    subject: "Chemistry",
    year: 2024,
    text: "The monomer of Teflon is:",
    options: [
      { label: "A", text: "Vinyl chloride" },
      { label: "B", text: "Tetrafluoroethene" },
      { label: "C", text: "Styrene" },
      { label: "D", text: "Butadiene" }
    ],
    correctAnswer: "B",
    logicContext: "1. Teflon is Polytetrafluoroethylene (PTFE). 2. Monomer is CF2=CF2 (Tetrafluoroethene)."
  },
  {
    id: "jm-chm-11",
    exam: "JEE Mains",
    subject: "Chemistry",
    year: 2024,
    text: "Which test is used to distinguish between aldehydes and ketones?",
    options: [
      { label: "A", text: "Tollen's test" },
      { label: "B", text: "Iodoform test" },
      { label: "C", text: "Lucas test" },
      { label: "D", text: "Beilstein test" }
    ],
    correctAnswer: "A",
    logicContext: "1. Tollen's reagent ([Ag(NH3)2]+) is a mild oxidizing agent. 2. Aldehydes are easily oxidized to carboxylates and reduce Ag+ to silver mirror. Ketones generally do not respond."
  },
  {
    id: "jm-chm-12",
    exam: "JEE Mains",
    subject: "Chemistry",
    year: 2023,
    text: "The hard water contains ions of:",
    options: [
      { label: "A", text: "Na+ and K+" },
      { label: "B", text: "Ca2+ and Mg2+" },
      { label: "C", text: "Fe2+ and Zn2+" },
      { label: "D", text: "Cl- and NO3-" }
    ],
    correctAnswer: "B",
    logicContext: "1. Hardness is caused by bicarbonates, chlorides, and sülfates of Calcium and Magnesium. 2. These ions react with soap to form scum."
  },
  {
    id: "jm-chm-13",
    exam: "JEE Mains",
    subject: "Chemistry",
    year: 2024,
    text: "Percentage of empty space in a body-centered cubic (bcc) unit cell is:",
    options: [
      { label: "A", text: "32%" },
      { label: "B", text: "26%" },
      { label: "C", text: "48%" },
      { label: "D", text: "68%" }
    ],
    correctAnswer: "A",
    logicContext: "1. Packing efficiency of BCC is 68%. 2. Empty space = 100% - 68% = 32%."
  },
  {
    id: "jm-chm-14",
    exam: "JEE Mains",
    subject: "Chemistry",
    year: 2024,
    text: "Which of the following is a Lewis acid?",
    options: [
      { label: "A", text: "NH3" },
      { label: "B", text: "BF3" },
      { label: "C", text: "H2O" },
      { label: "D", text: "CH4" }
    ],
    correctAnswer: "B",
    logicContext: "1. Lewis acid is an electron pair acceptor. 2. Boron in BF3 has only 6 valence electrons (incomplete octet). 3. NH3 and H2O are Lewis bases due to lone pairs."
  },
  {
    id: "jm-chm-15",
    exam: "JEE Mains",
    subject: "Chemistry",
    year: 2023,
    text: "Which gas is majorly responsible for the Greenhouse effect?",
    options: [
      { label: "A", text: "O2" },
      { label: "B", text: "CO2" },
      { label: "C", text: "N2" },
      { label: "D", text: "H2" }
    ],
    correctAnswer: "B",
    logicContext: "1. CO2 traps infrared radiation reflected from Earth's surface. 2. While Methane and CFCs are more potent per molecule, CO2 is the most abundant greenhouse gas emitted by human activity."
  },
  {
    id: "jm-chm-16",
    exam: "JEE Mains",
    subject: "Chemistry",
    year: 2024,
    text: "The bond order of N2 molecule is:",
    options: [
      { label: "A", text: "1" },
      { label: "B", text: "2" },
      { label: "C", text: "3" },
      { label: "D", text: "2.5" }
    ],
    correctAnswer: "C",
    logicContext: "1. N2 has 14 electrons. 2. Configuration: (σ1s)²(σ*1s)²(σ2s)²(σ*2s)²(π2px)²(π2py)²(σ2pz)². 3. Bond Order = (Bonding - Antibonding)/2 = (10 - 4)/2 = 3."
  },
  {
    id: "jm-chm-17",
    exam: "JEE Mains",
    subject: "Chemistry",
    year: 2024,
    text: "Which of the following is not an ore of Aluminium?",
    options: [
      { label: "A", text: "Bauxite" },
      { label: "B", text: "Cryolite" },
      { label: "C", text: "Hematite" },
      { label: "D", text: "Kaolinite" }
    ],
    correctAnswer: "C",
    logicContext: "1. Bauxite is the primary ore of Al. 2. Hematite is an ore of Iron (Fe2O3). 3. Cryolite and Kaolinite also contain Al."
  },

  // --- MATHEMATICS (16) ---
  {
    id: "jm-mat-01",
    exam: "JEE Mains",
    subject: "Mathematics",
    year: 2024,
    text: "The value of k for which the lines 2x + y - 1 = 0 and kx + 3y + 5 = 0 are parallel is:",
    options: [
      { label: "A", text: "2" },
      { label: "B", text: "6" },
      { label: "C", text: "3" },
      { label: "D", text: "-6" }
    ],
    correctAnswer: "B",
    logicContext: "1. Parallel lines have equal slopes (m1 = m2). 2. m1 = -2/1 = -2. 3. m2 = -k/3. 4. -2 = -k/3 => k = 6."
  },
  {
    id: "jm-mat-02",
    exam: "JEE Mains",
    subject: "Mathematics",
    year: 2024,
    text: "The derivative of sin(x²) with respect to x is:",
    options: [
      { label: "A", text: "2x cos(x²)" },
      { label: "B", text: "cos(x²)" },
      { label: "C", text: "2x sin(x²)" },
      { label: "D", text: "-2x cos(x²)" }
    ],
    correctAnswer: "A",
    logicContext: "1. Use chain rule: d/dx [sin(u)] = cos(u) * du/dx. 2. Let u = x². du/dx = 2x. 3. Result: cos(x²) * 2x = 2x cos(x²)."
  },
  {
    id: "jm-mat-03",
    exam: "JEE Mains",
    subject: "Mathematics",
    year: 2023,
    text: "The sum of first n odd natural numbers is:",
    options: [
      { label: "A", text: "n²" },
      { label: "B", text: "n(n+1)/2" },
      { label: "C", text: "2n-1" },
      { label: "D", text: "n(n+1)" }
    ],
    correctAnswer: "A",
    logicContext: "1. A.P. series: 1, 3, 5, ..., (2n-1). 2. Sum S = n/2 [first + last] = n/2 [1 + 2n - 1]. 3. S = n/2 [2n] = n²."
  },
  {
    id: "jm-mat-04",
    exam: "JEE Mains",
    subject: "Mathematics",
    year: 2024,
    text: "If sin θ + cos θ = 1, then the value of sin 2θ is:",
    options: [
      { label: "A", text: "1" },
      { label: "B", text: "0" },
      { label: "C", text: "1/2" },
      { label: "D", text: "-1" }
    ],
    correctAnswer: "B",
    logicContext: "1. Square both sides: (sin θ + cos θ)² = 1². 2. sin² θ + cos² θ + 2 sin θ cos θ = 1. 3. 1 + sin 2θ = 1. 4. sin 2θ = 0."
  },
  {
    id: "jm-mat-05",
    exam: "JEE Mains",
    subject: "Mathematics",
    year: 2024,
    text: "The area of a triangle with vertices (0,0), (4,0) and (0,3) is:",
    options: [
      { label: "A", text: "12" },
      { label: "B", text: "6" },
      { label: "C", text: "7" },
      { label: "D", text: "5" }
    ],
    correctAnswer: "B",
    logicContext: "1. Area = 0.5 * |x1(y2-y3) + x2(y3-y1) + x3(y1-y2)|. 2. Area = 0.5 * |0(0-3) + 4(3-0) + 0(0-0)| = 0.5 * |12| = 6."
  },
  {
    id: "jm-mat-06",
    exam: "JEE Mains",
    subject: "Mathematics",
    year: 2023,
    text: "If z = 1 + i, then |z| is:",
    options: [
      { label: "A", text: "1" },
      { label: "B", text: "√2" },
      { label: "C", text: "2" },
      { label: "D", text: "0" }
    ],
    correctAnswer: "B",
    logicContext: "1. For z = a + bi, |z| = √(a² + b²). 2. |1 + i| = √(1² + 1²) = √2."
  },
  {
    id: "jm-mat-07",
    exam: "JEE Mains",
    subject: "Mathematics",
    year: 2024,
    text: "The solution of dy/dx = y/x is:",
    options: [
      { label: "A", text: "y = cx" },
      { label: "B", text: "y = x + c" },
      { label: "C", text: "xy = c" },
      { label: "D", text: "y = e^x" }
    ],
    correctAnswer: "A",
    logicContext: "1. Variable separable: dy/y = dx/x. 2. Integrate: ln y = ln x + ln c. 3. ln y = ln(cx) => y = cx."
  },
  {
    id: "jm-mat-08",
    exam: "JEE Mains",
    subject: "Mathematics",
    year: 2024,
    text: "The number of subsets of a set containing 4 elements is:",
    options: [
      { label: "A", text: "4" },
      { label: "B", text: "8" },
      { label: "C", text: "16" },
      { label: "D", text: "12" }
    ],
    correctAnswer: "C",
    logicContext: "1. For a set with n elements, number of subsets = 2^n. 2. Here n = 4, so 2^4 = 16."
  },
  {
    id: "jm-mat-09",
    exam: "JEE Mains",
    subject: "Mathematics",
    year: 2023,
    text: "The probability of drawing a red card from a deck of 52 cards is:",
    options: [
      { label: "A", text: "1/4" },
      { label: "B", text: "1/2" },
      { label: "C", text: "1/13" },
      { label: "D", text: "2/13" }
    ],
    correctAnswer: "B",
    logicContext: "1. Total cards = 52. 2. Red cards = Hearts (13) + Diamonds (13) = 26. 3. Probability = 26/52 = 1/2."
  },
  {
    id: "jm-mat-10",
    exam: "JEE Mains",
    subject: "Mathematics",
    year: 2024,
    text: "The value of 5C2 is:",
    options: [
      { label: "A", text: "10" },
      { label: "B", text: "20" },
      { label: "C", text: "5" },
      { label: "D", text: "15" }
    ],
    correctAnswer: "A",
    logicContext: "1. nCr = n! / [r!(n-r)!]. 2. 5C2 = 5! / [2! 3!] = (5 * 4) / (2 * 1) = 10."
  },
  {
    id: "jm-mat-11",
    exam: "JEE Mains",
    subject: "Mathematics",
    year: 2024,
    text: "If A and B are symmetric matrices of same order, then AB - BA is:",
    options: [
      { label: "A", text: "Symmetric matrix" },
      { label: "B", text: "Skew-symmetric matrix" },
      { label: "C", text: "Zero matrix" },
      { label: "D", text: "Identity matrix" }
    ],
    correctAnswer: "B",
    logicContext: "1. Let C = AB - BA. 2. C' = (AB - BA)' = (AB)' - (BA)' = B'A' - A'B'. 3. Since A, B are symmetric, A'=A, B'=B. 4. C' = BA - AB = -(AB - BA) = -C. Thus, Skew-symmetric."
  },
  {
    id: "jm-mat-12",
    exam: "JEE Mains",
    subject: "Mathematics",
    year: 2023,
    text: "The mean of first 5 natural numbers is:",
    options: [
      { label: "A", text: "2" },
      { label: "B", text: "3" },
      { label: "C", text: "4" },
      { label: "D", text: "2.5" }
    ],
    correctAnswer: "B",
    logicContext: "1. Numbers are 1, 2, 3, 4, 5. 2. Sum = 15. 3. Mean = 15/5 = 3."
  },
  {
    id: "jm-mat-13",
    exam: "JEE Mains",
    subject: "Mathematics",
    year: 2024,
    text: "The value of cos⁻¹(-1/2) is:",
    options: [
      { label: "A", text: "π/3" },
      { label: "B", text: "2π/3" },
      { label: "C", text: "4π/3" },
      { label: "D", text: "-π/3" }
    ],
    correctAnswer: "B",
    logicContext: "1. cos⁻¹(-x) = π - cos⁻¹(x). 2. cos⁻¹(1/2) = π/3. 3. π - π/3 = 2π/3."
  },
  {
    id: "jm-mat-14",
    exam: "JEE Mains",
    subject: "Mathematics",
    year: 2024,
    text: "The eccentricity of the circle x² + y² = 25 is:",
    options: [
      { label: "A", text: "0" },
      { label: "B", text: "1" },
      { label: "C", text: "1/2" },
      { label: "D", text: "Undefined" }
    ],
    correctAnswer: "A",
    logicContext: "1. A circle is a special case of an ellipse where the two foci coincide. 2. By definition, the eccentricity of any circle is 0."
  },
  {
    id: "jm-mat-15",
    exam: "JEE Mains",
    subject: "Mathematics",
    year: 2023,
    text: "The focus of parabola y² = -8x is:",
    options: [
      { label: "A", text: "(2, 0)" },
      { label: "B", text: "(-2, 0)" },
      { label: "C", text: "(0, -2)" },
      { label: "D", text: "(0, 2)" }
    ],
    correctAnswer: "B",
    logicContext: "1. Standard form y² = -4ax. 2. 4a = 8 => a = 2. 3. Focus is (-a, 0) = (-2, 0)."
  },
  {
    id: "jm-mat-16",
    exam: "JEE Mains",
    subject: "Mathematics",
    year: 2024,
    text: "The angle between vectors i + j and j + k is:",
    options: [
      { label: "A", text: "0°" },
      { label: "B", text: "90°" },
      { label: "C", text: "60°" },
      { label: "D", text: "45°" }
    ],
    correctAnswer: "C",
    logicContext: "1. cos θ = (a . b) / (|a| |b|). 2. a.b = (1*0 + 1*1 + 0*1) = 1. 3. |a| = √2, |b| = √2. 4. cos θ = 1 / (√2 * √2) = 1/2. 5. θ = 60°."
  },

  // =========================================================================
  // JEE ADVANCED - 50 QUESTIONS (High / Multi-concept)
  // =========================================================================

  // --- PHYSICS (17) ---
  {
    id: "ja-phy-01",
    exam: "JEE Advanced",
    subject: "Physics",
    year: 2024,
    text: "A uniform rod of mass M and length L is hinged at one end and released from horizontal position. The angular acceleration of the rod when it makes angle θ with vertical is:",
    options: [
      { label: "A", text: "(3g/2L) sin θ" },
      { label: "B", text: "(3g/2L) cos θ" },
      { label: "C", text: "(g/L) sin θ" },
      { label: "D", text: "(3g/L) sin θ" }
    ],
    correctAnswer: "A",
    logicContext: "1. Torque τ = Iα. 2. τ = Mg * (L/2) sin θ (perpendicular distance of MG from hinge). 3. I = ML²/3 (for rod about end). 4. Mg(L/2) sin θ = (ML²/3) α => α = (3g/2L) sin θ."
  },
  {
    id: "ja-phy-02",
    exam: "JEE Advanced",
    subject: "Physics",
    year: 2023,
    text: "An electron enters a region of uniform magnetic field B and electric field E, both perpendicular to each other and to the velocity v. If the electron passes undeflected, then:",
    options: [
      { label: "A", text: "v = E/B" },
      { label: "B", text: "v = B/E" },
      { label: "C", text: "v = √(E/B)" },
      { label: "D", text: "v = EB" }
    ],
    correctAnswer: "A",
    logicContext: "1. Lorent force F = q(E + v x B). 2. For undeflected motion, net force = 0. 3. qE = qvB (since fields are perpendicular to v). 4. v = E/B."
  },
  {
    id: "ja-phy-03",
    exam: "JEE Advanced",
    subject: "Physics",
    year: 2024,
    text: "The escape velocity for a planet is ve. If the density of the planet is constant, the relationship between ve and planet's radius R is:",
    options: [
      { label: "A", text: "ve ∝ R" },
      { label: "B", text: "ve ∝ R²" },
      { label: "C", text: "ve ∝ √R" },
      { label: "D", text: "ve ∝ 1/R" }
    ],
    correctAnswer: "A",
    logicContext: "1. ve = √(2GM/R). 2. M = ρ * (4/3)πR³. 3. ve = √[2G * ρ * (4/3)πR³ / R] = R * √[(8/3)πGρ]. 4. Since ρ is constant, ve ∝ R."
  },
  {
    id: "ja-phy-04",
    exam: "JEE Advanced",
    subject: "Physics",
    year: 2024,
    text: "A Carnot engine has an efficiency of 40%. If the temperature of the sink is 300 K, what is the temperature of the source?",
    options: [
      { label: "A", text: "500 K" },
      { label: "B", text: "750 K" },
      { label: "C", text: "450 K" },
      { label: "D", text: "600 K" }
    ],
    correctAnswer: "A",
    logicContext: "1. Efficiency η = 1 - T_sink/T_source. 2. 0.4 = 1 - 300/T_source. 3. 300/T_source = 0.6. 4. T_source = 300 / 0.6 = 500 K."
  },
  {
    id: "ja-phy-05",
    exam: "JEE Advanced",
    subject: "Physics",
    year: 2023,
    text: "The path difference between two interfering waves at a point is λ/6. The phase difference is:",
    options: [
      { label: "A", text: "π/3" },
      { label: "B", text: "π/6" },
      { label: "C", text: "2π/3" },
      { label: "D", text: "π/2" }
    ],
    correctAnswer: "A",
    logicContext: "1. Phase difference Δφ = (2π/λ) * Path difference Δx. 2. Δφ = (2π/λ) * (λ/6) = 2π/6 = π/3."
  },
  {
    id: "ja-phy-06",
    exam: "JEE Advanced",
    subject: "Physics",
    year: 2024,
    text: "The Work function of a metal is 4.0 eV. The longest wavelength of light that can cause photoelectric effect is:",
    options: [
      { label: "A", text: "310 nm" },
      { label: "B", text: "400 nm" },
      { label: "C", text: "250 nm" },
      { label: "D", text: "500 nm" }
    ],
    correctAnswer: "A",
    logicContext: "1. λ_threshold = hc / Φ. 2. λ = 1240 / 4.0 nm. 3. λ = 310 nm."
  },
  {
    id: "ja-phy-07",
    exam: "JEE Advanced",
    subject: "Physics",
    year: 2024,
    text: "In a Bohr's model of hydrogen atom, the ratio of periods of revolution in n=1 and n=2 orbits is:",
    options: [
      { label: "A", text: "1:2" },
      { label: "B", text: "1:4" },
      { label: "C", text: "1:8" },
      { label: "D", text: "1:16" }
    ],
    correctAnswer: "C",
    logicContext: "1. Period T = 2πr/v. 2. r ∝ n², v ∝ 1/n. 3. T ∝ n² / (1/n) = n³. 4. T1/T2 = (1/2)³ = 1/8."
  },
  {
    id: "ja-phy-08",
    exam: "JEE Advanced",
    subject: "Physics",
    year: 2023,
    text: "A solid sphere and a hollow sphere of same mass and radius roll down an inclined plane. Which one reaches the bottom first?",
    options: [
      { label: "A", text: "Solid sphere" },
      { label: "B", text: "Hollow sphere" },
      { label: "C", text: "Both at same time" },
      { label: "D", text: "Depends on inclination" }
    ],
    correctAnswer: "A",
    logicContext: "1. Acceleration a = g sin θ / (1 + I/MR²). 2. For solid sphere, I = 2/5 MR², so 1 + I/MR² = 1.4. 3. For hollow sphere, I = 2/3 MR², so 1 + I/MR² = 1.67. 4. Lower I means higher acceleration. Solid reaches first."
  },
  {
    id: "ja-phy-09",
    exam: "JEE Advanced",
    subject: "Physics",
    year: 2024,
    text: "Two capillaries of same length but radii r and 2r are connected in series. The ratio of pressure drops across them is:",
    options: [
      { label: "A", text: "16:1" },
      { label: "B", text: "8:1" },
      { label: "C", text: "4:1" },
      { label: "D", text: "2:1" }
    ],
    correctAnswer: "A",
    logicContext: "1. Poiseuille's Law: Q = ΔP πr⁴ / (8ηL). 2. For series, Q is same. 3. ΔP ∝ 1/r⁴. 4. ΔP1 / ΔP2 = (2r/r)⁴ = 16/1."
  },
  {
    id: "ja-phy-10",
    exam: "JEE Advanced",
    subject: "Physics",
    year: 2024,
    text: "The magnetic field B at distance r from a long straight wire carrying current I is B = μ0 I / 2πr. The magnetic energy density at that point is:",
    options: [
      { label: "A", text: "B² / 2μ0" },
      { label: "B", text: "B / 2μ0" },
      { label: "C", text: "μ0 B² / 2" },
      { label: "D", text: "B² / μ0" }
    ],
    correctAnswer: "A",
    logicContext: "1. Magnetic energy density u_m = B² / (2μ0). 2. This is a general formula for energy stored per unit volume in a magnetic field."
  },
  {
    id: "ja-phy-11",
    exam: "JEE Advanced",
    subject: "Physics",
    year: 2023,
    text: "A particle of mass m is projected with velocity v at angle θ with horizontal. The angular momentum of particle about the point of projection when it is at maximum height is:",
    options: [
      { label: "A", text: "m v³ sin²θ cos θ / 2g" },
      { label: "B", text: "m v² sin θ cos θ / g" },
      { label: "C", text: "Zero" },
      { label: "D", text: "m v³ sin θ cos²θ / 2g" }
    ],
    correctAnswer: "A",
    logicContext: "1. L = r x p. At max height, r_perp = H_max = v² sin²θ / 2g. 2. Velocity at max height is v cos θ (horizontal). 3. L = m * (v cos θ) * H_max = m * v cos θ * (v² sin²θ / 2g) = m v³ sin²θ cos θ / 2g."
  },
  {
    id: "ja-phy-12",
    exam: "JEE Advanced",
    subject: "Physics",
    year: 2024,
    text: "The electric potential in a region is V = 2x² + 3y. The electric field at point (1, 2) is:",
    options: [
      { label: "A", text: "-4i - 3j" },
      { label: "B", text: "4i + 3j" },
      { label: "C", text: "-2i - 3j" },
      { label: "D", text: "i + j" }
    ],
    correctAnswer: "A",
    logicContext: "1. E = -∇V. 2. Ex = -∂V/∂x = -4x. Ey = -∂V/∂y = -3. 3. At (1, 2), Ex = -4, Ey = -3. 4. E = -4i - 3j."
  },
  {
    id: "ja-phy-13",
    exam: "JEE Advanced",
    subject: "Physics",
    year: 2024,
    text: "A radioactive sample has half-life T. The time required for 7/8 of the sample to decay is:",
    options: [
      { label: "A", text: "3T" },
      { label: "B", text: "2T" },
      { label: "C", text: "T/3" },
      { label: "D", text: "4T" }
    ],
    correctAnswer: "A",
    logicContext: "1. Sample remaining = 1 - 7/8 = 1/8. 2. (1/2)^n = 1/8 => n = 3. 3. Time = n * T = 3T."
  },
  {
    id: "ja-phy-14",
    exam: "JEE Advanced",
    subject: "Physics",
    year: 2023,
    text: "The efficiency of a full-wave rectifier is approximately:",
    options: [
      { label: "A", text: "81.2%" },
      { label: "B", text: "40.6%" },
      { label: "C", text: "100%" },
      { label: "D", text: "50%" }
    ],
    correctAnswer: "A",
    logicContext: "1. Max efficiency = 8η / π². 2. For half-wave it's 40.6%. 3. For full-wave, it's double, i.e., 81.2%."
  },
  {
    id: "ja-phy-15",
    exam: "JEE Advanced",
    subject: "Physics",
    year: 2024,
    text: "A spherical shell of radius R has charge Q. The electric field at distance r < R is:",
    options: [
      { label: "A", text: "Zero" },
      { label: "B", text: "kQ/r²" },
      { label: "C", text: "kQ/R²" },
      { label: "D", text: "kQr/R³" }
    ],
    correctAnswer: "A",
    logicContext: "1. Use Gauss's Law. Inside a hollow conductor, enclosed charge is zero. 2. Therefore, Φ = E.A = 0 => E = 0."
  },
  {
    id: "ja-phy-16",
    exam: "JEE Advanced",
    subject: "Physics",
    year: 2024,
    text: "The damping force on an oscillator is directly proportional to its velocity. The units of damping constant are:",
    options: [
      { label: "A", text: "kg/s" },
      { label: "B", text: "kg s" },
      { label: "C", text: "kg/m" },
      { label: "D", text: "N s" }
    ],
    correctAnswer: "A",
    logicContext: "1. F = -bv. 2. b = F / v. 3. Units: [MLT⁻²] / [LT⁻¹] = [MT⁻¹]. 4. This is kg/s."
  },
  {
    id: "ja-phy-17",
    exam: "JEE Advanced",
    subject: "Physics",
    year: 2024,
    text: "The Young's modulus of a wire is Y. If the radius is doubled and length is halved, the new Young's modulus is:",
    options: [
      { label: "A", text: "Y" },
      { label: "B", text: "2Y" },
      { label: "C", text: "4Y" },
      { label: "D", text: "Y/2" }
    ],
    correctAnswer: "A",
    logicContext: "1. Young's modulus is a material property. 2. It does not depend on the dimensions (length, radius) of the wire."
  },

  // --- CHEMISTRY (17) ---
  {
    id: "ja-chm-01",
    exam: "JEE Advanced",
    subject: "Chemistry",
    year: 2024,
    text: "The number of geometrical isomers of [Co(en)2Cl2]+ is:",
    options: [
      { label: "A", text: "2" },
      { label: "B", text: "3" },
      { label: "C", text: "4" },
      { label: "D", text: "1" }
    ],
    correctAnswer: "A",
    logicContext: "1. The complex is [M(AA)2B2] type. 2. It exists as 'cis' and 'trans' isomers. 3. Cis isomer is optically active, but the question asks for geometrical isomers only."
  },
  {
    id: "ja-chm-02",
    exam: "JEE Advanced",
    subject: "Chemistry",
    year: 2024,
    text: "The half-life of a first-order reaction is 10 minutes. The time taken for 90% completion is:",
    options: [
      { label: "A", text: "33.2 min" },
      { label: "B", text: "20 min" },
      { label: "C", text: "43.2 min" },
      { label: "D", text: "50 min" }
    ],
    correctAnswer: "A",
    logicContext: "1. k = 0.693 / 10 = 0.0693 min⁻¹. 2. t = (2.303/k) log(100/10) = (2.303/0.0693) * 1. 3. t ≈ 33.22 min."
  },
  {
    id: "ja-chm-03",
    exam: "JEE Advanced",
    subject: "Chemistry",
    year: 2023,
    text: "The entropy change for the reversible expansion of an ideal gas is:",
    options: [
      { label: "A", text: "nR ln(V2/V1)" },
      { label: "B", text: "nR ln(P2/P1)" },
      { label: "C", text: "Zero" },
      { label: "D", text: "ΔH/T" }
    ],
    correctAnswer: "A",
    logicContext: "1. dS = dq_rev / T. 2. For isothermal expansion, dq_rev = dW = P dV = (nRT/V) dV. 3. dS = (nR/V) dV. 4. ΔS = nR ∫(1/V) dV = nR ln(V2/V1)."
  },
  {
    id: "ja-chm-04",
    exam: "JEE Advanced",
    subject: "Chemistry",
    year: 2024,
    text: "Which of the following will show the highest osmotic pressure?",
    options: [
      { label: "A", text: "1M NaCl" },
      { label: "B", text: "1M Urea" },
      { label: "C", text: "1M AlCl3" },
      { label: "D", text: "1M Na2SO4" }
    ],
    correctAnswer: "C",
    logicContext: "1. π = iCRT. 2. i is van't Hoff factor. 3. NaCl (i=2), Urea (i=1), AlCl3 (i=4), Na2SO4 (i=3). 4. AlCl3 gives 4 particles per molecule, so highest pressure."
  },
  {
    id: "ja-chm-05",
    exam: "JEE Advanced",
    subject: "Chemistry",
    year: 2024,
    text: "The main product of the reaction between Phenol and Bromine water is:",
    options: [
      { label: "A", text: "2,4,6-Tribromophenol" },
      { label: "B", text: "o-Bromophenol" },
      { label: "C", text: "p-Bromophenol" },
      { label: "D", text: "m-Bromophenol" }
    ],
    correctAnswer: "A",
    logicContext: "1. Phenol is highly activated by -OH group. 2. Bromine water provides high concentration of Br+. 3. Electrophilic substitution occurs at all ortho and para positions, giving a white precipitate of 2,4,6-tribromophenol."
  },
  {
    id: "ja-chm-06",
    exam: "JEE Advanced",
    subject: "Chemistry",
    year: 2023,
    text: "Which of the following is not an example of an addition polymer?",
    options: [
      { label: "A", text: "Polyethylene" },
      { label: "B", text: "Polystyrene" },
      { label: "C", text: "Nylon 6,6" },
      { label: "D", text: "PVC" }
    ],
    correctAnswer: "C",
    logicContext: "1. Addition polymers involve direct addition of monomers (e.g., Alkenes). 2. Nylon 6,6 is a condensation polymer formed by the elimination of water from Adipic acid and Hexamethylenediamine."
  },
  {
    id: "ja-chm-07",
    exam: "JEE Advanced",
    subject: "Chemistry",
    year: 2024,
    text: "The coordination number of Cs in CsCl crystal is:",
    options: [
      { label: "A", text: "8" },
      { label: "B", text: "6" },
      { label: "C", text: "12" },
      { label: "D", text: "4" }
    ],
    correctAnswer: "A",
    logicContext: "1. CsCl has a body-centered type structure (but it's simple cubic lattices of each). 2. Cs+ ion sits at the center of a cube formed by 8 Cl- ions. 3. Thus, coordination number is 8."
  },
  {
    id: "ja-chm-08",
    exam: "JEE Advanced",
    subject: "Chemistry",
    year: 2024,
    text: "Strongest acid among the following is:",
    options: [
      { label: "A", text: "CH3COOH" },
      { label: "B", text: "CH2ClCOOH" },
      { label: "C", text: "CHCl2COOH" },
      { label: "D", text: "CCl3COOH" }
    ],
    correctAnswer: "D",
    logicContext: "1. Acidity increases with the presence of electron-withdrawing groups (-I effect). 2. Three Cl atoms pull electrons away from -COOH, stabilizing the carboxylate anion. 3. Order: CCl3COOH > CHCl2COOH > CH2ClCOOH > CH3COOH."
  },
  {
    id: "ja-chm-09",
    exam: "JEE Advanced",
    subject: "Chemistry",
    year: 2023,
    text: "Which of the following statements is true for a zero-order reaction?",
    options: [
      { label: "A", text: "t1/2 ∝ [A]0" },
      { label: "B", text: "t1/2 ∝ 1/[A]0" },
      { label: "C", text: "Rate ∝ [A]0" },
      { label: "D", text: "t1/2 is constant" }
    ],
    correctAnswer: "A",
    logicContext: "1. For zero order: [A] = [A]0 - kt. 2. At t1/2, [A] = [A]0/2. 3. [A]0/2 = [A]0 - k t1/2 => t1/2 = [A]0 / 2k. 4. Thus, t1/2 is directly proportional to initial concentration."
  },
  {
    id: "ja-chm-10",
    exam: "JEE Advanced",
    subject: "Chemistry",
    year: 2024,
    text: "Shape of ClF3 is:",
    options: [
      { label: "A", text: "T-shaped" },
      { label: "B", text: "Trigonal planar" },
      { label: "C", text: "Pyramidal" },
      { label: "D", text: "Bent" }
    ],
    correctAnswer: "A",
    logicContext: "1. Cl has 7 valence electrons. 3 bond pairs, 2 lone pairs. 2. Steric number = 5. sp³d hybridization. 3. To minimize repulsion, lone pairs occupy equatorial positions. 4. Molecular shape is T-shaped."
  },
  {
    id: "ja-chm-11",
    exam: "JEE Advanced",
    subject: "Chemistry",
    year: 2024,
    text: "Which amino acid is not optically active?",
    options: [
      { label: "A", text: "Glycine" },
      { label: "B", text: "Alanine" },
      { label: "C", text: "Valine" },
      { label: "D", text: "Leucine" }
    ],
    correctAnswer: "A",
    logicContext: "1. Amino acids are chiral if the alpha-carbon is attached to four different groups. 2. In Glycine, the R-group is a Hydrogen atom. 3. Since there are two H atoms on alpha-carbon, it is achiral and optically inactive."
  },
  {
    id: "ja-chm-12",
    exam: "JEE Advanced",
    subject: "Chemistry",
    year: 2023,
    text: "The number of ions per formula unit in K4[Fe(CN)6] is:",
    options: [
      { label: "A", text: "5" },
      { label: "B", text: "2" },
      { label: "C", text: "4" },
      { label: "D", text: "1" }
    ],
    correctAnswer: "A",
    logicContext: "1. The complex dissociates into 4 K+ ions and 1 [Fe(CN)6]⁴⁻ complex ion. 2. Total ions = 4 + 1 = 5."
  },
  {
    id: "ja-chm-13",
    exam: "JEE Advanced",
    subject: "Chemistry",
    year: 2024,
    text: "Standard electrode potential of SHE is:",
    options: [
      { label: "A", text: "0 V" },
      { label: "B", text: "1 V" },
      { label: "C", text: "0.8 V" },
      { label: "D", text: "-0.76 V" }
    ],
    correctAnswer: "A",
    logicContext: "1. Standard Hydrogen Electrode (SHE) is used as a reference. 2. Its potential is arbitrarily taken as 0.00 V at all temperatures."
  },
  {
    id: "ja-chm-14",
    exam: "JEE Advanced",
    subject: "Chemistry",
    year: 2024,
    text: "Which of the following is an example of an ambidentate ligand?",
    options: [
      { label: "A", text: "NO2-" },
      { label: "B", text: "H2O" },
      { label: "C", text: "NH3" },
      { label: "D", text: "Cl-" }
    ],
    correctAnswer: "A",
    logicContext: "1. Ambidentate ligands can bind to the central metal through more than one atom. 2. Nitrite (NO2-) can bind via N (nitro) or O (nitrito)."
  },
  {
    id: "ja-chm-15",
    exam: "JEE Advanced",
    subject: "Chemistry",
    year: 2023,
    text: "The major product of reaction between HBr and propene in presence of peroxide is:",
    options: [
      { label: "A", text: "1-Bromopropane" },
      { label: "B", text: "2-Bromopropane" },
      { label: "C", text: "1,2-Dibromopropane" },
      { label: "D", text: "Propane" }
    ],
    correctAnswer: "A",
    logicContext: "1. Peroxide effect (Kharasch effect) occurs only with HBr. 2. It follows anti-Markovnikov addition. 3. Br attaches to the terminal carbon of propene."
  },
  {
    id: "ja-chm-16",
    exam: "JEE Advanced",
    subject: "Chemistry",
    year: 2024,
    text: "Which noble gas is used in magnetic resonance imaging (MRI)?",
    options: [
      { label: "A", text: "He" },
      { label: "B", text: "Ne" },
      { label: "C", text: "Ar" },
      { label: "D", text: "Xe" }
    ],
    correctAnswer: "A",
    logicContext: "1. Liquid Helium is used to cool the superconducting magnets in MRI machines. 2. It provides the low temperatures (approx 4K) necessary for superconductivity."
  },
  {
    id: "ja-chm-17",
    exam: "JEE Advanced",
    subject: "Chemistry",
    year: 2024,
    text: "Calculate the packing fraction of a simple cubic lattice:",
    options: [
      { label: "A", text: "0.52" },
      { label: "B", text: "0.68" },
      { label: "C", text: "0.74" },
      { label: "D", text: "0.48" }
    ],
    correctAnswer: "A",
    logicContext: "1. Efficiency = (Volume of 1 atom) / (Volume of unit cell). 2. V_atom = (4/3)πr³. V_cell = a³ = (2r)³ = 8r³. 3. Fraction = (4/3)πr³ / 8r³ = π/6 ≈ 0.5236."
  },

  // --- MATHEMATICS (16) ---
  {
    id: "ja-mat-01",
    exam: "JEE Advanced",
    subject: "Mathematics",
    year: 2024,
    text: "The value of ∫ [x] dx from 0 to 2, where [x] is the greatest integer function, is:",
    options: [
      { label: "A", text: "1" },
      { label: "B", text: "2" },
      { label: "C", text: "1.5" },
      { label: "D", text: "0.5" }
    ],
    correctAnswer: "A",
    logicContext: "1. Break the integral at integer points: ∫[x] dx = ∫[x] dx from 0 to 1 + ∫[x] dx from 1 to 2. 2. From 0 to 1, [x] = 0. From 1 to 2, [x] = 1. 3. Result = 0 * (1-0) + 1 * (2-1) = 1."
  },
  {
    id: "ja-mat-02",
    exam: "JEE Advanced",
    subject: "Mathematics",
    year: 2024,
    text: "The number of ways to arrange 5 people in a circle is:",
    options: [
      { label: "A", text: "120" },
      { label: "B", text: "24" },
      { label: "C", text: "60" },
      { label: "D", text: "5" }
    ],
    correctAnswer: "B",
    logicContext: "1. Circular permutation of n items is (n-1)!. 2. For 5 people, it is (5-1)! = 4! = 24."
  },
  {
    id: "ja-mat-03",
    exam: "JEE Advanced",
    subject: "Mathematics",
    year: 2023,
    text: "The sum of the series 1 + 2x + 3x² + ... for |x| < 1 is:",
    options: [
      { label: "A", text: "1/(1-x)²" },
      { label: "B", text: "1/(1-x)" },
      { label: "C", text: "1/(1+x)²" },
      { label: "D", text: "x/(1-x)²" }
    ],
    correctAnswer: "A",
    logicContext: "1. This is the derivative of the geometric series 1 + x + x² + ... 2. d/dx [1/(1-x)] = d/dx [1 + x + x² + x³ + ...]. 3. (1-x)⁻² = 1 + 2x + 3x² + ..."
  },
  {
    id: "ja-mat-04",
    exam: "JEE Advanced",
    subject: "Mathematics",
    year: 2024,
    text: "The limit of (1 + 1/n)^n as n approaches infinity is:",
    options: [
      { label: "A", text: "1" },
      { label: "B", text: "e" },
      { label: "C", text: "0" },
      { label: "D", text: "Infinite" }
    ],
    correctAnswer: "B",
    logicContext: "1. This is the definition of the mathematical constant e. 2. It can be verified using L'Hopital's rule on the logarithm of the expression."
  },
  {
    id: "ja-mat-05",
    exam: "JEE Advanced",
    subject: "Mathematics",
    year: 2024,
    text: "The equation of the tangent to the circle x² + y² = 25 at (3, 4) is:",
    options: [
      { label: "A", text: "3x + 4y = 25" },
      { label: "B", text: "4x + 3y = 25" },
      { label: "C", text: "3x - 4y = 25" },
      { label: "D", text: "4x - 3y = 25" }
    ],
    correctAnswer: "A",
    logicContext: "1. Tangent formula for x² + y² = r² at (x1, y1) is x x1 + y y1 = r². 2. Substitute (3, 4): 3x + 4y = 25."
  },
  {
    id: "ja-mat-06",
    exam: "JEE Advanced",
    subject: "Mathematics",
    year: 2023,
    text: "If A is a 3x3 matrix and |adj A| = 64, then |A| is:",
    options: [
      { label: "A", text: "8 or -8" },
      { label: "B", text: "4" },
      { label: "C", text: "64" },
      { label: "D", text: "16" }
    ],
    correctAnswer: "A",
    logicContext: "1. |adj A| = |A|^(n-1). 2. 64 = |A|^(3-1) = |A|². 3. |A| = ±8."
  },
  {
    id: "ja-mat-07",
    exam: "JEE Advanced",
    subject: "Mathematics",
    year: 2024,
    text: "The area bounded by y = x² and y = x is:",
    options: [
      { label: "A", text: "1/6" },
      { label: "B", text: "1/3" },
      { label: "C", text: "1/2" },
      { label: "D", text: "1" }
    ],
    correctAnswer: "A",
    logicContext: "1. Intersection: x² = x => x = 0, 1. 2. Area = ∫(x - x²) dx from 0 to 1. 3. [x²/2 - x³/3] = 1/2 - 1/3 = 1/6."
  },
  {
    id: "ja-mat-08",
    exam: "JEE Advanced",
    subject: "Mathematics",
    year: 2024,
    text: "The number of real solutions of the equation sin x = x is:",
    options: [
      { label: "A", text: "1" },
      { label: "B", text: "3" },
      { label: "C", text: "0" },
      { label: "D", text: "Infinite" }
    ],
    correctAnswer: "A",
    logicContext: "1. Let f(x) = x - sin x. 2. f'(x) = 1 - cos x. Since f'(x) ≥ 0, f(x) is non-decreasing. 3. f(0) = 0. 4. Since it is strictly increasing except at isolated points, 0 is the only root."
  },
  {
    id: "ja-mat-09",
    exam: "JEE Advanced",
    subject: "Mathematics",
    year: 2023,
    text: "The probability that a non-leap year has 53 Sundays is:",
    options: [
      { label: "A", text: "1/7" },
      { label: "B", text: "2/7" },
      { label: "C", text: "0" },
      { label: "D", text: "52/365" }
    ],
    correctAnswer: "A",
    logicContext: "1. Non-leap year has 365 days = 52 weeks + 1 extra day. 2. The extra day can be any of the 7 days. 3. For 53 Sundays, the extra day must be Sunday. Probability = 1/7."
  },
  {
    id: "ja-mat-10",
    exam: "JEE Advanced",
    subject: "Mathematics",
    year: 2024,
    text: "The eccentricity of the rectangular hyperbola x² - y² = a² is:",
    options: [
      { label: "A", text: "√2" },
      { label: "B", text: "1" },
      { label: "C", text: "2" },
      { label: "D", text: "√3" }
    ],
    correctAnswer: "A",
    logicContext: "1. e = √(1 + b²/a²). 2. For rectangular hyperbola, b = a. 3. e = √(1 + 1) = √2."
  },
  {
    id: "ja-mat-11",
    exam: "JEE Advanced",
    subject: "Mathematics",
    year: 2024,
    text: "The period of the function f(x) = sin(x/3) + cos(x/2) is:",
    options: [
      { label: "A", text: "12π" },
      { label: "B", text: "6π" },
      { label: "C", text: "2π" },
      { label: "D", text: "4π" }
    ],
    correctAnswer: "A",
    logicContext: "1. Period of sin(x/3) = 2π / (1/3) = 6π. 2. Period of cos(x/2) = 2π / (1/2) = 4π. 3. Period of sum = LCM(6π, 4π) = 12π."
  },
  {
    id: "ja-mat-12",
    exam: "JEE Advanced",
    subject: "Mathematics",
    year: 2023,
    text: "If f(x) = x³ - 3x + 2, the number of local extrema is:",
    options: [
      { label: "A", text: "2" },
      { label: "B", text: "1" },
      { label: "C", text: "3" },
      { label: "D", text: "0" }
    ],
    correctAnswer: "A",
    logicContext: "1. f'(x) = 3x² - 3. 2. Set f'(x) = 0 => x² = 1 => x = ±1. 3. f''(x) = 6x. 4. f''(1) = 6 (min), f''(-1) = -6 (max). Total 2 extrema."
  },
  {
    id: "ja-mat-13",
    exam: "JEE Advanced",
    subject: "Mathematics",
    year: 2024,
    text: "The distance between parallel planes 2x - y + 2z = 4 and 2x - y + 2z = 10 is:",
    options: [
      { label: "A", text: "2" },
      { label: "B", text: "6" },
      { label: "C", text: "3" },
      { label: "D", text: "4" }
    ],
    correctAnswer: "A",
    logicContext: "1. d = |d2 - d1| / √(a² + b² + c²). 2. d = |10 - 4| / √(2² + (-1)² + 2²) = 6 / √9 = 6/3 = 2."
  },
  {
    id: "ja-mat-14",
    exam: "JEE Advanced",
    subject: "Mathematics",
    year: 2024,
    text: "The coefficient of x³ in the expansion of (1 + x)⁵ is:",
    options: [
      { label: "A", text: "10" },
      { label: "B", text: "5" },
      { label: "C", text: "1" },
      { label: "D", text: "20" }
    ],
    correctAnswer: "A",
    logicContext: "1. General term Tr+1 = nCr x^r. 2. For x³, r = 3. 3. Coefficient = 5C3 = 10."
  },
  {
    id: "ja-mat-15",
    exam: "JEE Advanced",
    subject: "Mathematics",
    year: 2023,
    text: "The projection of vector a = i + j on b = i - j is:",
    options: [
      { label: "A", text: "0" },
      { label: "B", text: "1" },
      { label: "C", text: "√2" },
      { label: "D", text: "-1" }
    ],
    correctAnswer: "A",
    logicContext: "1. Projection = (a . b) / |b|. 2. a.b = (1)(1) + (1)(-1) = 0. 3. Since dot product is zero, projection is zero."
  },
  {
    id: "ja-mat-16",
    exam: "JEE Advanced",
    subject: "Mathematics",
    year: 2024,
    text: "If y = x^x, then dy/dx at x=1 is:",
    options: [
      { label: "A", text: "1" },
      { label: "B", text: "0" },
      { label: "C", text: "e" },
      { label: "D", text: "ln 2" }
    ],
    correctAnswer: "A",
    logicContext: "1. ln y = x ln x. 2. (1/y) dy/dx = ln x + x(1/x) = ln x + 1. 3. dy/dx = y(ln x + 1). 4. At x=1, y = 1¹ = 1. dy/dx = 1(ln 1 + 1) = 1."
  },

  // =========================================================================
  // NEET - 50 QUESTIONS (Conceptual / NCERT-based)
  // =========================================================================

  // --- PHYSICS (12) ---
  {
    id: "nt-phy-01",
    exam: "NEET",
    subject: "Physics",
    year: 2024,
    text: "A force F = 20 + 10y acts on a particle in y-direction. Work done by this force to move the particle from y=0 to y=1m is:",
    options: [
      { label: "A", text: "25 J" },
      { label: "B", text: "20 J" },
      { label: "C", text: "30 J" },
      { label: "D", text: "5 J" }
    ],
    correctAnswer: "A",
    logicContext: "1. W = ∫F dy from 0 to 1. 2. W = ∫(20 + 10y) dy = [20y + 5y²] from 0 to 1. 3. W = 20(1) + 5(1)² = 25 J."
  },
  {
    id: "nt-phy-02",
    exam: "NEET",
    subject: "Physics",
    year: 2024,
    text: "The bulk modulus of a perfectly rigid body is:",
    options: [
      { label: "A", text: "Zero" },
      { label: "B", text: "Infinite" },
      { label: "C", text: "Unity" },
      { label: "D", text: "100" }
    ],
    correctAnswer: "B",
    logicContext: "1. Bulk Modulus B = -ΔP / (ΔV/V). 2. For a perfectly rigid body, ΔV = 0 (it does not deform). 3. Division by zero leads to infinity."
  },
  {
    id: "nt-phy-03",
    exam: "NEET",
    subject: "Physics",
    year: 2023,
    text: "In an isobaric process, the work done by a gas is W. The heat given to the gas is (if γ = 1.4):",
    options: [
      { label: "A", text: "3.5 W" },
      { label: "B", text: "2.5 W" },
      { label: "C", text: "1.4 W" },
      { label: "D", text: "0.7 W" }
    ],
    correctAnswer: "A",
    logicContext: "1. In isobaric, W = PΔV = nRΔT. 2. Q = nCpΔT. 3. Q/W = nCpΔT / nRΔT = Cp / (Cp - Cv) = γ / (γ - 1). 4. For γ = 1.4, Q/W = 1.4 / 0.4 = 3.5. So Q = 3.5 W."
  },
  {
    id: "nt-phy-04",
    exam: "NEET",
    subject: "Physics",
    year: 2024,
    text: "The focal length of a plane mirror is:",
    options: [
      { label: "A", text: "Zero" },
      { label: "B", text: "Infinite" },
      { label: "C", text: "25 cm" },
      { label: "D", text: "50 cm" }
    ],
    correctAnswer: "B",
    logicContext: "1. A plane mirror can be considered a spherical mirror with an infinite radius of curvature (R = ∞). 2. Since f = R/2, f = ∞."
  },
  {
    id: "nt-phy-05",
    exam: "NEET",
    subject: "Physics",
    year: 2023,
    text: "The resistance of an ideal ammeter and an ideal voltmeter are respectively:",
    options: [
      { label: "A", text: "Zero, Infinite" },
      { label: "B", text: "Infinite, Zero" },
      { label: "C", text: "Zero, Zero" },
      { label: "D", text: "Infinite, Infinite" }
    ],
    correctAnswer: "A",
    logicContext: "1. Ammeter is connected in series; zero resistance ensures no voltage drop. 2. Voltmeter is connected in parallel; infinite resistance ensures no current is drawn from the circuit."
  },
  {
    id: "nt-phy-06",
    exam: "NEET",
    subject: "Physics",
    year: 2024,
    text: "The core of a transformer is laminated to reduce:",
    options: [
      { label: "A", text: "Hysteresis loss" },
      { label: "B", text: "Eddy current loss" },
      { label: "C", text: "Copper loss" },
      { label: "D", text: "Magnetic flux leakage" }
    ],
    correctAnswer: "B",
    logicContext: "1. Changing magnetic flux induces eddy currents in the bulk metal core. 2. Laminations break the path for these currents, increasing resistance and reducing heat loss."
  },
  {
    id: "nt-phy-07",
    exam: "NEET",
    subject: "Physics",
    year: 2024,
    text: "A transistor is used in common emitter mode as an amplifier. The power gain is:",
    options: [
      { label: "A", text: "Current gain x Voltage gain" },
      { label: "B", text: "Current gain + Voltage gain" },
      { label: "C", text: "Voltage gain / Current gain" },
      { label: "D", text: "Square of Voltage gain" }
    ],
    correctAnswer: "A",
    logicContext: "1. Power P = V * I. 2. Power Gain = ΔP_out / ΔP_in = (ΔV_out * ΔI_out) / (ΔV_in * ΔI_in) = Voltage Gain * Current Gain."
  },
  {
    id: "nt-phy-08",
    exam: "NEET",
    subject: "Physics",
    year: 2023,
    text: "The energy of a photon of wavelength 400 nm is approximately:",
    options: [
      { label: "A", text: "3.1 eV" },
      { label: "B", text: "2.1 eV" },
      { label: "C", text: "1.1 eV" },
      { label: "D", text: "4.1 eV" }
    ],
    correctAnswer: "A",
    logicContext: "1. E = 1240 / λ (in nm). 2. E = 1240 / 400 = 3.1 eV."
  },
  {
    id: "nt-phy-09",
    exam: "NEET",
    subject: "Physics",
    year: 2024,
    text: "The speed of light in a medium of refractive index 1.5 is:",
    options: [
      { label: "A", text: "2 x 10⁸ m/s" },
      { label: "B", text: "3 x 10⁸ m/s" },
      { label: "C", text: "1.5 x 10⁸ m/s" },
      { label: "D", text: "4.5 x 10⁸ m/s" }
    ],
    correctAnswer: "A",
    logicContext: "1. n = c / v. 2. v = c / n = (3 x 10⁸) / 1.5 = 2 x 10⁸ m/s."
  },
  {
    id: "nt-phy-10",
    exam: "NEET",
    subject: "Physics",
    year: 2024,
    text: "Which of the following has the smallest wavelength?",
    options: [
      { label: "A", text: "Gamma rays" },
      { label: "B", text: "X-rays" },
      { label: "C", text: "UV rays" },
      { label: "D", text: "Radio waves" }
    ],
    correctAnswer: "A",
    logicContext: "1. In the EM spectrum, frequency increases from Radio to Gamma. 2. Since v = fλ, higher frequency means smaller wavelength. Gamma rays have the highest frequency."
  },
  {
    id: "nt-phy-11",
    exam: "NEET",
    subject: "Physics",
    year: 2023,
    text: "A body of mass 2 kg is moving with velocity 10 m/s. Its kinetic energy is:",
    options: [
      { label: "A", text: "100 J" },
      { label: "B", text: "20 J" },
      { label: "C", text: "200 J" },
      { label: "D", text: "50 J" }
    ],
    correctAnswer: "A",
    logicContext: "1. K.E. = 1/2 m v². 2. K.E. = 0.5 * 2 * (10)² = 100 J."
  },
  {
    id: "nt-phy-12",
    exam: "NEET",
    subject: "Physics",
    year: 2024,
    text: "The acceleration of a freely falling body depends on:",
    options: [
      { label: "A", text: "Its mass" },
      { label: "B", text: "Its size" },
      { label: "C", text: "Gravity of planet" },
      { label: "D", text: "Initial velocity" }
    ],
    correctAnswer: "C",
    logicContext: "1. F = GmM/R² = ma. 2. a = g = GM/R². 3. Notice that 'm' (mass of object) cancels out. Acceleration depends only on the planet's mass and radius."
  },

  // --- CHEMISTRY (13) ---
  {
    id: "nt-chm-01",
    exam: "NEET",
    subject: "Chemistry",
    year: 2024,
    text: "The number of atoms in 4g of Hydrogen gas is:",
    options: [
      { label: "A", text: "NA" },
      { label: "B", text: "2 NA" },
      { label: "C", text: "4 NA" },
      { label: "D", text: "0.5 NA" }
    ],
    correctAnswer: "C",
    logicContext: "1. Molar mass of H2 = 2g/mol. 2. Moles of H2 = 4g / 2g/mol = 2 moles. 3. Each H2 has 2 atoms. Total atoms = 2 * 2 * NA = 4 NA."
  },
  {
    id: "nt-chm-02",
    exam: "NEET",
    subject: "Chemistry",
    year: 2024,
    text: "Which of the following is an example of an intramolecular hydrogen bond?",
    options: [
      { label: "A", text: "H2O" },
      { label: "B", text: "o-Nitrophenol" },
      { label: "C", text: "NH3" },
      { label: "D", text: "p-Nitrophenol" }
    ],
    correctAnswer: "B",
    logicContext: "1. Intramolecular H-bond occurs within the same molecule. 2. In o-nitrophenol, -OH and -NO2 are close enough to form a bond. 3. Others show intermolecular bonding."
  },
  {
    id: "nt-chm-03",
    exam: "NEET",
    subject: "Chemistry",
    year: 2023,
    text: "The oxidation state of Oxygen in OF2 is:",
    options: [
      { label: "A", text: "-2" },
      { label: "B", text: "+2" },
      { label: "C", text: "-1" },
      { label: "D", text: "0" }
    ],
    correctAnswer: "B",
    logicContext: "1. Fluorine is the most electronegative element, always -1 in compounds. 2. x + 2(-1) = 0 => x = +2."
  },
  {
    id: "nt-chm-04",
    exam: "NEET",
    subject: "Chemistry",
    year: 2024,
    text: "The gas used in discharge tubes for advertisement is:",
    options: [
      { label: "A", text: "Helium" },
      { label: "B", text: "Neon" },
      { label: "C", text: "Argon" },
      { label: "D", text: "Krypton" }
    ],
    correctAnswer: "B",
    logicContext: "1. Neon gas gives a distinct bright orange-red glow when used in discharge tubes. 2. It is the classic 'neon light'."
  },
  {
    id: "nt-chm-05",
    exam: "NEET",
    subject: "Chemistry",
    year: 2024,
    text: "Which of the following has the highest electronegativity?",
    options: [
      { label: "A", text: "Cl" },
      { label: "B", text: "F" },
      { label: "C", text: "O" },
      { label: "D", text: "N" }
    ],
    correctAnswer: "B",
    logicContext: "1. Pauling scale values: F (4.0), O (3.5), N (3.0), Cl (3.0). 2. Fluorine is the most electronegative element."
  },
  {
    id: "nt-chm-06",
    exam: "NEET",
    subject: "Chemistry",
    year: 2023,
    text: "Sucrose on hydrolysis gives:",
    options: [
      { label: "A", text: "Glucose + Glucose" },
      { label: "B", text: "Glucose + Fructose" },
      { label: "C", text: "Glucose + Galactose" },
      { label: "D", text: "Fructose + Fructose" }
    ],
    correctAnswer: "B",
    logicContext: "1. Sucrose is a disaccharide of α-D-glucose and β-D-fructose. 2. It is a non-reducing sugar."
  },
  {
    id: "nt-chm-07",
    exam: "NEET",
    subject: "Chemistry",
    year: 2024,
    text: "The catalyst used in the Haber process is:",
    options: [
      { label: "A", text: "Iron" },
      { label: "B", text: "Nickel" },
      { label: "C", text: "Platinum" },
      { label: "D", text: "V2O5" }
    ],
    correctAnswer: "A",
    logicContext: "1. Finely divided Iron with Molybdenum as promoter is used to synthesize Ammonia. 2. Nickel is used for hydrogenation. V2O5 for Contact process."
  },
  {
    id: "nt-chm-08",
    exam: "NEET",
    subject: "Chemistry",
    year: 2024,
    text: "The pH of 0.01 M HCl solution is:",
    options: [
      { label: "A", text: "1" },
      { label: "B", text: "2" },
      { label: "C", text: "7" },
      { label: "D", text: "0" }
    ],
    correctAnswer: "B",
    logicContext: "1. HCl is a strong acid, [H+] = 0.01 = 10⁻². 2. pH = -log[H+] = -log(10⁻²) = 2."
  },
  {
    id: "nt-chm-09",
    exam: "NEET",
    subject: "Chemistry",
    year: 2023,
    text: "Aspirin is chemically:",
    options: [
      { label: "A", text: "Acetylsalicylic acid" },
      { label: "B", text: "Methyl salicylate" },
      { label: "C", text: "Phenyl salicylate" },
      { label: "D", text: "Salicylic acid" }
    ],
    correctAnswer: "A",
    logicContext: "1. Aspirin is formed by the acetylation of salicylic acid using acetic anhydride."
  },
  {
    id: "nt-chm-10",
    exam: "NEET",
    subject: "Chemistry",
    year: 2024,
    text: "Which of the following is not a greenhouse gas?",
    options: [
      { label: "A", text: "CO2" },
      { label: "B", text: "CH4" },
      { label: "C", text: "N2" },
      { label: "D", text: "O3" }
    ],
    correctAnswer: "C",
    logicContext: "1. Greenhouse gases include CO2, Methane, Nitrous oxide, and Ozone. 2. Nitrogen (N2) and Oxygen (O2) do not absorb IR radiation."
  },
  {
    id: "nt-chm-11",
    exam: "NEET",
    subject: "Chemistry",
    year: 2024,
    text: "Vitamin B12 contains which metal?",
    options: [
      { label: "A", text: "Iron" },
      { label: "B", text: "Cobalt" },
      { label: "C", text: "Magnesium" },
      { label: "D", text: "Zinc" }
    ],
    correctAnswer: "B",
    logicContext: "1. Vitamin B12 (Cyanocobalamin) is a coordination compound of Cobalt."
  },
  {
    id: "nt-chm-12",
    exam: "NEET",
    subject: "Chemistry",
    year: 2023,
    text: "Bakelite is a polymer of phenol and:",
    options: [
      { label: "A", text: "Formaldehyde" },
      { label: "B", text: "Acetaldehyde" },
      { label: "C", text: "Ethylene glycol" },
      { label: "D", text: "Melamine" }
    ],
    correctAnswer: "A",
    logicContext: "1. Bakelite is a thermosetting phenol-formaldehyde resin."
  },
  {
    id: "nt-chm-13",
    exam: "NEET",
    subject: "Chemistry",
    year: 2024,
    text: "Which of the following is most basic?",
    options: [
      { label: "A", text: "NH3" },
      { label: "B", text: "CH3NH2" },
      { label: "C", text: "(CH3)2NH" },
      { label: "D", text: "(CH3)3N" }
    ],
    correctAnswer: "C",
    logicContext: "1. In aqueous phase, the basicity of methyl-substituted amines follows: 2° > 1° > 3° > Ammonia. 2. This is due to a combination of Inductive effect, Solvation, and Steric hindrance."
  },

  // --- BIOLOGY (25) ---
  {
    id: "nt-bio-01",
    exam: "NEET",
    subject: "Biology",
    year: 2024,
    text: "The 'Five Kingdom Classification' was proposed by:",
    options: [
      { label: "A", text: "Linnaeus" },
      { label: "B", text: "Whittaker" },
      { label: "C", text: "Aristotle" },
      { label: "D", text: "Woese" }
    ],
    correctAnswer: "B",
    logicContext: "1. R.H. Whittaker (1969) proposed the 5 kingdoms: Monera, Protista, Fungi, Plantae, and Animalia."
  },
  {
    id: "nt-bio-02",
    exam: "NEET",
    subject: "Biology",
    year: 2024,
    text: "The fluid mosaic model of cell membrane was given by:",
    options: [
      { label: "A", text: "Singer and Nicolson" },
      { label: "B", text: "Watson and Crick" },
      { label: "C", text: "Schleiden and Schwann" },
      { label: "D", text: "Robert Hooke" }
    ],
    correctAnswer: "A",
    logicContext: "1. Proposed in 1972. 2. It describes the membrane as a phospholipid bilayer in which proteins are embedded."
  },
  {
    id: "nt-bio-03",
    exam: "NEET",
    subject: "Biology",
    year: 2023,
    text: "Which of the following is a non-membranous organelle?",
    options: [
      { label: "A", text: "Mitochondria" },
      { label: "B", text: "Ribosome" },
      { label: "C", text: "Lysosome" },
      { label: "D", text: "Chloroplast" }
    ],
    correctAnswer: "B",
    logicContext: "1. Ribosomes are composed of RNA and proteins and lack a lipid membrane. 2. They are found in both prokaryotes and eukaryotes."
  },
  {
    id: "nt-bio-04",
    exam: "NEET",
    subject: "Biology",
    year: 2024,
    text: "Crossing over occurs during which stage of meiosis?",
    options: [
      { label: "A", text: "Leptotene" },
      { label: "B", text: "Zygotene" },
      { label: "C", text: "Pachytene" },
      { label: "D", text: "Diplotene" }
    ],
    correctAnswer: "C",
    logicContext: "1. Crossing over is the exchange of genetic material between non-sister chromatids of homologous chromosomes. 2. It occurs in the Pachytene stage of Prophase I."
  },
  {
    id: "nt-bio-05",
    exam: "NEET",
    subject: "Biology",
    year: 2024,
    text: "The first stable product of C3 cycle (Calvin cycle) is:",
    options: [
      { label: "A", text: "Oxaloacetic acid" },
      { label: "B", text: "3-phosphoglyceric acid" },
      { label: "C", text: "RuBP" },
      { label: "D", text: "PEP" }
    ],
    correctAnswer: "B",
    logicContext: "1. CO2 combines with RuBP to form a 6-carbon unstable intermediate. 2. This immediately breaks into two molecules of 3-PGA (3 carbons)."
  },
  {
    id: "nt-bio-06",
    exam: "NEET",
    subject: "Biology",
    year: 2023,
    text: "The main structural component of plant cell wall is:",
    options: [
      { label: "A", text: "Chitin" },
      { label: "B", text: "Cellulose" },
      { label: "C", text: "Peptidoglycan" },
      { label: "D", text: "Starch" }
    ],
    correctAnswer: "B",
    logicContext: "1. Cellulose is a linear polymer of β-D-glucose. 2. Chitin is in fungi; Peptidoglycan in bacteria."
  },
  {
    id: "nt-bio-07",
    exam: "NEET",
    subject: "Biology",
    year: 2024,
    text: "Bile is produced by:",
    options: [
      { label: "A", text: "Gall bladder" },
      { label: "B", text: "Liver" },
      { label: "C", text: "Pancreas" },
      { label: "D", text: "Stomach" }
    ],
    correctAnswer: "B",
    logicContext: "1. Liver cells (hepatocytes) produce bile. 2. It is stored and concentrated in the Gall bladder."
  },
  {
    id: "nt-bio-08",
    exam: "NEET",
    subject: "Biology",
    year: 2024,
    text: "The functional unit of kidney is:",
    options: [
      { label: "A", text: "Neuron" },
      { label: "B", text: "Nephron" },
      { label: "C", text: "Alveoli" },
      { label: "D", text: "Hepatocyte" }
    ],
    correctAnswer: "B",
    logicContext: "1. Each kidney contains about a million nephrons which filter blood and form urine."
  },
  {
    id: "nt-bio-09",
    exam: "NEET",
    subject: "Biology",
    year: 2023,
    text: "The 'Universal Donor' blood group is:",
    options: [
      { label: "A", text: "AB+" },
      { label: "B", text: "O-" },
      { label: "C", text: "O+" },
      { label: "D", text: "AB-" }
    ],
    correctAnswer: "B",
    logicContext: "1. O- group lacks A, B, and Rh antigens on surface. 2. It won't cause immune reaction in any recipient."
  },
  {
    id: "nt-bio-10",
    exam: "NEET",
    subject: "Biology",
    year: 2024,
    text: "Which hormone is known as the 'Birth Hormone'?",
    options: [
      { label: "A", text: "Estrogen" },
      { label: "B", text: "Progesterone" },
      { label: "C", text: "Oxytocin" },
      { label: "D", text: "Prolactin" }
    ],
    correctAnswer: "C",
    logicContext: "1. Oxytocin causes strong uterine contractions during labor. 2. It also helps in milk ejection."
  },
  {
    id: "nt-bio-11",
    exam: "NEET",
    subject: "Biology",
    year: 2024,
    text: "The phenotype ratio of a Mendelian monohybrid cross in F2 is:",
    options: [
      { label: "A", text: "3:1" },
      { label: "B", text: "1:2:1" },
      { label: "C", text: "9:3:3:1" },
      { label: "D", text: "1:1" }
    ],
    correctAnswer: "A",
    logicContext: "1. Cross Tt x Tt. 2. Offspring: TT, Tt, Tt, tt. 3. Phenotype: 3 Tall, 1 Dwarf."
  },
  {
    id: "nt-bio-12",
    exam: "NEET",
    subject: "Biology",
    year: 2023,
    text: "DNA replication takes place in which phase of cell cycle?",
    options: [
      { label: "A", text: "G1 phase" },
      { label: "B", text: "S phase" },
      { label: "C", text: "G2 phase" },
      { label: "D", text: "M phase" }
    ],
    correctAnswer: "B",
    logicContext: "1. S phase (Synthesis phase) is when DNA amount doubles but chromosome number remains same."
  },
  {
    id: "nt-bio-13",
    exam: "NEET",
    subject: "Biology",
    year: 2024,
    text: "The 'Father of Genetics' is:",
    options: [
      { label: "A", text: "Darwin" },
      { label: "B", text: "Mendel" },
      { label: "C", text: "Morgan" },
      { label: "D", text: "Bateson" }
    ],
    correctAnswer: "B",
    logicContext: "1. Gregor Johann Mendel conducted hybridization experiments on garden peas (Pisum sativum)."
  },
  {
    id: "nt-bio-14",
    exam: "NEET",
    subject: "Biology",
    year: 2024,
    text: "The process of converting atmospheric nitrogen into ammonia by microbes is:",
    options: [
      { label: "A", text: "Nitrification" },
      { label: "B", text: "Denitrification" },
      { label: "C", text: "Biological Nitrogen Fixation" },
      { label: "D", text: "Ammonification" }
    ],
    correctAnswer: "C",
    logicContext: "1. Enzymes like nitrogenase (found in Rhizobium) convert N2 to NH3."
  },
  {
    id: "nt-bio-15",
    exam: "NEET",
    subject: "Biology",
    year: 2023,
    text: "Which of the following is a vestigial organ in humans?",
    options: [
      { label: "A", text: "Wisdom teeth" },
      { label: "B", text: "Ear pinna" },
      { label: "C", text: "Heart" },
      { label: "D", text: "Kidney" }
    ],
    correctAnswer: "A",
    logicContext: "1. Vestigial organs are remnants of organs that were functional in ancestors. 2. Vermiform appendix, wisdom teeth, and coccyx are examples."
  },
  {
    id: "nt-bio-16",
    exam: "NEET",
    subject: "Biology",
    year: 2024,
    text: "The main source of energy for an ecosystem is:",
    options: [
      { label: "A", text: "ATP" },
      { label: "B", text: "Solar radiation" },
      { label: "C", text: "DNA" },
      { label: "D", text: "Green plants" }
    ],
    correctAnswer: "B",
    logicContext: "1. Sun is the ultimate source of energy. 2. Producers capture this energy via photosynthesis."
  },
  {
    id: "nt-bio-17",
    exam: "NEET",
    subject: "Biology",
    year: 2024,
    text: "Karyotype of Down's Syndrome is:",
    options: [
      { label: "A", text: "45, XO" },
      { label: "B", text: "47, XXY" },
      { label: "C", text: "47, Trisomy 21" },
      { label: "D", text: "47, Trisomy 18" }
    ],
    correctAnswer: "C",
    logicContext: "1. Down's Syndrome is caused by an extra copy of chromosome 21 (Trisomy)."
  },
  {
    id: "nt-bio-18",
    exam: "NEET",
    subject: "Biology",
    year: 2023,
    text: "Insulin is secreted by which cells of Pancreas?",
    options: [
      { label: "A", text: "Alpha cells" },
      { label: "B", text: "Beta cells" },
      { label: "C", text: "Delta cells" },
      { label: "D", text: "F cells" }
    ],
    correctAnswer: "B",
    logicContext: "1. Islets of Langerhans contain α-cells (Glucagon) and β-cells (Insulin)."
  },
  {
    id: "nt-bio-19",
    exam: "NEET",
    subject: "Biology",
    year: 2024,
    text: "Which of the following is a living fossil?",
    options: [
      { label: "A", text: "Archaeopteryx" },
      { label: "B", text: "Limulus" },
      { label: "C", text: "Dodo" },
      { label: "D", text: "Mammoth" }
    ],
    correctAnswer: "B",
    logicContext: "1. Limulus (King Crab) has remained relatively unchanged for millions of years."
  },
  {
    id: "nt-bio-20",
    exam: "NEET",
    subject: "Biology",
    year: 2024,
    text: "World Environment Day is celebrated on:",
    options: [
      { label: "A", text: "June 5" },
      { label: "B", text: "July 11" },
      { label: "C", text: "September 16" },
      { label: "D", text: "December 1" }
    ],
    correctAnswer: "A",
    logicContext: "1. Established by UN General Assembly in 1972."
  },
  {
    id: "nt-bio-21",
    exam: "NEET",
    subject: "Biology",
    year: 2023,
    text: "The structural and functional unit of life is:",
    options: [
      { label: "A", text: "Tissue" },
      { label: "B", text: "Cell" },
      { label: "C", text: "Organ" },
      { label: "D", text: "Organism" }
    ],
    correctAnswer: "B",
    logicContext: "1. All living organisms are composed of cells, and all life processes occur within cells."
  },
  {
    id: "nt-bio-22",
    exam: "NEET",
    subject: "Biology",
    year: 2024,
    text: "Pneumatophores are found in:",
    options: [
      { label: "A", text: "Xerophytes" },
      { label: "B", text: "Mangroves" },
      { label: "C", text: "Hydrophytes" },
      { label: "D", text: "Epiphytes" }
    ],
    correctAnswer: "B",
    logicContext: "1. In marshy areas, roots don't get oxygen. 2. Pneumatophores grow vertically upwards to get oxygen (e.g., Rhizophora)."
  },
  {
    id: "nt-bio-23",
    exam: "NEET",
    subject: "Biology",
    year: 2024,
    text: "Restriction endonucleases are called 'Molecular Scissors' because:",
    options: [
      { label: "A", text: "They join DNA" },
      { label: "B", text: "They cut DNA at specific sites" },
      { label: "C", text: "They synthesize DNA" },
      { label: "D", text: "They degrade RNA" }
    ],
    correctAnswer: "B",
    logicContext: "1. They recognize specific palindromic sequences and cut the phosphodiester backbone."
  },
  {
    id: "nt-bio-24",
    exam: "NEET",
    subject: "Biology",
    year: 2023,
    text: "The largest gland in human body is:",
    options: [
      { label: "A", text: "Thyroid" },
      { label: "B", text: "Liver" },
      { label: "C", text: "Adrenal" },
      { label: "D", text: "Pituitary" }
    ],
    correctAnswer: "B",
    logicContext: "1. Liver weighs about 1.2 to 1.5 kg in an adult human."
  },
  {
    id: "nt-bio-25",
    exam: "NEET",
    subject: "Biology",
    year: 2024,
    text: "Which of the following is not a part of 'Evil Quartet'?",
    options: [
      { label: "A", text: "Habitat loss" },
      { label: "B", text: "Co-extinction" },
      { label: "C", text: "In situ conservation" },
      { label: "D", text: "Alien species invasion" }
    ],
    correctAnswer: "C",
    logicContext: "1. The 'Evil Quartet' describes the four major causes of biodiversity loss. 2. In situ conservation is a method to *prevent* loss."
  }
];
