# Fly Circuit Lab — work in progress

This package contains the current interactive brain-map viewer and real FlyWire-derived data. The simulation engine and compound comparisons have NOT been implemented. The trial buttons are disabled. This is not a functioning psychedelic simulator.

## Host on Vercel

1. Extract the archive. Keep `package.json`, `vercel.json`, `scripts`, and `dist` together in the project root.
2. Put the extracted project in a Git repository and import that repository into Vercel. If the project is inside another folder in your repository, select that folder as Vercel's Root Directory.
3. Deploy. The included `vercel.json` selects **Other** as the framework, runs **npm run build**, and serves **dist**. No environment variables or dependencies are required.

If deploying with the Vercel CLI, run `npx vercel` from the extracted project root. This creates a deployment; it has not been run for you.

The build command checks the entry files, JavaScript syntax, and all data checksums. It preserves the existing static files. Keep `dist` committed to your repository; it contains the application and real brain data, rather than disposable generated output.

Configuration reference: https://vercel.com/docs/project-configuration/vercel-json

## Current viewer

Included data: 138,639 neurons, 15,091,983 connection records, and 54,492,922 synaptic contacts from the v783 files in the published Shiu laboratory model repository. Fourteen modeled cells lack matched coordinates; their locations are not invented. The graph data are packaged but are not yet used to simulate activity.

Open the viewer by serving the `dist` directory through a local web server, then opening that server's address in a modern browser. Opening index.html directly from the file system will not load the data. If Python is installed, run `python -m http.server 8765 --directory dist` from this project folder and open http://localhost:8765/.

The viewer uses browser-native gzip decompression and loads approximately 56 MB of compressed data if all graph assets are requested. Its initial map requests only coordinates and annotations. Fonts are optionally loaded from Google Fonts, with system fallbacks.

The source model's equations and constants are described in the research specification delivered separately. There is no validated mapping from the listed drugs to all fly neurons or to subjective experience in this project.

Data and model sources:

- https://github.com/philshiu/Drosophila_brain_model
- https://www.nature.com/articles/s41586-024-07763-9
- https://github.com/flyconnectome/flywire_annotations
- https://home.flywire.ai/

File hashes and provenance are in dist/data/manifest.json. The upstream model license is in dist/data/LICENSE-model.txt. Retain scientific attribution when reusing the data.

JavaScript syntax was checked. Browser preview verification and full functional testing were not completed. No hosted version was published.
