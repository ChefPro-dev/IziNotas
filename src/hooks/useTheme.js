import { useState, useEffect } from 'react';

function useTheme() {
  const initialTheme = localStorage.getItem('theme') || 'dark';
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  return [theme, toggleTheme];
}

export default useTheme;
