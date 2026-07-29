import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../api/axios';

export const usePlacementsFetch = () => {
  const [loading, setLoading] = useState(true);
  const [isColdStart, setIsColdStart] = useState(false);
  
  const coldStartTimer = useRef(null);
  const abortControllerRef = useRef(null);

  const fetchPlacements = useCallback(async (params) => {
    setLoading(true);
    setIsColdStart(false);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    coldStartTimer.current = setTimeout(() => {
      setIsColdStart(true);
    }, 3000);

    try {
      const res = await api.get('/api/placements', {
        params,
        signal: abortController.signal
      });

      clearTimeout(coldStartTimer.current);
      if (abortControllerRef.current === abortController) {
        setLoading(false);
        setIsColdStart(false);
      }
      return { data: res.data.data, pagination: res.data.pagination };
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        return { canceled: true };
      }
      console.error('Failed to fetch placements:', err);
      
      clearTimeout(coldStartTimer.current);
      if (abortControllerRef.current === abortController) {
        setLoading(false);
        setIsColdStart(false);
      }
      return { error: err };
    }
  }, []);

  useEffect(() => {
    return () => {
      if (coldStartTimer.current) {
        clearTimeout(coldStartTimer.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return { loading, isColdStart, fetchPlacements };
};
