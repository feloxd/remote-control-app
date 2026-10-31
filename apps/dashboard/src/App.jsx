import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import useSessionStore from './store/sessionStore';
import Login from './pages/Login';
import Sessions from './pages/Sessions';
import Control from './pages/Control';
import Files from './pages/Files';
import Settings from './pages/Settings';

function ProtectedRoute({ children }) {
  const token = useSessionStore((state) => state.token);
  return token ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/sessions" element={<ProtectedRoute><Sessions /></ProtectedRoute>} />
        <Route path="/control" element={<ProtectedRoute><Control /></ProtectedRoute>} />
        <Route path="/files" element={<ProtectedRoute><Files /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
