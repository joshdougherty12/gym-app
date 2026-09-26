/**
 * One or two sentences per exercise: what it is and the cue that matters most.
 * Shown on the workout screen, in the exercise picker and in the program.
 */
export const EXERCISE_DESCRIPTIONS: Record<string, string> = {
  // Horizontal press
  'incline-barbell-press':
    'Bench press on a bench set to about 30°. Lower the bar to your upper chest, elbows slightly tucked, and press up over your chin. Hits upper chest.',
  'incline-db-press': 'Dumbbell press on a ~30° incline bench. Lower the dumbbells to the sides of your upper chest, then press up and slightly together.',
  'flat-db-press': 'Dumbbell bench press on a flat bench. Lower the dumbbells to mid-chest level with elbows about 45° from your body, then press up.',
  'flat-barbell-bench': 'Classic bench press. Shoulder blades pinched, feet planted, lower the bar to mid-chest and press it back up.',
  'machine-chest-press': 'Seated chest press machine. Set the handles at mid-chest height, press forward without locking out hard, return slowly.',
  'incline-smith-press': 'Incline press using the Smith machine (bar on rails). Same as the incline barbell press but the bar path is fixed.',

  // Vertical pull
  'weighted-pull-up':
    'Pull-up, palms facing away, with extra weight on a dip belt or between your feet. Start from a dead hang and pull until your chin clears the bar. Log only the added weight (0 = bodyweight).',
  'chin-up': 'Pull-up with palms facing you, shoulder-width grip. More biceps than a pull-up. Log the added weight (0 = bodyweight).',
  'lat-pulldown': 'Cable machine: sit under the pad, grab the wide bar, pull it to your upper chest by driving your elbows down. Control it back up.',
  'neutral-grip-pulldown': 'Pulldown with the close, palms-facing (V or parallel) handle. Pull to your upper chest, elbows down and back.',

  // Vertical press
  'seated-db-ohp': 'Seated dumbbell shoulder press on an upright bench. Start with dumbbells at ear height, press overhead, lower under control.',
  'standing-barbell-ohp': 'Standing overhead press. Bar starts on your front shoulders; squeeze glutes and abs and press straight up, head moving through at the top.',
  'machine-shoulder-press': 'Seated shoulder press machine. Handles start at shoulder height; press up without shrugging.',

  // Horizontal pull
  'chest-supported-row':
    'Row with your chest on a pad (a machine, or lying face down on an incline bench with dumbbells). Pull elbows back toward your hips and squeeze your shoulder blades. The pad stops you cheating with your lower back.',
  'barbell-row': 'Bent-over row: hinge to about 45°, back flat, pull the bar to your lower ribs, lower it under control.',
  'seated-cable-row': 'Sit at the low cable with feet on the platform, sit tall and pull the handle to your stomach, shoulders back, then reach forward slowly.',
  'one-arm-db-row': 'One hand and knee on a bench, row a dumbbell to your hip with the other arm. Reps are per side.',
  'incline-db-row': 'Lie face down on an incline bench and row two dumbbells up toward your hips. Same idea as the chest-supported row.',

  // Squat
  'back-squat': 'Bar on your upper back, feet about shoulder width. Sit down and back until thighs are at least parallel, knees tracking over toes, then stand up.',
  'front-squat': 'Bar resting on the front of your shoulders, elbows high. Squat down with an upright torso and stand back up. More quads, less back.',
  'hack-squat': 'Machine squat: back against the pad, shoulders under the pads, feet mid-platform. Lower deep, drive back up.',
  'leg-press': 'Sit in the leg press, feet shoulder width on the platform (higher on the platform = less stress on the knees). Lower under control, stopping before your lower back lifts off the pad, press back up.',
  'pendulum-squat': 'Pendulum squat machine: a swinging squat with your back on the pad. Go deep and keep tension on the quads.',

  // Hinge
  'romanian-deadlift':
    'RDL. Stand holding the bar, soft knees, and push your hips back to lower the bar along your legs until you feel a strong hamstring stretch (around mid-shin), back flat. Squeeze glutes to stand up.',
  'db-romanian-deadlift': 'RDL with dumbbells: hips back, dumbbells slide down your legs to mid-shin with a flat back, then stand up.',
  'back-extension': 'On the 45° hyperextension bench: hips on the pad, bend at the hips to lower, then raise until your body is straight. Hold a plate for extra weight.',

  // Lunge / single leg
  'walking-lunge': 'Hold dumbbells at your sides, step forward and lower until the back knee nearly touches the floor, then step through into the next lunge. Reps are per leg.',
  'reverse-lunge': 'Step backward into a lunge, back knee toward the floor, then push through the front foot to return. Easier on the knees. Reps are per leg.',
  'step-up': 'Step onto a box or bench with one foot, drive up through that heel to stand, step down under control. Reps are per leg.',
  'bulgarian-split-squat':
    'Split squat with your back foot resting on a bench behind you. Hold dumbbells, lower straight down on the front leg until the back knee nearly touches the floor, stand up. Reps are per leg.',

  // Knee flexion
  'lying-leg-curl': 'Lie face down on the leg curl machine, pad just above your heels. Curl your heels toward your glutes, lower slowly.',
  'seated-leg-curl': 'Seated leg curl machine: pad above your heels, thigh pad locked down. Curl down and back, return slowly.',

  // Calves
  'standing-calf-raise': 'Standing calf raise machine (or a step with a dumbbell). Go all the way up onto your toes, pause, then lower until your heels are well below the step.',
  'seated-calf-raise': 'Seated calf raise machine, pad on your knees. Full stretch at the bottom, full squeeze at the top. Works the lower calf.',
  'leg-press-calf-raise': 'On the leg press with legs straight, balls of your feet on the bottom edge of the platform. Push the platform with your toes, then let your heels stretch back.',

  // Lateral raise
  'cable-lateral-raise':
    'Stand side-on to a low cable, handle in the far hand. Raise your arm out to the side to shoulder height, slight bend in the elbow, then lower slowly. Builds the side of the shoulder.',
  'db-lateral-raise': 'Dumbbells at your sides, raise them out to shoulder height with a slight elbow bend, lead with the elbows, lower slowly.',
  'machine-lateral-raise': 'Lateral raise machine: pads on the outside of your arms, raise out to shoulder height, lower slowly.',

  // Chest fly
  'low-to-high-cable-fly':
    'Cables set low on both sides. Starting with arms down and back, sweep the handles up and together in front of your upper chest, like a hug. Slight elbow bend throughout.',
  'pec-deck': 'Pec deck (fly machine): arms on the pads or handles, bring them together in front of your chest, return slowly to a stretch.',
  'db-fly': 'Lying on a flat bench, open dumbbells wide with a slight elbow bend until you feel a chest stretch, then bring them back together over your chest.',

  // Triceps
  'overhead-triceps-extension':
    'Facing away from a cable with a rope attached, hands behind your head. Straighten your arms forward and up, keeping elbows pointing ahead. Stretches the long head of the triceps.',
  'triceps-pushdown': 'At a high cable with a bar or rope, elbows pinned to your sides. Push down until your arms are straight, control it back up.',
  'ez-skull-crusher': 'Lying on a bench with an EZ bar over your chest, bend only at the elbows to lower it toward your forehead, then straighten.',
  'db-overhead-extension': 'Hold one dumbbell overhead with both hands, lower it behind your head by bending your elbows, then straighten.',

  // Rear delt
  'face-pull':
    'Rope on a cable at face height. Pull the rope toward your face, splitting the ends apart and ending with hands beside your ears, elbows high. For rear shoulders and posture.',
  'reverse-pec-deck': 'Sit facing the pec deck, handles in front. Open your arms out and back in a wide arc, squeezing the back of your shoulders.',
  'db-reverse-fly': 'Bent over with light dumbbells, raise them out to the sides with a slight elbow bend, squeezing the back of your shoulders.',

  // Biceps
  'incline-db-curl': 'Sit back on an incline bench (about 45°) with arms hanging behind you, curl the dumbbells up without moving your upper arms. Big biceps stretch.',
  'hammer-curl': 'Curl dumbbells with palms facing each other (thumbs up), elbows at your sides. Works biceps and forearms.',
  'cable-curl': 'Curl a bar or handle from a low cable, elbows fixed at your sides, lower slowly.',
  'ez-bar-curl': 'Curl an EZ (wavy) bar with elbows at your sides, lower slowly, no swinging.',

  // Hip extension
  'hip-thrust':
    'Upper back against a bench, barbell (with a pad) across your hips, feet flat. Drive your hips up until your body is straight from shoulders to knees, squeeze glutes, lower.',
  'machine-hip-thrust': 'Hip thrust machine: belt or pad over your hips, drive them up to full extension, squeeze glutes, lower.',
  'cable-pull-through': 'Facing away from a low cable with the rope between your legs, hinge back, then drive your hips forward to stand tall. Glutes and hamstrings.',

  // Core
  'cable-crunch':
    'Kneel facing a high cable, rope held beside your head. Crunch down by rounding your spine, bringing your elbows toward your knees; the hips stay still.',
  'hanging-leg-raise':
    'Hang from a pull-up bar and raise your legs (straight or bent) until your thighs are at least level with your hips, curling your pelvis up. Lower slowly, no swinging. Bodyweight only.',
  'captains-chair-raise': 'In the captain’s chair (forearms on pads, back against the pad), raise your knees toward your chest, lower slowly. Bodyweight only.',
  'ab-wheel':
    'Kneel holding the ab wheel. Roll it forward as far as you can while keeping your back flat and abs braced, then pull it back to your knees with your abs. Bodyweight only.',
  'decline-crunch': 'Crunch on a decline bench holding a dumbbell or plate on your chest.',
  'dead-bug':
    'Lie on your back, arms up, knees bent at 90° over your hips. Press your low back into the floor, then slowly lower one arm and the opposite leg toward the floor and return. Back-friendly core work. Reps per side.',
  'bird-dog':
    'On hands and knees, back flat. Reach one arm forward and the opposite leg back until level, hold a second, return. Keep the hips square. Back-friendly core work. Reps per side.',
  plank: 'Forearms and toes on the floor, body in a straight line from head to heels. Squeeze glutes and abs and hold. Timed.',
  'rkc-plank': 'A harder plank: elbows closer to your head, squeeze glutes, quads and abs as hard as you can. Much harder than a regular plank. Timed.',
  'side-plank': 'On one forearm and the side of your feet, body straight, hips up. Timed, per side.',

  // Conditioning
  'bike-intervals': 'On an exercise bike: 30 seconds hard (you can’t talk), 60 seconds easy, repeated for the full time.',
  'incline-treadmill-intervals': 'On a steep treadmill incline: 30 seconds fast walk or jog, 60 seconds easy walk, repeated for the full time.',
  'rower-intervals': 'On the rowing machine: 30 seconds hard, 60 seconds easy, repeated for the full time.',
}
