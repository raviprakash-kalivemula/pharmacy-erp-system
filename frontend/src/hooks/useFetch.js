// src/hooks/useFetch.js
import { useState, useEffect } from 'react';

const useFetch = (apiFunction, autoFetch = true) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiFunction();
      setData(response.data);
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to fetch data';
      setError(errorMessage);
      console.error('Fetch error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const refetch = () => {
    return fetchData();
  };

  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, []);

  return { data, loading, error, refetch };
};

export default useFetch;