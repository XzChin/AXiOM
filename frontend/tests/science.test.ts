import { describe, expect, it } from "vitest";
import { display, gaussianShock, latRmse, maxAbs, presetShock, validRollout, zeros } from "../src/utils/science";

describe("science utilities", () => {
  it("converts Kelvin to Celsius", () => expect(display(273.15, 0)).toBeCloseTo(0));
  it("zero amplitude gives a zero shock", () => expect(Math.max(...gaussianShock(0, 15, 88, 3, 0).map(maxAbs))).toBe(0));
  it("gaussian has compact support", () => expect(gaussianShock(0, 15, 88, 2, 1)[0][25][5]).toBe(0));
  it("monsoon stall only changes winds", () => {
    const last = zeros().map((g) => g.map((r) => r.map(() => 1)));
    const d = presetShock("monsoon_stall", last);
    expect([0, 1, 4, 5].every((c) => maxAbs(d[c]) === 0)).toBe(true);
    expect(maxAbs(d[2])).toBeCloseTo(0.4);
  });
  it("rmse of identical grids is zero", () => expect(latRmse(zeros()[0], zeros()[0])).toBe(0));
  it("rejects wrong shapes", () => expect(validRollout([], 10)).toBe(false));
});
