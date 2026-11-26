# Dependencies
Graded runtime dependencies are pinned in requirements/runtime.txt (NumPy, Pydantic, FastAPI and Uvicorn). Training and development dependencies are declared separately; not every package is version-locked.

| Package | Purpose |
|---|---|
| numpy | Model, training and inference |
| pydantic | Request validation |
| fastapi / uvicorn | REST API and server |
| scipy | Sparse gradient gathering in training |
| xarray / netCDF4 | Read the dataset (training and demo only) |
| pytest | Tests |
| monsoon_r1 kit wheel, requests | Official validator and scoring |
| react / react-dom | Dashboard |
| tailwindcss / @tailwindcss/vite | Styling |
| vite / @vitejs/plugin-react | Frontend development and build |
| typescript, @types/react, @types/react-dom | Type checking |
| vitest | Frontend tests |

Not used yet: PyTorch, scikit-learn, Plotly.js, Three.js, Jupyter. `training/hdf5_reader.py` falls back to the system
libhdf5 when xarray is missing. Offline Python installation needs wheels prepared for the target system; the judging
image is stated to include numpy, FastAPI and uvicorn.
