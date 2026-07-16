import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useSessionStore from './store/sessionStore';
import Login from './pages/Login';
import Sessions from './pages/Sessions';
import Control from './pages/Control';

function ProtectedRoute({ children }) {
  const token = useSessionStore((s) => s.token);
  return token ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/sessions" element={<ProtectedRoute><Sessions /></ProtectedRoute>} />
          <Route path="/control" element={<ProtectedRoute><Control /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <a
        href="/source"
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-2 right-4 z-50 text-[11px] text-gray-600 hover:text-gray-400 transition-colors"
      >
        Código fuente y licencias · AGPL-3.0
      </a>
    </>
  );
}
