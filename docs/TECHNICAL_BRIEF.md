# Technical brief (draft: add team details and a screenshot, then check the two-page limit)

## 1. Model
**Data.** Kit ERA5-derived daily fields, 2005-2021, six channels, 32 x 36 grid. Train 2005-2017, validate 2018-2019, test 2020-2021.

**Design.** Per-cell anomalies from a 3-harmonic annual climatology (rain in log1p). A small network (5x5 input
neighbourhood, two 128-unit layers, linear skip) predicts a bounded next-day change, fed back for each further day.
It is equivalent to a local convolution and is implemented in NumPy.

**Training.** One-step Huber loss, then rollout training at 2, 4, 8 and 12 days. No separate sharpness, ensemble or
shock-training stage was run.

**Locality and stability.** At most 2 cells of influence per step. Per-cell anomaly limits curb runaway feedback but do
not remove it in every case. Zero and null shocks use the same code path.

**Held-out results (145 regular windows).** Mean per-window skill 0.117 against the better of persistence and climatology.
Day 4 beats persistence by 22-29% and climatology by 1-16%. Heavy-rain CSI at days 1/4/8: 0.499/0.299/0.277 against
best references 0.445/0.278/0.281. Anti-blur 9.86/10. Shock checks 11.9/15 over 11 windows.

**Failure modes.** Little skill over climatology by day 8; weak rain skill at day 4; no monsoon-stall window passed the
propagation check; warm-ocean rain response exceeded the stability bound in 2 of 11 windows.

## 2. Experience and use
The dashboard calls the running model for every forecast: day and variable selection, cell timeline, Truth vs Twin,
preset and custom shocks with delta maps, and live checks of zero identity, repeatability, rain sign and day-1 locality.

**Possible use (not yet built or validated):** screening a stalled-monsoon rainfall deficit as a crop-water-stress proxy.

## Limitations
Coarse grid; training ends before the 2023-2024 hidden windows (and these weights stop at 2017); no counterfactual truth
for shocks; no calibrated probabilities. Outputs are not official forecasts or warnings.

Data: modified Copernicus Climate Change Service information (ERA5), via Google WeatherBench 2; CC BY 4.0.
