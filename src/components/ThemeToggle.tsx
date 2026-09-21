'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    // Check saved theme or system preference
    const saved = localStorage.getItem('civic_theme') as 'light' | 'dark' | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.classList.toggle('dark', saved === 'dark');
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('light');
      document.documentElement.classList.remove('dark');
    } else {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('civic_theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: nextTheme }));
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="p-2 rounded-xl border transition-all flex items-center justify-center 
                 bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 
                 dark:bg-slate-900/80 dark:hover:bg-slate-800 dark:border-slate-800 dark:text-slate-300"
      aria-label="Toggle theme"
      title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-amber-400 transition-transform hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-indigo-600 transition-transform hover:-rotate-12" />
      )}
    </button>
  );
};
