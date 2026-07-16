import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import useSessionStore from '../store/sessionStore';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setToken = useSessionStore((s) => s.setToken);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await axios.post('/auth/login', { username, password });
      setToken(data.token);
      navigate('/sessions');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="w-full max-w-md p-8 rounded-2xl border border-gray-800 bg-card">
        <div className="mb-8">
          <div className="w-10 h-1 bg-accent rounded mb-4" />
          <h1 className="text-2xl font-bold text-white">Remote Control</h1>
          <p className="text-gray-500 text-sm mt-1">Operator access only</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-surface border border-gray-700 text-white
                         placeholder-gray-600 focus:outline-none focus:border-accent transition-colors"
              placeholder="admin"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-surface border border-gray-700 text-white
                         placeholder-gray-600 focus:outline-none focus:border-accent transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="px-4 py-2.5 rounded-lg bg-red-900/20 border border-red-800/50">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg font-semibold text-white bg-accent
                       hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all mt-2"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
