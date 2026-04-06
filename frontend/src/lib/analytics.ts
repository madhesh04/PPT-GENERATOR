/**
 * Safely wraps analytics calls to prevent errors when scripts 
 * are blocked by browser extensions (AdBlock, Brave, etc.)
 */
export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  try {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', eventName, params);
    }
  } catch (error) {
    // Silently handle the error to prevent app crashes or console noise
    console.debug('Analytics blocked or failed:', error);
  }
};

/**
 * Safely wraps page view tracking
 */
export const trackPageView = (url: string) => {
  try {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('config', 'GA_MEASUREMENT_ID', {
        page_path: url,
      });
    }
  } catch (error) {
    console.debug('Analytics page view blocked:', error);
  }
};
