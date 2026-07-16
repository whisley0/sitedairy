import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import zhTW from './locales/zh-TW';

export const SUPPORTED_LANGUAGES = ['en', 'zh-TW'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  en: 'En',
  'zh-TW': '繁體',
};

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'zh-TW': { translation: zhTW },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
