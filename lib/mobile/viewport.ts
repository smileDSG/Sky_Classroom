export const MOBILE_VIEWPORTS = [
  { name: "mobile-320", width: 320, height: 568 },
  { name: "mobile-375", width: 375, height: 667 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-412", width: 412, height: 915 },
  { name: "mobile-landscape", width: 667, height: 375 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

export type MobileViewportName = (typeof MOBILE_VIEWPORTS)[number]["name"];
