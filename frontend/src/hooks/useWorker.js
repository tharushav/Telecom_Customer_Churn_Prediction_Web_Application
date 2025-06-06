import { useState, useEffect, useRef } from 'react';
// Custom react hook to manage web workers

/**
 * Custom hook to work with Web Workers
 * @param {Worker} worker - A Web Worker instance
 * @return {Object} - Worker state and functions
 */
export function useWorker(worker) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const workerRef = useRef(worker);

  // Event handlers for the workers
  useEffect(() => {
    const currentWorker = workerRef.current;
    
    // Setup message handler
    const messageHandler = (event) => {
      console.log('Worker returned result:', event.data);
      
      // Check if the response contains an error
      if (event.data && event.data.error) {
        setError(event.data.error);
      } else {
        setResult(event.data);
      }
      setIsProcessing(false);
    };
    
    // Setup error handler
    const errorHandler = (err) => {
      console.error('Worker error:', err);
      setError(err.message || 'Unknown worker error');
      setIsProcessing(false);
    };
    
    currentWorker.addEventListener('message', messageHandler);
    currentWorker.addEventListener('error', errorHandler);
    
    // Cleanup when the component unmounts
    return () => {
      currentWorker.removeEventListener('message', messageHandler);
      currentWorker.removeEventListener('error', errorHandler);
      currentWorker.terminate();
    };
  }, []);
  
  // Function to send data to the worker
  const processData = (data) => {
    try {
      console.log('Sending data to worker:', data);
      setIsProcessing(true);
      setError(null);
      setResult(null); // Clear previous results
      workerRef.current.postMessage(data);
    } catch (err) {
      console.error('Failed to send data to worker:', err);
      setError(err.message || 'Failed to start calculation process');
      setIsProcessing(false);
    }
  };
  
  return { result, error, isProcessing, processData };
}
