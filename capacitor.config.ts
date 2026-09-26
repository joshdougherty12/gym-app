import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.joshdougherty.cutline',
  appName: 'Cutline',
  webDir: 'dist',
  android: {
    // Dark background behind the web view while it loads.
    backgroundColor: '#121416',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_cutline',
      iconColor: '#FF6B1A',
    },
  },
}

export default config
