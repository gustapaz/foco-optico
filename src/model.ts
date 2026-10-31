export const apertures = [1.8, 2.8, 4, 5.6, 8, 11, 16];
export const speeds = [30, 60, 125, 250, 500, 1000];
export const isos = [100, 200, 400, 800, 1600, 3200];
export const scenes = [
  {
    id: "forest",
    name: "Luz entre árvores",
    author: "Anna Klymenko",
    source: "sunlit-autumn-forest-path-with-trees-34982425",
    alt: "Caminho de uma floresta de outono, atravessado por luz solar.",
  },
  {
    id: "water",
    name: "Água em queda",
    author: "Rizk Nas",
    source: "long-exposure-waterfall-picture-5113929",
    alt: "Cachoeira em exposição longa entre pedras e vegetação.",
  },
  {
    id: "flower",
    name: "Perto das pétalas",
    author: "Francis Seura",
    source: "macro-photography-of-flower-713770",
    alt: "Flor rosa fotografada de perto, com fundo verde desfocado.",
  },
];
export type Settings = {
  scene: string;
  aperture: number;
  speed: number;
  iso: number;
  focus: number;
};
export type Shot = { id: string; at: number; settings: Settings; note: string };
export type Data = { version: 1; shots: Shot[]; reduced: boolean };
export const defaults = (): Settings => ({
  scene: "forest",
  aperture: 4,
  speed: 125,
  iso: 400,
  focus: 50,
});
export const fresh = (): Data => ({ version: 1, shots: [], reduced: false });
export function valid(p: unknown): p is Settings {
  if (!p || typeof p !== "object") return false;
  const s = p as Settings;
  return (
    scenes.some((v) => v.id === s.scene) &&
    apertures.includes(s.aperture) &&
    speeds.includes(s.speed) &&
    isos.includes(s.iso) &&
    Number.isInteger(s.focus) &&
    s.focus >= 15 &&
    s.focus <= 85
  );
}
export function exposure(p: Settings) {
  return Math.log2((125 / p.speed) * (p.iso / 400) * (4 / p.aperture) ** 2);
}
export function visual(p: Settings) {
  return {
    brightness: Math.max(0.13, Math.min(3, 2 ** (exposure(p) * 0.35))),
    blur: Math.max(0, (16 - p.aperture) * 0.5),
    grain: (Math.log2(p.iso / 100) / 5) * 0.22,
  };
}
export function parse(raw: string): Data | null {
  try {
    const d = JSON.parse(raw);
    if (
      d.version !== 1 ||
      typeof d.reduced !== "boolean" ||
      !Array.isArray(d.shots) ||
      d.shots.length > 8
    )
      return null;
    const ids = new Set();
    for (const shot of d.shots) {
      if (
        !shot ||
        typeof shot.id !== "string" ||
        !/^F-[A-Z0-9-]{1,40}$/.test(shot.id) ||
        ids.has(shot.id) ||
        !Number.isSafeInteger(shot.at) ||
        shot.at < 0 ||
        !valid(shot.settings) ||
        typeof shot.note !== "string" ||
        shot.note.length > 180
      )
        return null;
      ids.add(shot.id);
    }
    return { version: 1, shots: d.shots, reduced: d.reduced };
  } catch {
    return null;
  }
}
export function add(d: Data, shot: Shot): Data {
  return valid(shot.settings) && !d.shots.some((s) => s.id === shot.id)
    ? { ...d, shots: [...d.shots, shot].slice(-8) }
    : d;
}
export function describe(p: Settings) {
  return `f/${p.aperture} · 1/${p.speed} s · ISO ${p.iso} · foco ${p.focus}%`;
}
export function exportText(d: Data) {
  return (
    "FOCO — ENSAIOS DE EXPOSIÇÃO\nPrévia didática aproximada, sem reproduzir óptica real.\n\n" +
    d.shots
      .map(
        (s) =>
          `${s.id} · ${scenes.find((v) => v.id === s.settings.scene)!.name}\n${describe(s.settings)}\n${s.note || "Sem nota."}`,
      )
      .join("\n\n") +
    "\n\nhttps://gustapaz.github.io/foco-optico/"
  );
}
