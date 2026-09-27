# Local OCR runtime

These same-origin assets remove the browser's dependency on an external CDN.

- `worker.min.js`: installed `tesseract.js@7.0.0/dist/worker.min.js`.
- Three `*-lstm.wasm.js` files: installed `tesseract.js-core@7.0.0` (embedded WebAssembly), covering standard, SIMD and relaxed SIMD browsers.
- `chi_sim.traineddata.gz`: gzip of the project's existing Chinese LSTM language model, used for the real-image regression check.
- Package licenses are included alongside the runtime files.

Keep this versioned directory and the paths in `ImportSheet.tsx` in sync when upgrading Tesseract. OCR runs on the user's device; the schedule image is not sent to an OCR service.
