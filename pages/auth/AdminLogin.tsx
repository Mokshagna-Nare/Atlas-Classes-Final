
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const AdminLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const auth = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (auth) {
          await auth.login({ email, password }, 'admin');
          navigate('/dashboard/admin');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-atlas-dark flex items-center justify-center">
      <div className="bg-atlas-soft p-8 rounded-lg shadow-2xl w-full max-w-md border border-gray-800">
        <div className="text-center mb-6">
             <img 
                src="https://i.postimg.cc/xdCpx0Kj/Logo-new-(1).png" 
                alt="Atlas Classes" 
                className="h-20 w-auto mx-auto mb-4 object-contain" 
            />
            <h2 className="text-3xl font-bold text-atlas-green">Admin Login</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-sm font-bold text-gray-400 block mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-atlas-dark border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-atlas-green text-white placeholder-gray-600"
              placeholder="e.g., admin@atlas.com"
              required
            />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-400 block mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-atlas-dark border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-atlas-green text-white placeholder-gray-600"
              placeholder="e.g., password"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={auth?.isLoading} className="w-full bg-atlas-green text-white font-bold py-3 px-6 rounded-md hover:bg-green-600 transition duration-300 shadow-md shadow-green-900/20 disabled:opacity-50">
            {auth?.isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <p className="text-center text-gray-500 mt-4 text-sm">
            Go back to <Link to="/" className="text-atlas-green hover:underline font-medium">Home</Link>
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
