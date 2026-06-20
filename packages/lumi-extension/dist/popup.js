// v0 dist build = re-export of src/. A real build step (esbuild/rollup) will
// bundle the shared module so popup HTML can ship a single file. Until then,
// the renderer imports its sibling source.
export * from '../src/popup.js';
import '../src/popup.js';
