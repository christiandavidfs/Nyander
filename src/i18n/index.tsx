import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import es from './es';
import en from './en';

export type Lang = 'es' | 'en';
export type Dict = typeof en;

const dicts: Record<Lang, Dict> = { es, en };
const LANG_KEY = 'nyander_lang';

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<Ctx>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
});

function get(obj: any, path: string): string | undefined {
  return path.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), obj);
}

function detectDeviceLang(): Lang {
  try {
    const locales = Localization.getLocales();
    const tag = locales?.[0]?.languageTag ?? locales?.[0]?.languageCode ?? 'en';
    return tag.toLowerCase().startsWith('es') ? 'es' : 'en';
  } catch {
    return 'en';
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectDeviceLang());

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then((saved) => {
      if (saved === 'es' || saved === 'en') setLangState(saved);
    }).catch(() => {});
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(LANG_KEY, l).catch(() => {});
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    let s = get(dicts[lang], key) ?? get(dicts.en, key) ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, String(v));
    }
    return s;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
