// Simple debounce utility for realtime loadPlans calls
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return ((...args: any[]) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  }) as T;
}

// Create a debounced version of loadPlans with 600ms delay
export function createDebouncedLoadPlans(loadPlansFn: () => Promise<void>) {
  const debouncedLoadPlans = debounce(async () => {
    console.log('🔁 debounced loadPlans()');
    try {
      await loadPlansFn();
    } catch (error) {
      console.error('❌ Error in debounced loadPlans():', error);
    }
  }, 600);

  return debouncedLoadPlans;
}
