import { it, expect } from "vitest";
import {
  defaults,
  exposure,
  visual,
  valid,
  fresh,
  parse,
  add,
  exportText,
} from "../src/model";
it("a referência tem zero EV", () => expect(exposure(defaults())).toBe(0));
it("dobrar ISO ou tempo aumenta um ponto", () => {
  expect(exposure({ ...defaults(), iso: 800 })).toBe(1);
  expect(exposure({ ...defaults(), speed: 250 })).toBe(-1);
});
it("dobrar o número f reduz dois pontos", () =>
  expect(exposure({ ...defaults(), aperture: 8 })).toBe(-2));
it("limita efeitos visuais sem infinitos", () => {
  for (const aperture of [1.8, 16])
    for (const speed of [30, 1000])
      for (const iso of [100, 3200]) {
        const v = visual({ ...defaults(), aperture, speed, iso });
        expect(v.brightness).toBeGreaterThanOrEqual(0.13);
        expect(v.brightness).toBeLessThanOrEqual(3);
        expect(v.blur).toBeGreaterThanOrEqual(0);
      }
});
it.each([
  { scene: "x" },
  { aperture: 0 },
  { speed: 0 },
  { iso: Infinity },
  { focus: 86 },
  { focus: 2.5 },
])("rejeita ajustes fora das escalas %j", (p) =>
  expect(valid({ ...defaults(), ...p })).toBe(false),
);
it("guarda apenas oito ensaios e restaura o arquivo", () => {
  let d = fresh();
  for (let i = 0; i < 10; i++)
    d = add(d, {
      id: "F-" + i,
      at: i,
      settings: defaults(),
      note: "Texto <b>literal</b>",
    });
  expect(d.shots.length).toBe(8);
  expect(d.shots[0].id).toBe("F-2");
  expect(parse(JSON.stringify(d))).toEqual(d);
  expect(exportText(d)).toContain("Texto <b>literal</b>");
});
it("descarta IDs inseguros, repetidos e configurações inválidas", () => {
  const shot = { id: "F-ABC", at: 1, settings: defaults(), note: "" };
  expect(parse(JSON.stringify({ ...fresh(), shots: [shot, shot] }))).toBeNull();
  expect(
    parse(JSON.stringify({ ...fresh(), shots: [{ ...shot, id: "F-<img>" }] })),
  ).toBeNull();
  expect(
    parse(
      JSON.stringify({
        ...fresh(),
        shots: [{ ...shot, settings: { ...defaults(), iso: 0 } }],
      }),
    ),
  ).toBeNull();
});
