/** Optional video-sharing service; ordinary editing and export stay on-device. */
export const OPENREEL_CLOUD_URL = import.meta.env.DEV
  ? "http://localhost:8787"
  : "https://ssh.karri.me/STILL_TODO";
