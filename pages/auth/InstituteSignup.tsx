
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const InstituteSignup: React.FC = () => {
  const [instituteName, setInstituteName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const navigate = useNavigate();
  const auth = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }
    
    try {
        await auth?.signup({ name: instituteName, email, password, role: 'institute' });
        // After signup, attempt login automatically or redirect to login page
        await auth?.login({ email, password }, 'institute');
        navigate('/dashboard/institute');
    } catch (err: any) {
        setLocalError(err.response?.data?.message || 'Signup failed');
    }
  };

  return (
    <div className="min-h-screen bg-atlas-black flex items-center justify-center">
      <div className="bg-atlas-gray p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-3xl font-bold text-center text-atlas-orange mb-6">Institute Sign Up</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-300 block mb-2">Institute Name</label>
            <input
              type="text"
              value={instituteName}
              onChange={(e) => setInstituteName(e.target.value)}
              className="w-full p-3 bg-atlas-black border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-atlas-orange"
              placeholder="e.g., ABC School"
              required
            />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-300 block mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-atlas-black border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-atlas-orange"
              placeholder="e.g., admin@abcschool.com"
              required
            />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-300 block mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-atlas-black border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-atlas-orange"
              placeholder="••••••••"
              required
            />
          </div>
           <div>
            <label className="text-sm font-bold text-gray-300 block mb-2">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 bg-atlas-black border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-atlas-orange"
              placeholder="••••••••"
              required
            />
          </div>
          {localError && <p className="text-red-500 text-sm">{localError}</p>}
          <button type="submit" disabled={auth?.isLoading} className="w-full bg-atlas-orange text-white font-bold py-3 px-6 rounded-md hover:bg-orange-600 transition duration-300 disabled:opacity-50">
            {auth?.isLoading ? 'Creating Account...' : 'Register Institute'}
          </button>
        </form>
        <p className="text-center text-gray-400 mt-4 text-sm">
            Already registered? <Link to="/login/institute" className="text-atlas-orange hover:underline">Login here</Link>
        </p>
         <p className="text-center text-gray-400 mt-2 text-sm">
            Go back to <Link to="/" className="text-atlas-orange hover:underline">Home</Link>
        </p>
      </div>
    </div>
  );
};

export default InstituteSignup;
