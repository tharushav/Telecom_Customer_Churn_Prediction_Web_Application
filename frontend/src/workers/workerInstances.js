// This file create and export web worker instances

// Direct URL import for Vite
export const survivalPredictionWorker = new Worker(
  new URL('./survivalPredictionWorker.js', import.meta.url),
  { type: 'module' }
);

console.log('Worker instance created successfully');
