import { describe, expect, it } from "vitest";
import { validateWindow } from "../src/utils/windowValidation";

function validWindow() {
  return {
    init_states: Array.from({ length: 3 }, () =>
      Array.from({ length: 6 }, () =>
        Array.from({ length: 32 }, () => Array(36).fill(1)),
      ),
    ),
    doy_sincos: [0.5, 0.8660254],
  };
}

describe("uploaded window validation", () => {
  it("accepts a correctly shaped finite window", () => {
    expect(() => validateWindow(validWindow())).not.toThrow();
  });

  it("rejects a missing or incorrectly sized frame array", () => {
    const value = validWindow();
    value.init_states.pop();
    expect(() => validateWindow(value)).toThrow(/init_states/);
  });

  it("rejects jagged grids", () => {
    const value = validWindow();
    value.init_states[0][0][0].pop();
    expect(() => validateWindow(value)).toThrow(/init_states/);
  });

  it("rejects non-finite and non-numeric grid values", () => {
    for (const invalid of [NaN, Infinity, null, "12"]) {
      const value = validWindow();
      (value.init_states[0][0][0] as unknown[])[0] = invalid;
      expect(() => validateWindow(value)).toThrow(/init_states/);
    }
  });

  it("rejects an invalid day-of-year pair", () => {
    const value = validWindow();
    value.doy_sincos = [0.5];
    expect(() => validateWindow(value)).toThrow(/doy_sincos/);
  });

  it("rejects non-finite day-of-year values", () => {
    const value = validWindow();
    value.doy_sincos = [0.5, NaN];
    expect(() => validateWindow(value)).toThrow(/doy_sincos/);
  });

  it("rejects a non-object JSON value", () => {
    expect(() => validateWindow(null)).toThrow(/JSON object/);
  });
});
