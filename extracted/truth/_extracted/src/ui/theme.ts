import type { ThemeConfig } from 'antd';
import { appColors } from './colorSystem';

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: appColors.brand[500],
    colorSuccess: appColors.green[500],
    colorWarning: appColors.amber[500],
    colorError: appColors.red[500],
    colorInfo: appColors.brand[500],
    colorText: appColors.neutral[900],
    colorTextSecondary: appColors.neutral[500],
    colorBgBase: '#fbf7ef',
    colorBgContainer: 'rgba(255, 255, 255, 0.92)',
    colorBorder: appColors.neutral[200],
    borderRadius: 14,
    borderRadiusLG: 18,
    boxShadowSecondary: '0 18px 48px rgba(104, 125, 159, 0.12)',
    fontFamily:
      'Inter, "Microsoft YaHei", "PingFang SC", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  components: {
    Layout: {
      bodyBg: 'transparent',
      headerBg: 'transparent',
      siderBg: 'transparent',
    },
    Card: {
      headerBg: 'transparent',
      borderRadiusLG: 18,
    },
    Button: {
      borderRadius: 12,
      controlHeight: 38,
    },
    Tabs: {
      itemSelectedColor: appColors.brand[700],
      inkBarColor: appColors.brand[500],
    },
    Tag: {
      borderRadiusSM: 999,
    },
  },
};
