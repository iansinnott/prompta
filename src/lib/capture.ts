import type { PostHog } from "posthog-js";

// Define posthog on the window object
declare global {
  interface Window {
    posthog?: PostHog;
  }
}

/**
 * Capture telemetry events. this light indirection is meant to reduce direct
 * dependency on posthog.
 */
const cap = (eventName: string, props?: Record<string, any>) => {
  if (window.posthog) {
    window.posthog.capture(eventName, props);
  }
};

/**
 * Emit an event. For logging, tracking, etc.
 */
export const emit = (eventName: string, props?: Record<string, any>) => {
  // For now this is just a wrapper around capture, but it could be extended later.
  cap(eventName, props);
};
