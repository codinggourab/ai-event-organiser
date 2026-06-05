import { useQuery, useMutation } from "convex/react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const useConvexQuery = (query, args) => {
  // Determine if we should skip the query
  // Skip when args is null (waiting for dependencies) or contains undefined values
  const shouldSkip =
    args === null ||
    (args !== undefined &&
      Object.values(args).some((v) => v === undefined || v === null));

  // Always call useQuery - use "skip" token to conditionally disable it
  // This satisfies React's Rules of Hooks (no conditional hook calls)
  const result = useQuery(query, shouldSkip ? "skip" : args ?? {});

  const [data, setData] = useState(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Still loading if skipped or result not yet available
    if (shouldSkip || result === undefined) {
      setIsLoading(true);
      return;
    }

    try {
      setData(result);
      setError(null);
      setIsLoading(false);
    } catch (err) {
      setError(err);
      toast.error(err.message);
      setIsLoading(false);
    }
  }, [result, shouldSkip]);

  return { data, isLoading, error };
};

export const useConvexMutation = (mutation) => {
  const mutationFn = useMutation(mutation);
  const [data, setData] = useState(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const mutate = async (...args) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await mutationFn(...args);
      setData(response);
      return response;
    } catch (err) {
      setError(err);
      toast.error(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { mutate, data, isLoading, error };
};