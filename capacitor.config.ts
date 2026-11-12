import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "au.com.outthereadmin.guard",
  appName: "OTG Event Security",
  webDir: "dist",
  server: {
    url: "https://security.outthereadmin.com.au/mobile",
    cleartext: false,
  },
  // Keeps background location updates flowing past 5 minutes on Android.
  android: { useLegacyBridge: true },
  // Sends web requests natively so Android doesn't throttle location uploads while the phone is locked.
  plugins: { CapacitorHttp: { enabled: true } },
};

export default config;
