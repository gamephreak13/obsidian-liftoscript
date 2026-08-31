/* Liftoscript API for Templater (tp.user.liftoscript_api) */
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// templaterApi.ts
var templaterApi_exports = {};
__export(templaterApi_exports, {
  BLOCK_LANG: () => BLOCK_LANG,
  buildNextWorkoutContent: () => buildNextWorkoutContent,
  computeNextExercise: () => computeNextExercise,
  extractLiftoscriptBlocks: () => extractLiftoscriptBlocks,
  parseExerciseLine: () => parseExerciseLine,
  summarizeWorkoutText: () => summarizeWorkoutText,
  weightToToken: () => weightToToken
});
module.exports = __toCommonJS(templaterApi_exports);

// exercises.json
var exercises_default = [
  { id: "abWheel", name: "Ab Wheel", equipment: "bodyweight" },
  { id: "arnoldPress", name: "Arnold Press", equipment: "dumbbell" },
  { id: "aroundTheWorld", name: "Around The World", equipment: "dumbbell" },
  { id: "backExtension", name: "Back Extension", equipment: "bodyweight" },
  { id: "ballSlams", name: "Ball Slams", equipment: "medicine ball" },
  { id: "battleRopes", name: "Battle Ropes", equipment: "cable" },
  { id: "behindTheNeckPress", name: "Behind The Neck Press", equipment: "barbell" },
  { id: "benchDip", name: "Bench Dip", equipment: "bodyweight" },
  { id: "benchPress", name: "Bench Press", equipment: "barbell" },
  { id: "benchPressCloseGrip", name: "Bench Press Close Grip", equipment: "barbell" },
  { id: "benchPressWideGrip", name: "Bench Press Wide Grip", equipment: "barbell" },
  { id: "bentOverOneArmRow", name: "Bent Over One Arm Row", equipment: "dumbbell" },
  { id: "bentOverRow", name: "Bent Over Row", equipment: "barbell" },
  { id: "bicepCurl", name: "Bicep Curl", equipment: "dumbbell" },
  { id: "bicycleCrunch", name: "Bicycle Crunch", equipment: "bodyweight" },
  { id: "boxJump", name: "Box Jump", equipment: "bodyweight" },
  { id: "boxSquat", name: "Box Squat", equipment: "barbell" },
  { id: "bulgarianSplitSquat", name: "Bulgarian Split Squat", equipment: "dumbbell" },
  { id: "burpee", name: "Burpee", equipment: "bodyweight" },
  { id: "cableCrossover", name: "Cable Crossover", equipment: "cable" },
  { id: "cableCrunch", name: "Cable Crunch", equipment: "cable" },
  { id: "cableKickback", name: "Cable Kickback", equipment: "cable" },
  { id: "cablePullThrough", name: "Cable Pull Through", equipment: "cable" },
  { id: "cableTwist", name: "Cable Twist", equipment: "cable" },
  { id: "calfPressOnLegPress", name: "Calf Press on Leg Press", equipment: "machine" },
  { id: "calfPressOnSeatedLegPress", name: "Calf Press on Seated Leg Press", equipment: "machine" },
  { id: "chestDip", name: "Chest Dip", equipment: "bodyweight" },
  { id: "chestFly", name: "Chest Fly", equipment: "dumbbell" },
  { id: "chestPress", name: "Chest Press", equipment: "machine" },
  { id: "chestSupportedRow", name: "Chest-Supported Row", equipment: "machine" },
  { id: "chinUp", name: "Chin Up", equipment: "bodyweight" },
  { id: "clean", name: "Clean", equipment: "barbell" },
  { id: "cleanandJerk", name: "Clean and Jerk", equipment: "barbell" },
  { id: "concentrationCurl", name: "Concentration Curl", equipment: "dumbbell" },
  { id: "crossBodyCrunch", name: "Cross Body Crunch", equipment: "bodyweight" },
  { id: "crunch", name: "Crunch", equipment: "bodyweight" },
  { id: "cycling", name: "Cycling", equipment: "machine" },
  { id: "deadlift", name: "Deadlift", equipment: "barbell" },
  { id: "deadliftHighPull", name: "Deadlift High Pull", equipment: "barbell" },
  { id: "declineBenchPress", name: "Decline Bench Press", equipment: "barbell" },
  { id: "declineCrunch", name: "Decline Crunch", equipment: "bodyweight" },
  { id: "deficitDeadlift", name: "Deficit Deadlift", equipment: "barbell" },
  { id: "ellipticalMachine", name: "Elliptical Machine", equipment: "machine" },
  { id: "facePull", name: "Face Pull", equipment: "cable" },
  { id: "flatKneeRaise", name: "Flat Knee Raise", equipment: "bodyweight" },
  { id: "flatLegRaise", name: "Flat Leg Raise", equipment: "bodyweight" },
  { id: "frontRaise", name: "Front Raise", equipment: "dumbbell" },
  { id: "frontSquat", name: "Front Squat", equipment: "barbell" },
  { id: "gobletSquat", name: "Goblet Squat", equipment: "kettlebell" },
  { id: "goodMorning", name: "Good Morning", equipment: "barbell" },
  { id: "gluteBridge", name: "Glute Bridge", equipment: "bodyweight" },
  { id: "gluteBridgeMarch", name: "Glute Bridge March", equipment: "bodyweight" },
  { id: "gluteKickback", name: "Glute Kickback", equipment: "bodyweight" },
  { id: "hackSquat", name: "Hack Squat", equipment: "machine" },
  { id: "hammerCurl", name: "Hammer Curl", equipment: "dumbbell" },
  { id: "handstandPushUp", name: "Handstand Push Up", equipment: "bodyweight" },
  { id: "hangClean", name: "Hang Clean", equipment: "barbell" },
  { id: "hangSnatch", name: "Hang Snatch", equipment: "barbell" },
  { id: "hangingLegRaise", name: "Hanging Leg Raise", equipment: "bodyweight" },
  { id: "highKneeSkips", name: "High Knee Skips", equipment: "bodyweight" },
  { id: "highRow", name: "High Row", equipment: "machine" },
  { id: "hipAbductor", name: "Hip Abductor", equipment: "machine" },
  { id: "hipAdductor", name: "Hip Adductor", equipment: "machine" },
  { id: "hipThrust", name: "Hip Thrust", equipment: "barbell" },
  { id: "inclineBenchPress", name: "Incline Bench Press", equipment: "barbell" },
  { id: "inclineBenchPressWideGrip", name: "Incline Bench Press Wide Grip", equipment: "barbell" },
  { id: "inclineChestFly", name: "Incline Chest Fly", equipment: "dumbbell" },
  { id: "inclineChestPress", name: "Incline Chest Press", equipment: "machine" },
  { id: "inclineCurl", name: "Incline Curl", equipment: "dumbbell" },
  { id: "inclineRow", name: "Incline Row", equipment: "machine" },
  { id: "invertedRow", name: "Inverted Row", equipment: "bodyweight" },
  { id: "isoLateralChestPress", name: "Iso-Lateral Chest Press", equipment: "machine" },
  { id: "isoLateralRow", name: "Iso-Lateral Row", equipment: "machine" },
  { id: "jackknifeSitUp", name: "Jackknife Sit Up", equipment: "bodyweight" },
  { id: "jumpRope", name: "Jump Rope", equipment: "bodyweight" },
  { id: "jumpSquat", name: "Jump Squat", equipment: "bodyweight" },
  { id: "jumpingJack", name: "Jumping Jack", equipment: "bodyweight" },
  { id: "kettlebellSwing", name: "Kettlebell Swing", equipment: "kettlebell" },
  { id: "kettlebellTurkishGetUp", name: "Kettlebell Turkish Get Up", equipment: "kettlebell" },
  { id: "kippingPullUp", name: "Kipping Pull Up", equipment: "bodyweight" },
  { id: "kneeRaise", name: "Knee Raise", equipment: "bodyweight" },
  { id: "kneelingPulldown", name: "Kneeling Pulldown", equipment: "cable" },
  { id: "kneestoElbows", name: "Knees to Elbows", equipment: "bodyweight" },
  { id: "latPulldown", name: "Lat Pulldown", equipment: "cable" },
  { id: "lateralBoxJump", name: "Lateral Box Jump", equipment: "bodyweight" },
  { id: "lateralRaise", name: "Lateral Raise", equipment: "dumbbell" },
  { id: "legsUpBenchPress", name: "Legs Up Bench Press", equipment: "barbell" },
  { id: "legCurl", name: "Leg Curl", equipment: "machine" },
  { id: "legExtension", name: "Leg Extension", equipment: "machine" },
  { id: "legPress", name: "Leg Press", equipment: "machine" },
  { id: "lunge", name: "Lunge", equipment: "dumbbell" },
  { id: "lyingBicepCurl", name: "Lying Bicep Curl", equipment: "dumbbell" },
  { id: "lyingLegCurl", name: "Lying Leg Curl", equipment: "machine" },
  { id: "mountainClimber", name: "Mountain Climber", equipment: "bodyweight" },
  { id: "muscleUp", name: "Muscle Up", equipment: "bodyweight" },
  { id: "obliqueCrunch", name: "Oblique Crunch", equipment: "bodyweight" },
  { id: "overheadPress", name: "Overhead Press", equipment: "barbell" },
  { id: "overheadSquat", name: "Overhead Squat", equipment: "barbell" },
  { id: "pecDeck", name: "Pec Deck", equipment: "machine" },
  { id: "pendlayRow", name: "Pendlay Row", equipment: "barbell" },
  { id: "pistolSquat", name: "Pistol Squat", equipment: "bodyweight" },
  { id: "plank", name: "Plank", equipment: "bodyweight" },
  { id: "powerClean", name: "Power Clean", equipment: "barbell" },
  { id: "powerSnatch", name: "Power Snatch", equipment: "barbell" },
  { id: "preacherCurl", name: "Preacher Curl", equipment: "barbell" },
  { id: "pressUnder", name: "Press Under", equipment: "barbell" },
  { id: "pullUp", name: "Pull Up", equipment: "bodyweight" },
  { id: "pullover", name: "Pullover", equipment: "dumbbell" },
  { id: "pushPress", name: "Push Press", equipment: "barbell" },
  { id: "pushUp", name: "Push Up", equipment: "bodyweight" },
  { id: "reverseCrunch", name: "Reverse Crunch", equipment: "bodyweight" },
  { id: "reverseCurl", name: "Reverse Curl", equipment: "barbell" },
  { id: "reverseFly", name: "Reverse Fly", equipment: "dumbbell" },
  { id: "reverseGripConcentrationCurl", name: "Reverse Grip Concentration Curl", equipment: "dumbbell" },
  { id: "reversePlank", name: "Reverse Plank", equipment: "bodyweight" },
  { id: "reverseLatPulldown", name: "Reverse Lat Pulldown", equipment: "cable" },
  { id: "reverseLunge", name: "Reverse Lunge", equipment: "dumbbell" },
  { id: "reverseWristCurl", name: "Reverse Wrist Curl", equipment: "dumbbell" },
  { id: "romanianDeadlift", name: "Romanian Deadlift", equipment: "barbell" },
  { id: "reverseHyperextension", name: "Reverse Hyperextension", equipment: "bodyweight" },
  { id: "rowing", name: "Rowing", equipment: "machine" },
  { id: "russianTwist", name: "Russian Twist", equipment: "bodyweight" },
  { id: "safetySquatBarSquat", name: "Safety Squat Bar Squat", equipment: "barbell" },
  { id: "seatedCalfRaise", name: "Seated Calf Raise", equipment: "machine" },
  { id: "seatedFrontRaise", name: "Seated Front Raise", equipment: "dumbbell" },
  { id: "seatedLegCurl", name: "Seated Leg Curl", equipment: "machine" },
  { id: "seatedLegPress", name: "Seated Leg Press", equipment: "machine" },
  { id: "seatedOverheadPress", name: "Seated Overhead Press", equipment: "dumbbell" },
  { id: "seatedPalmsUpWristCurl", name: "Seated Palms Up Wrist Curl", equipment: "dumbbell" },
  { id: "seatedRow", name: "Seated Row", equipment: "cable" },
  { id: "seatedWideGripRow", name: "Seated Wide Grip Row", equipment: "cable" },
  { id: "shoulderPress", name: "Shoulder Press", equipment: "machine" },
  { id: "shoulderPressParallelGrip", name: "Shoulder Press Parallel Grip", equipment: "machine" },
  { id: "shrug", name: "Shrug", equipment: "barbell" },
  { id: "sideBend", name: "Side Bend", equipment: "dumbbell" },
  { id: "sideCrunch", name: "Side Crunch", equipment: "bodyweight" },
  { id: "sideHipAbductor", name: "Side Hip Abductor", equipment: "bodyweight" },
  { id: "sideLyingClam", name: "Side Lying Clam", equipment: "bodyweight" },
  { id: "sidePlank", name: "Side Plank", equipment: "bodyweight" },
  { id: "singleLegBridge", name: "Single Leg Bridge", equipment: "bodyweight" },
  { id: "singleLegCalfRaise", name: "Single Leg Calf Raise", equipment: "bodyweight" },
  { id: "singleLegDeadlift", name: "Single Leg Deadlift", equipment: "dumbbell" },
  { id: "singleLegGluteBridgeBench", name: "Single Leg Glute Bridge On Bench", equipment: "bodyweight" },
  { id: "singleLegGluteBridgeStraight", name: "Single Leg Glute Bridge Straight Leg", equipment: "bodyweight" },
  { id: "singleLegGluteBridgeBentKnee", name: "Single Leg Glute Bridge Bent Knee", equipment: "bodyweight" },
  { id: "singleLegHipThrust", name: "Single Leg Hip Thrust", equipment: "bodyweight" },
  { id: "sissySquat", name: "Sissy Squat", equipment: "bodyweight" },
  { id: "sitUp", name: "Sit Up", equipment: "bodyweight" },
  { id: "skullcrusher", name: "Skullcrusher", equipment: "barbell" },
  { id: "slingShotBenchPress", name: "Sling Shot Bench Press", equipment: "barbell" },
  { id: "snatch", name: "Snatch", equipment: "barbell" },
  { id: "snatchPull", name: "Snatch Pull", equipment: "barbell" },
  { id: "splitSquat", name: "Split Squat", equipment: "dumbbell" },
  { id: "splitJerk", name: "Split Jerk", equipment: "barbell" },
  { id: "squat", name: "Squat", equipment: "barbell" },
  { id: "squatRow", name: "Squat Row", equipment: "barbell" },
  { id: "standingCalfRaise", name: "Standing Calf Raise", equipment: "machine" },
  { id: "standingRow", name: "Standing Row", equipment: "cable" },
  { id: "standingRowCloseGrip", name: "Standing Row Close Grip", equipment: "cable" },
  { id: "standingRowRearDeltWithRope", name: "Standing Row Rear Delt With Rope", equipment: "cable" },
  { id: "standingRowRearHorizontalDeltWithRope", name: "Standing Row Rear Delt, Horizontal, With Rope", equipment: "cable" },
  { id: "standingRowVBar", name: "Standing Row V-Bar", equipment: "cable" },
  { id: "stepUp", name: "Step up", equipment: "dumbbell" },
  { id: "stiffLegDeadlift", name: "Stiff Leg Deadlift", equipment: "barbell" },
  { id: "straightLegDeadlift", name: "Straight Leg Deadlift", equipment: "bodyweight" },
  { id: "sumoDeadlift", name: "Sumo Deadlift", equipment: "barbell" },
  { id: "sumoDeadliftHighPull", name: "Sumo Deadlift High Pull", equipment: "barbell" },
  { id: "superman", name: "Superman", equipment: "bodyweight" },
  { id: "tBarRow", name: "T Bar Row", equipment: "barbell" },
  { id: "thruster", name: "Thruster", equipment: "barbell" },
  { id: "toesToBar", name: "Toes To Bar", equipment: "bodyweight" },
  { id: "torsoRotation", name: "Torso Rotation", equipment: "cable" },
  { id: "trapBarDeadlift", name: "Trap Bar Deadlift", equipment: "barbell" },
  { id: "tricepsDip", name: "Triceps Dip", equipment: "bodyweight" },
  { id: "tricepsExtension", name: "Triceps Extension", equipment: "dumbbell" },
  { id: "tricepsPushdown", name: "Triceps Pushdown", equipment: "cable" },
  { id: "uprightRow", name: "Upright Row", equipment: "barbell" },
  { id: "vUp", name: "V Up", equipment: "bodyweight" },
  { id: "widePullUp", name: "Wide Pull Up", equipment: "bodyweight" },
  { id: "wristCurl", name: "Wrist Curl", equipment: "dumbbell" },
  { id: "wristRoller", name: "Wrist Roller", equipment: "dumbbell" },
  { id: "zercherSquat", name: "Zercher Squat", equipment: "barbell" },
  { id: "wallPushup", name: "Wall Push Up", equipment: "bodyweight" },
  { id: "inclinePushup", name: "Incline Push Up", equipment: "bodyweight" },
  { id: "kneePushup", name: "Knee Push Up", equipment: "bodyweight" },
  { id: "diamondPushup", name: "Diamond Push Up", equipment: "bodyweight" },
  { id: "pseudoPlanchePushup", name: "Pseudo Planche Push Up", equipment: "bodyweight" },
  { id: "pikePushup", name: "Pike Push Up", equipment: "bodyweight" },
  { id: "ringDip", name: "Ring Dip", equipment: "bodyweight" },
  { id: "negativeDip", name: "Negative Dip", equipment: "bodyweight" },
  { id: "verticalRow", name: "Vertical Row", equipment: "bodyweight" },
  { id: "wideRow", name: "Wide Row", equipment: "bodyweight" },
  { id: "ringRow", name: "Ring Row", equipment: "bodyweight" },
  { id: "tuckFrontLeverRow", name: "Tuck Front Lever Row", equipment: "bodyweight" },
  { id: "frontLeverRow", name: "Front Lever Row", equipment: "bodyweight" },
  { id: "scapularPullUp", name: "Scapular Pull Up", equipment: "bodyweight" },
  { id: "deadHang", name: "Dead Hang", equipment: "bodyweight" },
  { id: "negativePullup", name: "Negative Pull Up", equipment: "bodyweight" },
  { id: "assistedSquat", name: "Assisted Squat", equipment: "bodyweight" },
  { id: "shrimpSquat", name: "Shrimp Squat", equipment: "bodyweight" },
  { id: "nordicCurl", name: "Nordic Curl", equipment: "bodyweight" },
  { id: "handstand", name: "Handstand", equipment: "bodyweight" },
  { id: "wallHandstand", name: "Wall Handstand", equipment: "bodyweight" },
  { id: "crowPose", name: "Crow Pose", equipment: "bodyweight" },
  { id: "dragonFlag", name: "Dragon Flag", equipment: "bodyweight" },
  { id: "copenhagenPlank", name: "Copenhagen Plank", equipment: "bodyweight" },
  { id: "hangingKneeRaise", name: "Hanging Knee Raise", equipment: "bodyweight" },
  { id: "archHang", name: "Arch Hang", equipment: "bodyweight" },
  { id: "supportHold", name: "Support Hold", equipment: "bodyweight" },
  { id: "pallofPress", name: "Pallof Press", equipment: "cable" },
  { id: "renegadeRow", name: "Renegade Row", equipment: "dumbbell" },
  { id: "armCircles", name: "Arm Circles", equipment: "mobility", category: "stretch" },
  { id: "butterflyStretch", name: "Butterfly Stretch", equipment: "mobility", category: "stretch" },
  { id: "calfStretch", name: "Calf Stretch", equipment: "mobility", category: "stretch" },
  { id: "figureFourStretch", name: "Figure Four Stretch", equipment: "mobility", category: "stretch" },
  { id: "hamstringStretch", name: "Hamstring Stretch", equipment: "mobility", category: "stretch" },
  { id: "hipFlexorStretch", name: "Hip Flexor Stretch", equipment: "mobility", category: "stretch" },
  { id: "kneelingQuadStretch", name: "Kneeling Quad Stretch", equipment: "mobility", category: "stretch" },
  { id: "lyingGluteStretch", name: "Lying Glute Stretch", equipment: "mobility", category: "stretch" },
  { id: "neckStretch", name: "Neck Stretch", equipment: "mobility", category: "stretch" },
  { id: "pigeonPose", name: "Pigeon Pose", equipment: "mobility", category: "stretch" },
  { id: "shoulderStretch", name: "Shoulder Stretch", equipment: "mobility", category: "stretch" },
  { id: "standingQuadStretch", name: "Standing Quad Stretch", equipment: "mobility", category: "stretch" },
  { id: "tricepsStretch", name: "Triceps Stretch", equipment: "mobility", category: "stretch" },
  { id: "worldsGreatestStretch", name: "World's Greatest Stretch", equipment: "mobility", category: "stretch" },
  { id: "childsPose", name: "Child's Pose", equipment: "mobility", category: "stretch" },
  { id: "downwardDog", name: "Downward Dog", equipment: "mobility", category: "stretch" }
];

// parser.ts
var DEFAULT_UNIT = "lb";
var STRETCH_TAG_RE = /type\s*:\s*stretch\b/i;
var EXERCISE_RECORDS = exercises_default;
function isStretchExerciseName(name) {
  const normalized = name.trim().toLowerCase();
  return EXERCISE_RECORDS.some(
    (e) => e.category === "stretch" && e.name.toLowerCase() === normalized
  );
}
function weightIs(value) {
  return typeof (value == null ? void 0 : value.value) === "number" && typeof (value == null ? void 0 : value.unit) === "string" && (value == null ? void 0 : value.unit) !== "%";
}
function weightIsPct(value) {
  return typeof (value == null ? void 0 : value.value) === "number" && (value == null ? void 0 : value.unit) === "%";
}
function weightBuild(value, unit) {
  return { value, unit };
}
function weightBuildPct(value) {
  return { value, unit: "%" };
}
function weightConvertTo(weight, unit) {
  if (weight.unit === unit) {
    return weight;
  } else if (weight.unit === "kg" && unit === "lb") {
    return weightBuild(Math.round(weight.value * 2.205 / 0.5) * 0.5, unit);
  } else {
    return weightBuild(Math.round(weight.value / 2.205 / 0.5) * 0.5, unit);
  }
}
function weightOperation(weight, value, o) {
  if (typeof weight === "number" && typeof value !== "number") {
    return weightBuild(o(weight, value.value), value.unit);
  } else if (typeof weight !== "number" && typeof value === "number") {
    return weightBuild(o(weight.value, value), weight.unit);
  } else if (typeof weight !== "number" && typeof value !== "number") {
    return weightBuild(o(weight.value, weightConvertTo(value, weight.unit).value), weight.unit);
  } else {
    throw new Error("Weight.operation should never work with numbers only");
  }
}
function parseExerciseLine(line, setStart = 1) {
  const trimmed = line.trim();
  const lineOffset = line.indexOf(trimmed);
  let cursor = 0;
  const markers = [];
  const markerRe = /\[([ xX])\]/g;
  const dashIndexOriginal = trimmed.indexOf("/");
  const markerZone = dashIndexOriginal === -1 ? trimmed : trimmed.substring(0, dashIndexOriginal);
  let mm;
  let markerEndOffset = 0;
  while (mm = markerRe.exec(markerZone)) {
    markers.push({
      start: lineOffset + mm.index,
      end: lineOffset + mm.index + 3,
      completed: mm[1] !== " "
    });
    markerEndOffset = lineOffset + mm.index + 3;
  }
  const rawSpecStart = markers.length > 0 ? markerEndOffset : lineOffset;
  const rawSpec = line.substring(rawSpecStart);
  const specTrim = rawSpec.replace(/^\s*/, "");
  const specStart = rawSpecStart + (rawSpec.length - specTrim.length);
  const spec = specTrim;
  const dashIndex = spec.indexOf("/");
  const name = (dashIndex === -1 ? spec : spec.substring(0, dashIndex)).trim();
  const rest = dashIndex === -1 ? "" : spec.substring(dashIndex + 1);
  const restMatch = rest.match(/rest\s*:\s*(\d+)/i);
  const restSeconds = restMatch ? parseInt(restMatch[1], 10) : 0;
  let progress;
  const lpMatch = rest.match(/progress\s*:\s*lp\s*\(\s*([^)]*)\)/i);
  if (lpMatch) {
    const args = lpMatch[1].split(",").map((a) => a.trim()).filter(Boolean);
    progress = { type: "lp", args };
  } else {
    const dpMatch = rest.match(/progress\s*:\s*dp\s*\(\s*([^)]*)\)/i);
    if (dpMatch) {
      const args = dpMatch[1].split(",").map((a) => a.trim()).filter(Boolean);
      progress = { type: "dp", args };
    } else {
      const sumMatch = rest.match(/progress\s*:\s*sum\s*\(\s*([^)]*)\)/i);
      if (sumMatch) {
        const args = sumMatch[1].split(",").map((a) => a.trim()).filter(Boolean);
        progress = { type: "sum", args };
      } else {
        const customMatch = rest.match(/progress\s*:\s*custom\s*\(([^)]*)\)\s*(?:\{([\s\S]*)\})?/i);
        if (customMatch) {
          progress = { type: "custom", args: [], script: customMatch[2] };
        } else if (/progress\s*:\s*none/i.test(rest)) {
          progress = { type: "none", args: [] };
        }
      }
    }
  }
  const isStretch = STRETCH_TAG_RE.test(spec) || isStretchExerciseName(name);
  const sets = [];
  let setNumber = setStart;
  if (isStretch) {
    const stretchTokenRe = /(?:(\d+)x)?(\d+(?:\.\d+)?)s(?:\|(\d+(?:\.\d+)?)s)?/gi;
    let sm;
    while (sm = stretchTokenRe.exec(rest)) {
      const count = sm[1] ? parseInt(sm[1], 10) : 1;
      const holdSeconds = parseFloat(sm[2]);
      const stretchRest = sm[3] ? parseFloat(sm[3]) : void 0;
      for (let i = 0; i < count; i++) {
        const marker = markers[sets.length];
        sets.push({
          setNumber,
          weight: weightBuild(0, DEFAULT_UNIT),
          reps: 0,
          isAmrap: false,
          completed: marker ? marker.completed : false,
          markerStart: marker == null ? void 0 : marker.start,
          markerEnd: marker == null ? void 0 : marker.end,
          seconds: holdSeconds,
          restSeconds: stretchRest
        });
        setNumber += 1;
      }
    }
  }
  if (sets.length === 0) {
    const setTokenRe = /(\d+)x(\d+(?:\.\d+)?)\s*(lb|kg)/g;
    let m;
    while (m = setTokenRe.exec(rest)) {
      const reps = parseInt(m[1], 10);
      const weightValue = parseFloat(m[2]);
      const unit = m[3];
      const marker = markers[sets.length];
      sets.push({
        setNumber,
        weight: weightBuild(weightValue, unit),
        reps,
        isAmrap: false,
        completed: marker ? marker.completed : false,
        markerStart: marker == null ? void 0 : marker.start,
        markerEnd: marker == null ? void 0 : marker.end
      });
      setNumber += 1;
    }
  }
  return {
    name,
    raw: line,
    specStart,
    sets,
    restSeconds,
    isStretch,
    progress
  };
}
function applyLinearProgression(progressArgs, completed, opts) {
  var _a, _b, _c, _d;
  const unit = (_a = opts == null ? void 0 : opts.unit) != null ? _a : DEFAULT_UNIT;
  const parseInc = (s) => {
    if (!s) {
      return weightBuild(0, unit);
    }
    if (s.endsWith("%")) {
      return weightBuildPct(parseFloat(s));
    }
    const v = s.endsWith("lb") || s.endsWith("kg") ? parseFloat(s) : parseFloat(s);
    const u = s.endsWith("kg") ? "kg" : "lb";
    return weightBuild(v, u);
  };
  const increment = parseInc(progressArgs[0]);
  const successes = progressArgs[1] ? parseInt(progressArgs[1], 10) : 1;
  let successCounter = progressArgs[2] ? parseInt(progressArgs[2], 10) : 0;
  const decrementRaw = parseInc(progressArgs[3]);
  const decrement = weightIsPct(decrementRaw) ? weightBuild(0, unit) : decrementRaw;
  const failures = progressArgs[4] ? parseInt(progressArgs[4], 10) : ((_b = decrement.value) != null ? _b : 0) > 0 ? 1 : 0;
  let failureCounter = progressArgs[5] ? parseInt(progressArgs[5], 10) : 0;
  let incrementPerformed = false;
  let decrementPerformed = false;
  const onerm = (_c = completed.weights[0]) != null ? _c : weightBuild(0, unit);
  if (completed.totalReps >= completed.requiredReps) {
    successCounter += 1;
    if (successCounter >= successes) {
      incrementPerformed = true;
      successCounter = 0;
      failureCounter = 0;
    }
  } else {
    const minReps = (_d = completed.minReps) != null ? _d : completed.requiredReps;
    if (decrement.value > 0 && failures > 0 && !(completed.totalReps >= minReps)) {
      failureCounter += 1;
      if (failureCounter >= failures) {
        decrementPerformed = true;
        failureCounter = 0;
        successCounter = 0;
      }
    }
  }
  return {
    increment,
    incrementPerformed,
    decrement,
    decrementPerformed,
    successCounter,
    failureCounter
  };
}
function weightAddIncrement(weight, increment) {
  return weightOperation(weight, increment, (a, b) => a + b);
}

// summary.ts
var BLOCK_LANG = "liftoscript";
function extractLiftoscriptBlocks(text) {
  const blocks = [];
  if (!text) {
    return blocks;
  }
  const fence = /```\s*liftoscript\s*\n([\s\S]*?)```/gi;
  let m;
  while (m = fence.exec(text)) {
    blocks.push(m[1]);
  }
  return blocks;
}
function summarizeWorkoutText(text, opts = {}) {
  var _a, _b, _c, _d;
  const workSecondsPerSet = (_a = opts.workSecondsPerSet) != null ? _a : 40;
  const exercises = [];
  for (const block of extractLiftoscriptBlocks(text)) {
    const lines = block.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    for (const line of lines) {
      const ex = parseExerciseLine(line);
      if (ex.sets.length > 0 || ex.name) {
        exercises.push(ex);
      }
    }
  }
  let totalVolume = 0;
  let totalVolumeUnit = null;
  let completedSets = 0;
  let totalSets = 0;
  let totalReps = 0;
  let exercisesCompleted = 0;
  let estimatedDurationSeconds = 0;
  for (const ex of exercises) {
    const doneSets = ex.sets.filter((s) => s.completed);
    if (doneSets.length === ex.sets.length && ex.sets.length > 0) {
      exercisesCompleted += 1;
    }
    for (const set of ex.sets) {
      totalSets += 1;
      const weight = set.weight;
      const numeric = typeof weight === "number" ? weight : (_b = weight.value) != null ? _b : NaN;
      if (set.completed && !Number.isNaN(numeric)) {
        totalVolume += numeric * set.reps;
        completedSets += 1;
        totalReps += set.reps;
        const unit = typeof weight === "number" ? null : weight.unit;
        if (totalVolumeUnit == null && unit != null && set.seconds == null) {
          totalVolumeUnit = unit;
        }
        estimatedDurationSeconds += ((_c = set.restSeconds) != null ? _c : ex.restSeconds) + ((_d = set.seconds) != null ? _d : workSecondsPerSet);
      }
    }
  }
  return {
    exercises,
    totalVolume,
    totalVolumeUnit,
    completedSets,
    totalSets,
    totalReps,
    exercisesCompleted,
    estimatedDurationSeconds,
    workSecondsPerSet
  };
}

// progression.ts
function weightToToken(weight) {
  const v = Math.round(weight.value * 100) / 100;
  return `${v}${weight.unit}`;
}
function lpArgs(progress) {
  var _a;
  if (!progress || progress.type !== "lp") {
    return null;
  }
  return (_a = progress.args) != null ? _a : [];
}
function computeNextExercise(exercise) {
  var _a, _b;
  if (exercise.isStretch) {
    return null;
  }
  const args = lpArgs(exercise.progress);
  if (!args) {
    return null;
  }
  const completedSets = exercise.sets.filter((s) => s.completed);
  const allCompleted = completedSets.length === exercise.sets.length && exercise.sets.length > 0;
  const requiredReps = exercise.sets.reduce((acc, s) => acc + s.reps, 0);
  const totalReps = allCompleted ? requiredReps : completedSets.reduce((acc, s) => acc + s.reps, 0);
  const unit = (_b = (_a = exercise.sets[0]) == null ? void 0 : _a.weight.unit) != null ? _b : "lb";
  const weights = exercise.sets.map((s) => s.weight);
  const result = applyLinearProgression(args, {
    totalReps,
    requiredReps,
    weights
  }, { unit });
  const currentWeight = exercise.sets[0].weight;
  let newWeight = currentWeight;
  let overloaded = false;
  const inc = result.increment;
  if (result.incrementPerformed) {
    newWeight = weightAddIncrement(currentWeight, inc);
    overloaded = true;
  } else if (result.decrementPerformed && weightIs(result.decrement)) {
    newWeight = weightAddIncrement(currentWeight, weightNegate(result.decrement));
    overloaded = true;
  }
  const hasProgressArgs = exercise.progress.args.length > 0;
  const line = buildNextLine(
    exercise,
    overloaded ? newWeight : null,
    result.successCounter,
    result.failureCounter,
    hasProgressArgs
  );
  return {
    line,
    newWeight: overloaded ? newWeight : null,
    increment: result.incrementPerformed ? inc : null,
    decrement: result.decrementPerformed ? result.decrement : null
  };
}
function weightNegate(w) {
  return { value: -w.value, unit: w.unit };
}
function buildNextLine(exercise, newWeight, successCounter, failureCounter, hasProgressArgs) {
  const name = exercise.name;
  const tokens = exercise.sets.map((s) => {
    const w = newWeight != null ? newWeight : s.weight;
    return `${s.reps}x${weightToToken(w)}`;
  });
  const restBits = [];
  if (exercise.restSeconds > 0) {
    restBits.push(`rest: ${exercise.restSeconds}`);
  }
  if (hasProgressArgs) {
    const rebuilt = rebuildLpArgs(exercise.progress.args, successCounter, failureCounter);
    restBits.push(rebuilt);
  }
  const markers = exercise.sets.map(() => "[ ]").join(" ");
  const spec = [name, "/", tokens.join(", "), ...restBits].join(" ");
  return `${markers} ${spec}`;
}
function rebuildLpArgs(args, successCounter, failureCounter) {
  const copy = [...args];
  if (copy.length > 2) {
    copy[2] = String(successCounter);
  }
  if (copy.length > 5) {
    copy[5] = String(failureCounter);
  }
  while (copy.length > 0 && (copy[copy.length - 1] === void 0 || copy[copy.length - 1].trim() === "")) {
    copy.pop();
  }
  return `progress: lp(${copy.join(", ")})`;
}

// nextWorkout.ts
function today() {
  const d = /* @__PURE__ */ new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function resetMarkers(line) {
  return line.replace(/\[x\]|\[ \]/gi, "[ ]");
}
function buildNextWorkoutContent(input) {
  const date = today();
  const previousLink = `[[${input.previousTitle}]]`;
  const blocks = extractLiftoscriptBlocks(input.previousText);
  const renderedBlocks = blocks.map((block) => {
    const lines = block.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    const nextLines = lines.map((line) => {
      const ex = parseExerciseLine(line);
      const next = ex.progress ? computeNextExercise(ex) : null;
      if (next) {
        return next.line;
      }
      return resetMarkers(line);
    });
    return "```" + BLOCK_LANG + "\n" + nextLines.join("\n") + "\n```";
  });
  const yaml = [
    "---",
    `date: ${date}`,
    "total_volume: 0",
    `total_volume_unit: lb`,
    "completed_sets: 0",
    "exercises_completed: 0",
    "session_duration: 0:00",
    "session_duration_seconds: 0",
    `previous_workout: ${previousLink}`,
    "---"
  ].join("\n");
  const parts = [
    yaml,
    "",
    "# Workout",
    "",
    ...renderedBlocks.length ? renderedBlocks : ["```" + BLOCK_LANG + "\n```"],
    ""
  ];
  return parts.join("\n");
}
var FALLBACK_LINE = "# Today's plan. Replace the sample below and add your own sets.\n```" + BLOCK_LANG + "\n[ ] [ ] [ ] Sample Exercise / 5x100lb, rest: 90\n```";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BLOCK_LANG,
  buildNextWorkoutContent,
  computeNextExercise,
  extractLiftoscriptBlocks,
  parseExerciseLine,
  summarizeWorkoutText,
  weightToToken
});
