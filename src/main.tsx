import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-700.css';
import '@fontsource/ibm-plex-sans-arabic/latin-400.css';
import '@fontsource/ibm-plex-sans-arabic/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/latin-700.css';
import './styles.css';
import { AppProvider } from './state';
import { App } from './App';
import { LangProvider } from './i18n';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LangProvider>
      {(lang) => (
        <AppProvider>
          <App key={lang} />
        </AppProvider>
      )}
    </LangProvider>
  </StrictMode>,
);
