// ---- India outline (simplified polygon for 32x36 canvas grid coordinates) ----
// Each point is [lat_index, lon_index] in the 32x36 grid. This is a coarse
// representation suitable for the 1-degree canvas overlay.
export const INDIA_OUTLINE: [number, number][] = [
  // Start from Gujarat coast, go clockwise
  [24, 3], [25, 3], [26, 4], [27, 4], [28, 5], [29, 5], [30, 5], [31, 5], // Kutch/Rajasthan
  [31, 6], [31, 8], [31, 10], [31, 12], [30, 14], [29, 15], [28, 16], // J&K / Himachal
  [27, 18], [27, 20], [28, 22], [27, 24], [26, 25], [25, 26], [24, 27], // NE border
  [23, 28], [22, 29], [21, 29], [20, 28], [19, 27], [18, 27], // NE states
  [17, 27], [16, 26], [15, 25], [14, 24], [13, 23], [12, 22], // East coast
  [11, 21], [10, 20], [9, 19], [8, 18], [7, 16], [6, 15], // AP/TN coast
  [5, 14], [4, 13], [3, 13], [2, 12], [1, 11], [1, 10], // TN tip, Kerala
  [2, 9], [3, 8], [4, 8], [5, 7], [6, 7], [7, 6], // Kerala / Karnataka coast
  [8, 6], [9, 6], [10, 5], [11, 5], [12, 5], [13, 5], // Konkan / Goa
  [14, 4], [15, 4], [16, 4], [17, 3], [18, 3], [19, 3], // Maharashtra coast
  [20, 3], [21, 3], [22, 3], [23, 3], [24, 3], // Gujarat coast back to start
];

// Regions for aggregation
export const REGIONS = {
  all_india: { name: "All India Domain", lat: [6.5, 37.5], lon: [65.5, 100.5] },
  western_ghats: { name: "Western Ghats", lat: [8.5, 20.5], lon: [72.5, 77.5] },
  central_monsoon: { name: "Central Monsoon Core", lat: [18.5, 26.5], lon: [74.5, 86.5] },
  indo_gangetic: { name: "Indo-Gangetic Plain", lat: [24.5, 31.5], lon: [74.5, 88.5] },
  northeast: { name: "Northeast & Himalayas", lat: [22.5, 29.5], lon: [88.5, 97.5] },
  bay_of_bengal: { name: "Bay of Bengal", lat: [8.0, 20.0], lon: [82.0, 94.0] },
  arabian_sea: { name: "Arabian Sea", lat: [8.0, 20.0], lon: [65.0, 75.0] },
} as const;

export type RegionId = keyof typeof REGIONS;
