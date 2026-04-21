export type PressureAltitudeQuestion = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};

export const PRESSURE_ALTITUDE_QUESTION_BANK: PressureAltitudeQuestion[] = [
  { question: "Atmospheric pressure is mainly caused by:", options: ["Heat", "Weight of air", "Wind", "Light"], answerIndex: 1, explanation: "Atmospheric pressure comes from the weight of the air column above a surface." },
  { question: "As altitude increases, atmospheric pressure usually:", options: ["Increases", "Decreases", "Stays constant", "Doubles"], answerIndex: 1, explanation: "At higher altitude there is less air above, so pressure decreases." },
  { question: "Sea-level pressure is higher because:", options: ["Temperature is always high", "Air column above is maximum", "Wind is stronger", "Gravity is zero"], answerIndex: 1, explanation: "Near sea level, the overlying air column is largest." },
  { question: "SI unit of pressure is:", options: ["Newton", "Joule", "Pascal", "Watt"], answerIndex: 2, explanation: "Pascal (Pa) is the SI unit of pressure." },
  { question: "A barometer measures:", options: ["Speed", "Pressure", "Height", "Mass"], answerIndex: 1, explanation: "A barometer is designed to measure atmospheric pressure." },
  { question: "Pressure is defined as force per unit:", options: ["Volume", "Area", "Mass", "Time"], answerIndex: 1, explanation: "Pressure = Force / Area." },
  { question: "At higher altitude, air is generally:", options: ["More dense", "Less dense", "Same density", "Solid"], answerIndex: 1, explanation: "Density of air decreases with altitude." },
  { question: "Gravity contributes to pressure variation because it:", options: ["Creates light", "Acts on air mass", "Stops wind", "Reduces oxygen"], answerIndex: 1, explanation: "Gravity gives air weight, producing pressure." },
  { question: "Air pressure acts in:", options: ["One direction", "Two directions", "All directions", "No direction"], answerIndex: 2, explanation: "Fluid pressure acts in all directions." },
  { question: "Pressure decreases with height mainly because:", options: ["Air expands only", "Less air above", "Gravity stops", "Oxygen disappears"], answerIndex: 1, explanation: "The air column above becomes smaller with altitude." },
  { question: "PSI stands for:", options: ["Pressure standard index", "Pounds per square inch", "Pascals per second interval", "Partial static indicator"], answerIndex: 1, explanation: "PSI is a common non-SI pressure unit." },
  { question: "At the same altitude, pressure can vary with:", options: ["Object color", "Weather systems", "Drone battery only", "Camera quality"], answerIndex: 1, explanation: "Weather patterns alter local atmospheric pressure." },
  { question: "Absolute pressure is referenced to:", options: ["Sea level only", "Atmospheric pressure", "Perfect vacuum", "Gauge baseline"], answerIndex: 2, explanation: "Absolute pressure uses vacuum as reference." },
  { question: "Gauge pressure is referenced to:", options: ["Vacuum", "Atmospheric pressure", "Zero density", "Gravity constant"], answerIndex: 1, explanation: "Gauge pressure is relative to atmospheric pressure." },
  { question: "At constant temperature, reducing gas volume usually makes pressure:", options: ["Decrease", "Increase", "Unchanged", "Zero"], answerIndex: 1, explanation: "Boyle's law links lower volume to higher pressure." },
  { question: "In a drone pressure-altitude test, pressure sensor is usually:", options: ["GPS receiver", "Barometer", "Thermometer", "Camera"], answerIndex: 1, explanation: "Barometric sensor provides pressure readings." },
  { question: "During steady upward flight, pressure data should trend:", options: ["Upward", "Downward", "Flat always", "Random only"], answerIndex: 1, explanation: "Upward movement increases altitude and lowers pressure." },
  { question: "Sudden pressure spikes often indicate:", options: ["Perfect theory match", "Sensor noise/disturbance", "Gravity change", "Air disappearance"], answerIndex: 1, explanation: "Short spikes are often measurement noise or turbulence." },
  { question: "Wind can affect measurements by:", options: ["Changing gravity", "Introducing fluctuations", "Removing pressure physics", "Making sensors digital"], answerIndex: 1, explanation: "Turbulence and motion can perturb readings." },
  { question: "Best primary graph for this activity is:", options: ["Pressure vs altitude", "Time vs speed", "Battery vs time", "Pressure vs motor RPM only"], answerIndex: 0, explanation: "This directly shows the relationship being studied." },
  { question: "At ground level in the same run, pressure is usually:", options: ["Minimum", "Maximum", "Zero", "Infinite"], answerIndex: 1, explanation: "Lower altitude generally has higher pressure." },
  { question: "Calibration before flight is important for:", options: ["Speed boost", "Accurate readings", "Higher gravity", "More altitude"], answerIndex: 1, explanation: "Calibration reduces measurement bias and drift." },
  { question: "Repeating trials mainly helps:", options: ["Save battery", "Improve reliability", "Increase pressure", "Reduce gravity"], answerIndex: 1, explanation: "Repeated measurements improve confidence and reduce random error." },
  { question: "Averaging multiple samples helps reduce:", options: ["Height", "Random error", "Pressure", "Air density"], answerIndex: 1, explanation: "Averaging smooths random fluctuations." },
  { question: "Regular altitude intervals are preferred because they:", options: ["Force higher speed", "Improve comparability", "Change pressure law", "Reduce air mass"], answerIndex: 1, explanation: "Consistent spacing supports cleaner analysis." },
  { question: "Pressure-altitude curve in Earth's atmosphere is often:", options: ["Linear increasing", "Linear decreasing", "Non-linear decreasing", "Constant"], answerIndex: 2, explanation: "Pressure usually drops non-linearly (often near-exponential)." },
  { question: "The slope of pressure vs altitude is typically:", options: ["Positive", "Negative", "Zero", "Undefined"], answerIndex: 1, explanation: "Pressure falls as altitude rises, giving negative slope." },
  { question: "A steeper negative slope indicates:", options: ["Faster pressure drop with altitude", "Slower pressure drop", "No change", "Pressure increase"], answerIndex: 0, explanation: "Steeper slope means stronger change per unit altitude." },
  { question: "A flattening curve at higher altitude indicates:", options: ["Slower rate of decrease", "Pressure increase", "Measurement impossible", "Constant high pressure"], answerIndex: 0, explanation: "Rate of change can reduce with altitude range." },
  { question: "Graph interpretation mainly helps in:", options: ["Visualization and trend analysis", "Charging battery", "Changing weather", "Increasing gravity"], answerIndex: 0, explanation: "Graphs make the relationship and anomalies easier to identify." },
  { question: "At very high altitude, atmospheric pressure tends toward:", options: ["Very high value", "Near zero", "Constant sea-level value", "Infinity"], answerIndex: 1, explanation: "Pressure approaches very low values at high altitude." },
  { question: "Low pressure generally means:", options: ["More air overhead", "Less air overhead", "No gravity", "Higher density"], answerIndex: 1, explanation: "Lower overhead air mass gives lower pressure." },
  { question: "Air density and pressure are commonly:", options: ["Unrelated", "Directly related in atmosphere", "Always inversely related", "Random"], answerIndex: 1, explanation: "Lower density regions usually correspond to lower pressure." },
  { question: "If pressure did not change with height on Earth, then:", options: ["Atmosphere model would be inconsistent", "Everything is normal", "Drone failed only", "No physics issue"], answerIndex: 0, explanation: "Observed atmosphere requires pressure variation with altitude." },
  { question: "Oxygen availability at higher altitude decreases largely because:", options: ["Pressure decreases", "Gravity increases", "Wind stops", "Temperature always rises"], answerIndex: 0, explanation: "Lower pressure lowers oxygen partial pressure." },
  { question: "Pressure differences are a primary driver of:", options: ["Light", "Wind", "Sound color", "Magnetism"], answerIndex: 1, explanation: "Air moves from high- to low-pressure regions, forming wind." },
  { question: "Boiling point at higher altitude is generally:", options: ["Higher", "Lower", "Same", "Infinite"], answerIndex: 1, explanation: "Lower ambient pressure lowers boiling point." },
  { question: "Aircraft cabins are pressurized mainly because outside pressure is:", options: ["Too high", "Too low at altitude", "Exactly sea level", "Unrelated"], answerIndex: 1, explanation: "Cabin pressurization protects passengers at cruising altitude." },
  { question: "Mountaineers may need supplemental oxygen because:", options: ["Low pressure at altitude", "High gravity", "Low wind", "High sea-level pressure"], answerIndex: 0, explanation: "Lower oxygen partial pressure affects breathing." },
  { question: "Barometric formula relates:", options: ["Speed and time", "Pressure and altitude", "Heat and light", "Force and color"], answerIndex: 1, explanation: "It models pressure variation with altitude." },
  { question: "Most atmospheric mass is concentrated:", options: ["Near Earth's surface", "In upper space", "Only in clouds", "Uniformly everywhere"], answerIndex: 0, explanation: "Gravity compresses most air near the surface." },
  { question: "Main physical cause of pressure in atmosphere is:", options: ["Magnetism", "Gravity acting on air", "Electricity", "Sound"], answerIndex: 1, explanation: "Air has weight due to gravity, creating pressure." },
  { question: "Calm weather is preferred for this experiment because it:", options: ["Adds random spikes", "Reduces disturbance/noise", "Removes pressure", "Changes gravity"], answerIndex: 1, explanation: "Stable conditions improve measurement quality." },
  { question: "A sudden jump in graph is most likely:", options: ["Theory proof by itself", "Noise or transient error", "Constant trend", "Law failure"], answerIndex: 1, explanation: "Unexpected spikes often come from disturbances or sensor artifacts." },
  { question: "Straight vertical ascent is useful because it:", options: ["Keeps altitude path controlled", "Maximizes turbulence", "Removes barometer", "Eliminates gravity"], answerIndex: 0, explanation: "Controlled ascent simplifies pressure-altitude analysis." },
  { question: "Logging data continuously helps by:", options: ["Preventing flight", "Supporting analysis and traceability", "Increasing pressure", "Changing weather"], answerIndex: 1, explanation: "Detailed logs allow verification and post-flight analysis." },
  { question: "Pressure-altitude relationship in this activity demonstrates:", options: ["Atmospheric behavior", "Magnetism law", "Only battery dynamics", "No scientific trend"], answerIndex: 0, explanation: "The activity illustrates core atmospheric pressure behavior." },
  { question: "If gravity were lower (all else equal), near-surface pressure would tend to:", options: ["Increase", "Decrease", "Stay exactly identical", "Become random"], answerIndex: 1, explanation: "Lower gravity means less air weight per unit area." },
  { question: "Best conclusion for the experiment is usually:", options: ["Pressure increases with altitude", "Pressure decreases with altitude", "No relationship exists", "Pressure is random"], answerIndex: 1, explanation: "Observed and theoretical trend is decreasing pressure with altitude." },
  { question: "Data points should be collected at:", options: ["Only top altitude", "Only ground", "Regular intervals", "Random single point"], answerIndex: 2, explanation: "Regular sampling improves graph quality and comparability." },
];

export const isPressureAltitudeContext = (text: string) =>
  /(pressure|altitude|psi|pascal|barometric|atmospheric|gas law|gaseous|air density|barometer)/i.test(text);

export const pickRandomPressureAltitudeQuestions = (count: number) => {
  const pool = [...PRESSURE_ALTITUDE_QUESTION_BANK];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.max(0, Math.min(count, pool.length)));
};

