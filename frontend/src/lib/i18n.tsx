import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type LanguageCode = 'en' | 'it' | 'es' | 'fr' | 'de' | 'pt';

export const LANGUAGES: { code: LanguageCode; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
];

const STORAGE_KEY = 'roomly-language';
const DEFAULT_LANGUAGE: LanguageCode = 'en';

// Maps a browser/region locale (e.g. "it-IT", "fr", "pt-BR") to one of our
// supported languages. This is how we infer the "region" of the user on the
// frontend, without needing a server-side geo-IP lookup: the browser already
// reports the OS/region language preference via navigator.language(s).
function resolveSupportedLanguage(tag: string): LanguageCode | null {
  const primary = tag.toLowerCase().split('-')[0];
  const match = LANGUAGES.find((l) => l.code === primary);
  return match ? match.code : null;
}

function detectRegionLanguage(): LanguageCode {
  if (typeof navigator === 'undefined') return DEFAULT_LANGUAGE;
  const candidates = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = resolveSupportedLanguage(candidate);
    if (resolved) return resolved;
  }
  return DEFAULT_LANGUAGE;
}

function loadStoredLanguage(): LanguageCode | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && LANGUAGES.some((l) => l.code === stored)) return stored as LanguageCode;
  } catch {
    // localStorage unavailable (e.g. private mode) — fall through to detection
  }
  return null;
}

export const translations = {
  en: {
    'nav.findRoom': 'Find a room',
    'nav.messages': 'Messages',
    'nav.myProfile': 'My profile',
    'nav.overview': 'Overview',
    'nav.listRoom': 'List a room',
    'nav.lookingForRoom': 'Looking for a room?',
    'nav.backToHunting': 'Back to room hunting',
    'nav.openMenu': 'Open menu',
    'settings.language': 'Language',
    'settings.languageDesc': 'Choose how Roomly speaks to you. We picked one based on your region — change it any time.',
    'settings.languageAuto': 'Detected from your region',
    'settings.languageManual': 'Set manually',
    'common.tryAgain': 'Try again',
    'common.somethingWrong': "That didn't load properly",
    'common.somethingWrongDesc': "Give it another try. If it keeps happening, we'll be here when you're ready.",
  },
  it: {
    'nav.findRoom': 'Trova una stanza',
    'nav.messages': 'Messaggi',
    'nav.myProfile': 'Il mio profilo',
    'nav.overview': 'Panoramica',
    'nav.listRoom': 'Pubblica una stanza',
    'nav.lookingForRoom': 'Cerchi una stanza?',
    'nav.backToHunting': 'Torna alla ricerca',
    'nav.openMenu': 'Apri il menu',
    'settings.language': 'Lingua',
    'settings.languageDesc': 'Scegli come Roomly ti parla. Ne abbiamo scelta una in base alla tua regione: puoi cambiarla quando vuoi.',
    'settings.languageAuto': 'Rilevata dalla tua regione',
    'settings.languageManual': 'Impostata manualmente',
    'common.tryAgain': 'Riprova',
    'common.somethingWrong': 'Non si è caricato correttamente',
    'common.somethingWrongDesc': 'Riprova. Se continua a succedere, saremo qui quando sarai pronto.',
  },
  es: {
    'nav.findRoom': 'Buscar habitación',
    'nav.messages': 'Mensajes',
    'nav.myProfile': 'Mi perfil',
    'nav.overview': 'Resumen',
    'nav.listRoom': 'Publicar habitación',
    'nav.lookingForRoom': '¿Buscas habitación?',
    'nav.backToHunting': 'Volver a la búsqueda',
    'nav.openMenu': 'Abrir menú',
    'settings.language': 'Idioma',
    'settings.languageDesc': 'Elige cómo te habla Roomly. Elegimos uno según tu región; puedes cambiarlo cuando quieras.',
    'settings.languageAuto': 'Detectado por tu región',
    'settings.languageManual': 'Configurado manualmente',
    'common.tryAgain': 'Inténtalo de nuevo',
    'common.somethingWrong': 'Eso no se cargó bien',
    'common.somethingWrongDesc': 'Inténtalo otra vez. Si sigue pasando, aquí estaremos.',
  },
  fr: {
    'nav.findRoom': 'Trouver une chambre',
    'nav.messages': 'Messages',
    'nav.myProfile': 'Mon profil',
    'nav.overview': "Vue d'ensemble",
    'nav.listRoom': 'Publier une chambre',
    'nav.lookingForRoom': 'Vous cherchez une chambre ?',
    'nav.backToHunting': 'Retour à la recherche',
    'nav.openMenu': 'Ouvrir le menu',
    'settings.language': 'Langue',
    'settings.languageDesc': 'Choisissez comment Roomly vous parle. Nous en avons choisi une selon votre région, modifiable à tout moment.',
    'settings.languageAuto': 'Détectée selon votre région',
    'settings.languageManual': 'Définie manuellement',
    'common.tryAgain': 'Réessayer',
    'common.somethingWrong': "Ça ne s'est pas bien chargé",
    'common.somethingWrongDesc': 'Réessayez. Si ça continue, nous serons là.',
  },
  de: {
    'nav.findRoom': 'Zimmer finden',
    'nav.messages': 'Nachrichten',
    'nav.myProfile': 'Mein Profil',
    'nav.overview': 'Übersicht',
    'nav.listRoom': 'Zimmer inserieren',
    'nav.lookingForRoom': 'Suchst du ein Zimmer?',
    'nav.backToHunting': 'Zurück zur Suche',
    'nav.openMenu': 'Menü öffnen',
    'settings.language': 'Sprache',
    'settings.languageDesc': 'Wähle, wie Roomly mit dir spricht. Wir haben eine anhand deiner Region gewählt — jederzeit änderbar.',
    'settings.languageAuto': 'Anhand deiner Region erkannt',
    'settings.languageManual': 'Manuell festgelegt',
    'common.tryAgain': 'Erneut versuchen',
    'common.somethingWrong': 'Das hat nicht richtig geladen',
    'common.somethingWrongDesc': 'Versuch es noch einmal. Falls es weiter passiert, sind wir für dich da.',
  },
  pt: {
    'nav.findRoom': 'Encontrar um quarto',
    'nav.messages': 'Mensagens',
    'nav.myProfile': 'Meu perfil',
    'nav.overview': 'Visão geral',
    'nav.listRoom': 'Anunciar um quarto',
    'nav.lookingForRoom': 'Procuras um quarto?',
    'nav.backToHunting': 'Voltar à procura',
    'nav.openMenu': 'Abrir menu',
    'settings.language': 'Idioma',
    'settings.languageDesc': 'Escolhe como o Roomly fala contigo. Escolhemos um com base na tua região — muda quando quiseres.',
    'settings.languageAuto': 'Detetado pela tua região',
    'settings.languageManual': 'Definido manualmente',
    'common.tryAgain': 'Tentar novamente',
    'common.somethingWrong': 'Isso não carregou bem',
    'common.somethingWrongDesc': 'Tenta outra vez. Se continuar a acontecer, estaremos aqui.',
  },
} as const;

type TranslationKey = keyof typeof translations['en'];

type LanguageContextValue = {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
  isAuto: boolean;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(() => loadStoredLanguage() ?? detectRegionLanguage());
  const [isAuto, setIsAuto] = useState<boolean>(() => loadStoredLanguage() === null);

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (code: LanguageCode) => {
    setLanguageState(code);
    setIsAuto(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // ignore write failures (e.g. private browsing)
    }
  };

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    isAuto,
    t: (key: TranslationKey) => translations[language]?.[key] ?? translations.en[key] ?? key,
  }), [language, isAuto]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
