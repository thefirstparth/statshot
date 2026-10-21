/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module 'virtual:icons' {
  /** Icon name → SVG path data in a 0 -960 960 960 viewBox. */
  const icons: Record<string, string>;
  export default icons;
}
