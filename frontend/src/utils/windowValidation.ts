import type { Window_ } from "../api";

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function isGrid(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length === 32 &&
    value.every(
      (row) =>
        Array.isArray(row) &&
        row.length === 36 &&
        row.every(isFiniteNumber),
    )
  );
}

function isState(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length === 6 &&
    value.every(isGrid)
  );
}

export function validateWindow(value: unknown): asserts value is Window_ {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid window JSON: expected a JSON object.");
  }

  const candidate = value as Record<string, unknown>;

  if (
    !Array.isArray(candidate.init_states) ||
    candidate.init_states.length !== 3 ||
    !candidate.init_states.every(isState)
  ) {
    throw new Error(
      "Invalid init_states: expected exactly 3 frames, each with 6 channels of 32 ? 36 finite numbers.",
    );
  }

  if (
    !Array.isArray(candidate.doy_sincos) ||
    candidate.doy_sincos.length !== 2 ||
    !candidate.doy_sincos.every(isFiniteNumber)
  ) {
    throw new Error(
      "Invalid doy_sincos: expected exactly 2 finite numbers.",
    );
  }
}
