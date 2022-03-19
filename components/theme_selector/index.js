/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect } from 'react'
import { empty, urlParams } from '../../utils/utils'

export const ThemeSelector = () => {
  useEffect(() => {
    // Check for dark mode preference at the OS level
    let currentTheme = urlParams.get("theme")
    if (!empty(currentTheme)) localStorage.setItem("theme", currentTheme)
    else currentTheme = localStorage.getItem("theme");

    if (empty(currentTheme)) {
      const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");
      if (prefersDarkScheme.matches) currentTheme = "dark";
      else currentTheme = "light";
    }

    if (currentTheme == "dark") {
      document.getElementsByTagName("body")[0].classList.add("dark")
    } else {
      document.getElementsByTagName("body")[0].classList.remove("dark")
    }
  }, [])

  const switchTheme = (e) => {
    if (e) e.preventDefault()
    let theme = '';
    let body = document.getElementsByTagName("body")[0]
    if (body.classList.contains('dark')) {
      body.classList.remove('dark')
      theme = 'light'
    }
    else {
      body.classList.add('dark')
      theme = 'dark'
    }
    localStorage.setItem("theme", theme);
  }

  return (
    <a href="#" id="theme" onClick={switchTheme}>&nbsp;</a>
  )
}
