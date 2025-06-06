import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
//import { useNavigate } from 'react-router-dom';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleResetRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
      alert(`Error: ${error.message}`); // Alert message
    } else {
      setMessage('Password reset link sent! Check your email.');
      alert('Success! Password reset link has been sent to your email.'); // Alert message
    }

    setLoading(false);
  };

  return (
    <div className="login-container">
      <h1 className="login-title">Forgot Password</h1>
      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleResetRequest} className="login-form">
        <div className="form-group">
          <label htmlFor="email">Enter your email</label>
          <input
            type="email"
            id="email"
            placeholder="Enter your registered email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="login-button" disabled={loading}>
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <div className="register-link">
        <a href="/login">Back to Login</a>
      </div>
    </div>
  );
};

export default ForgotPassword;
