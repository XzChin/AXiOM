import { describe, expect, it } from "vitest";
import {
  display,
  gaussianShock,
  latRmse,
  maxAbs,
  presetShock,
  validRollout,
  zeros,
  windSpeed,
  pressureAnomaly,
  moistureTransport,
  regionalMean,
  monsoonPulse,
  consequenceProxies,
} from "../src/utils/science";

describe("science utilities", () => {
  it("converts Kelvin to Celsius", () => expect(display(273.15, 0)).toBeCloseTo(0));
  it("zero amplitude gives a zero shock", () => expect(Math.max(...gaussianShock(0, 15, 88, 3, 0).map(maxAbs))).toBe(0));
  it("gaussian has compact support", () => expect(gaussianShock(0, 15, 88, 2, 1)[0][25][5]).toBe(0));
  it("rejects invalid Gaussian channels", () => {
    expect(() => gaussianShock(6, 15, 88, 2, 1)).toThrow(RangeError);
    expect(() => gaussianShock(-1, 15, 88, 2, 1)).toThrow(RangeError);
    expect(() => gaussianShock(1.5, 15, 88, 2, 1)).toThrow(RangeError);
  });
  it("rejects zero, negative, or non-finite Gaussian radii", () => {
    expect(() => gaussianShock(0, 15, 88, 0, 1)).toThrow(RangeError);
    expect(() => gaussianShock(0, 15, 88, -1, 1)).toThrow(RangeError);
    expect(() => gaussianShock(0, 15, 88, Number.NaN, 1)).toThrow(RangeError);
  });
  it("rejects non-finite Gaussian coordinates and amplitude", () => {
    expect(() => gaussianShock(0, Number.NaN, 88, 2, 1)).toThrow(RangeError);
    expect(() => gaussianShock(0, 15, Number.POSITIVE_INFINITY, 2, 1)).toThrow(RangeError);
    expect(() => gaussianShock(0, 15, 88, 2, Number.NaN)).toThrow(RangeError);
  });
  it("monsoon stall only changes winds", () => {
    const last = zeros().map((g) => g.map((r) => r.map(() => 1)));
    const d = presetShock("monsoon_stall", last);
    expect([0, 1, 4, 5].every((c) => maxAbs(d[c]) === 0)).toBe(true);
    expect(maxAbs(d[2])).toBeCloseTo(0.4);
  });
  it("rmse of identical grids is zero", () => expect(latRmse(zeros()[0], zeros()[0])).toBe(0));
  it("rejects wrong shapes", () => expect(validRollout([], 10)).toBe(false));

  it("calculates wind speed correctly", () => {
    const s = zeros();
    s[2][10][10] = 3.0; // u10 = 3
    s[3][10][10] = 4.0; // v10 = 4
    const ws = windSpeed(s);
    expect(ws[10][10]).toBeCloseTo(5.0);
  });

  it("calculates moisture transport proxy", () => {
    const s = zeros();
    s[2][10][10] = 3.0;
    s[3][10][10] = 4.0;
    s[5][10][10] = 50.0; // tcwv = 50
    const mt = moistureTransport(s);
    expect(mt[10][10]).toBeCloseTo(250.0);
  });

  it("calculates pressure anomaly", () => {
    const s = zeros();
    s[4][0][0] = 100000;
    s[4][0][1] = 101000;
    const pa = pressureAnomaly(s);
    expect(pa).toBeDefined();
    expect(pa.length).toBe(32);
    expect(pa[0].length).toBe(36);
  });

  it("computes regional mean over bounding box", () => {
    const g = zeros()[0];
    for (let i = 0; i < 32; i++) {
      for (let j = 0; j < 36; j++) {
        g[i][j] = 10.0;
      }
    }
    const rm = regionalMean(g, [10, 20], [70, 85]);
    expect(rm).toBeCloseTo(10.0);
  });

  it("computes monsoon pulse timeline", () => {
    const roll = Array.from({ length: 10 }, () => zeros());
    const pulse = monsoonPulse(roll);
    expect(pulse.length).toBe(10);
    expect(pulse[0]).toBe(0);
  });

  it("computes consequence screening proxies", () => {
    const roll = Array.from({ length: 10 }, () => zeros());
    const proxies = consequenceProxies(roll);
    expect(proxies.length).toBe(10);
    expect(proxies[0].deficit_frac).toBeGreaterThanOrEqual(0);
  });
});
