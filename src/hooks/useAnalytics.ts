import { useState, useEffect, useCallback } from 'react';
import { getAnalytics, type AnalyticsData } from '../services/api';

export function useAnalytics(initialTerm?: string) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<string | undefined>(initialTerm);

  const fetchData = useCallback(async (term?: string) => {
    try {
      setLoading(true);
      const analytics = await getAnalytics(term);
      setData(analytics);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(selectedTerm);
  }, [selectedTerm, fetchData]);

  const changeTerm = useCallback((term: string | undefined) => {
    setSelectedTerm(term === 'all' ? undefined : term);
  }, []);

  return { data, loading, error, selectedTerm, changeTerm };
}
