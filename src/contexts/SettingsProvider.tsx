import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsContext, DEFAULT_SETTINGS, type Settings } from './SettingsContext';

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const { i18n } = useTranslation();
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('tabularis_settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem('tabularis_settings', JSON.stringify(settings));
    
    // Update i18n language when setting changes
    if (settings.language === 'auto') {
      // Use browser detection
      i18n.changeLanguage();
    } else {
      i18n.changeLanguage(settings.language);
    }
  }, [settings, i18n]);

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
};
