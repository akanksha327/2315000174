import React from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import './index.css'
import App from './App.jsx'

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#08090d',
      paper: '#0f111a',
    },
    primary: {
      main: '#38bdf8',
    },
    secondary: {
      main: '#ec4899',
    },
    text: {
      primary: '#f1f5f9',
      secondary: '#94a3b8',
    },
  },
  typography: {
    fontFamily: "'Inter', sans-serif",
    h1: { fontFamily: "'Outfit', sans-serif" },
    h2: { fontFamily: "'Outfit', sans-serif" },
    h3: { fontFamily: "'Outfit', sans-serif" },
    h4: { fontFamily: "'Outfit', sans-serif" },
    h5: { fontFamily: "'Outfit', sans-serif" },
    h6: { fontFamily: "'Outfit', sans-serif" },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#08090d',
          color: '#f1f5f9',
        },
      },
    },
  },
});

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
