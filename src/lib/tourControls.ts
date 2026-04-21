export const GUIDED_TOURS_ENABLED_KEY = "guided_tours_enabled_v1";
export const GUIDED_TOURS_TOGGLE_EVENT = "guided-tours-toggle";

export const areGuidedToursEnabled = () => {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(GUIDED_TOURS_ENABLED_KEY) !== "0";
};

export const setGuidedToursEnabled = (enabled: boolean) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GUIDED_TOURS_ENABLED_KEY, enabled ? "1" : "0");
  window.dispatchEvent(new CustomEvent(GUIDED_TOURS_TOGGLE_EVENT, { detail: { enabled } }));
};

