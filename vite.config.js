// Rapier's compatibility build initializes its WASM explicitly; no WASM or
// top-level-await transform is needed for the new boat runtime.
export default {
 root:'sources', publicDir:'../static', base:'./',
 build:{outDir:'../dist',emptyOutDir:true,chunkSizeWarningLimit:4000},
 server:{host:'127.0.0.1',port:5173,open:false}
};
