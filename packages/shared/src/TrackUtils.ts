// packages/shared/src/TrackUtils.ts

// Raw track control points [x, z] — must match Track.ts TRACK_POINTS in client
export const TRACK_CONTROL_POINTS: Array<[number, number]> = [
  [0, 60], [40, 50], [70, 20], [70, -30], [40, -60],
  [0, -75], [-40, -60], [-70, -30], [-70, 20], [-40, 50],
];

const N = TRACK_CONTROL_POINTS.length; // 10 unique points (closed loop)

function catmullRom1D(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

/** Evaluate the closed Catmull-Rom curve at t in [0, 1) */
export function evalTrackCurve(t: number): [number, number] {
  const segment = (((t % 1) + 1) % 1) * N;
  const i = Math.floor(segment);
  const localT = segment - i;
  const p0 = TRACK_CONTROL_POINTS[(i - 1 + N) % N];
  const p1 = TRACK_CONTROL_POINTS[i % N];
  const p2 = TRACK_CONTROL_POINTS[(i + 1) % N];
  const p3 = TRACK_CONTROL_POINTS[(i + 2) % N];
  return [
    catmullRom1D(p0[0], p1[0], p2[0], p3[0], localT),
    catmullRom1D(p0[1], p1[1], p2[1], p3[1], localT),
  ];
}

/** 500 pre-sampled points for fast nearest-neighbour projection */
export interface CurveSample { x: number; z: number; t: number; }
export const CURVE_SAMPLES: CurveSample[] = Array.from({ length: 500 }, (_, i) => {
  const t = i / 500;
  const [x, z] = evalTrackCurve(t);
  return { x, z, t };
});

/** Project world XZ onto curve, returning t in [0, 1) */
export function projectOnCurve(x: number, z: number): number {
  let best = 0, bestDist = Infinity;
  for (const s of CURVE_SAMPLES) {
    const d = (s.x - x) ** 2 + (s.z - z) ** 2;
    if (d < bestDist) { bestDist = d; best = s.t; }
  }
  return best;
}

/** 8 equidistant checkpoints. CP 0 = start/finish line near (0, 60) */
export const CHECKPOINT_T_VALUES: number[] = Array.from({ length: 8 }, (_, i) => i / 8);

/** World XZ positions of each checkpoint */
export const CHECKPOINT_POSITIONS: Array<{ x: number; z: number }> = CHECKPOINT_T_VALUES.map(t => {
  const [x, z] = evalTrackCurve(t);
  return { x, z };
});

/** 6 item box t-values spread around track */
export const ITEM_BOX_T_VALUES = [0.08, 0.25, 0.42, 0.58, 0.75, 0.92];

/** World positions for item boxes (y=0.8 for visual height) */
export const ITEM_BOX_WORLD_POSITIONS: Array<{ x: number; y: number; z: number }> =
  ITEM_BOX_T_VALUES.map(t => {
    const [x, z] = evalTrackCurve(t);
    return { x, y: 0.8, z };
  });
