# Fly Circuit Lab 0.2 — electrical circuit simulator

This package contains an interactive brain map and a working, simplified electrical circuit simulator using real FlyWire-derived wiring. Run control trials, compare explicit circuit interventions, cancel trials, and export results. Drug-specific pharmacology is not implemented: selecting a compound changes evidence notes and the research topic, not neuronal parameters.

## Host on Vercel

1. Extract the archive. Keep `package.json`, `vercel.json`, `scripts`, and `dist` together in the project root.
2. Put the extracted project in a Git repository and import that repository into Vercel. If the project is inside another folder in your repository, select that folder as Vercel's Root Directory.
3. Deploy. The included `vercel.json` selects **Other** as the framework, runs **npm run build**, and serves **dist**. No environment variables or dependencies are required.

If deploying with the Vercel CLI, run `npx vercel` from the extracted project root. This creates a deployment; it has not been run for you.

The build command checks the entry files, JavaScript syntax, and all data checksums. It preserves the existing static files. Keep `dist` committed to your repository; it contains the application and real brain data, rather than disposable generated output.

Configuration reference: https://vercel.com/docs/project-configuration/vercel-json

## Current viewer

Included data: 138,639 neurons, 15,091,983 connection records, and 54,492,922 synaptic contacts from the v783 files in the published Shiu laboratory model repository. Fourteen modeled cells lack matched coordinates; their locations are not invented. All connection records are loaded into the background simulation worker. The display samples anatomical reference points; it is not a rendering of complete neuron shapes.

Open the viewer by serving the `dist` directory through a local web server, then opening that server's address in a modern browser. Opening index.html directly from the file system will not load the data. If Python is installed, run `python -m http.server 8765 --directory dist` from this project folder and open http://localhost:8765/.

The viewer uses browser-native gzip decompression and loads approximately 56 MB of compressed data if all graph assets are requested. Its initial map requests only coordinates and annotations. Fonts are optionally loaded from Google Fonts, with system fallbacks.

The first trial loads roughly 54 MB of connection files and reports download progress. Later trials reuse the matrix in memory. Loading failures show a message and a retry button. Avoid replacing only index.html when updating the deployment: the JavaScript modules and all data files must be present.

## Model and interpretation

The engine adapts the Shiu-style leaky integrate-and-fire equations with a 0.1 ms integration step, exact linear updates between events, and seeded probabilistic input. It uses a −52 mV resting/reset potential, −45 mV spike threshold, 20 ms membrane time constant, 5 ms synaptic decay, 1.8 ms delay, and 2.2 ms refractory period (zero for stimulated cells). Signed connection weights are 0.275 mV per contact. Cells start at rest. Input uses per-step Bernoulli draws to approximate Poisson stimulation. This adaptation is not an exact reproduction of Brian2 scheduling and has not been biologically validated against drug-exposed flies.

The hypothesis control scales outgoing connection weights for the selected cells. It is not a receptor model. A 100% hypothesis reproduces the control; 0% silences outgoing signals. Every comparison reruns control and hypothesis from the same seed and input conditions. Serotonin-producing neurons are not a map of serotonin receptor locations.

Compound-eye optics and photoreceptor transduction are possible modeling extensions, but are not implemented here. Motion presets stimulate identified T4/T5 cells directly. Neither this model nor its visual display establishes subjective experience.

The source model's equations and constants are described in the research specification delivered separately. There is no validated mapping from the listed drugs to all fly neurons or to subjective experience in this project.

Data and model sources:

- https://github.com/philshiu/Drosophila_brain_model
- https://www.nature.com/articles/s41586-024-07763-9
- https://github.com/flyconnectome/flywire_annotations
- https://home.flywire.ai/

File hashes and provenance are in dist/data/manifest.json. The upstream model license is in dist/data/LICENSE-model.txt. Retain scientific attribution when reusing the data.

## Verification

Ten automated checks cover quiet controls, repeatability, neutral comparisons, outgoing silencing, inhibitory signs, passive membrane dynamics, invalid inputs, raw and HTTP-decoded gzip assets, missing files, and timeouts. Run them with `npm test`.

Browser checks passed using the full connection matrix: initial controls enabled; control and hypothesis trials completed; neutral comparison matched exactly; output silencing reduced downstream activity; cancellation and subsequent runs worked; JSON export included interpretation; a missing connection file produced a retryable error; retry succeeded after restoring it; and the mobile layout had no horizontal overflow. These are implementation checks, not scientific validation of drug predictions. No hosted version was deployed during this fix.
