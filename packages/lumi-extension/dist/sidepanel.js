// v0 dist build = re-export of src/. A real build step (esbuild/rollup) will
// bundle the shared module so sidepanel HTML can ship a single file. Until
// then, the renderer imports its sibling source.
export * from '../src/sidepanel.js';
import '../src/sidepanel.js';
