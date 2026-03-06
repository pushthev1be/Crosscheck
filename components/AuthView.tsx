
import React, { useState, useEffect } from 'react';
import { BrainCircuit, Mail, Lock, User as UserIcon, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { User } from '../types';
import { supabase } from '../services/supabaseClient';

interface AuthViewProps {
  onAuth: (user: User) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuth }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });

  const [errorMsg, setErrorMsg] = useState('');
  const [showResendOption, setShowResendOption] = useState(false);

  const handleResendConfirmation = async () => {
    if (!formData.email) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.resendEnrollmentEmail(formData.email);
      if (error) {
        setErrorMsg('Failed to resend email: ' + error.message);
      } else {
        setErrorMsg('Confirmation email sent! Check your inbox and spam folder.');
        setShowResendOption(false);
      }
    } catch (err: any) {
      setErrorMsg('Error resending email: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check for existing session on mount
    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          // Session exists, restore user
          onAuth({
            id: data.session.user.id,
            username: data.session.user.user_metadata?.username || data.session.user.email?.split('@')[0] || 'User',
            email: data.session.user.email || '',
            joinedAt: data.session.user.created_at || new Date().toISOString()
          } as any);
        }
      } catch (err) {
        console.error('Session check error:', err);
      }
    };
    
    checkSession();
  }, [onAuth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      if (isLogin) {
        console.log('Attempting login with email:', formData.email);
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) {
          console.error('Login error:', error);
          if (error.message.includes('Invalid login credentials')) {
            setErrorMsg('Invalid email or password. Email confirmation may also be required.');
            setShowResendOption(true);
          } else if (error.message.includes('Email not confirmed')) {
            setErrorMsg('Please confirm your email before logging in.');
            setShowResendOption(true);
          } else {
            setErrorMsg(error.message || 'Login failed. Please try again.');
            setShowResendOption(false);
          }
          return;
        }

        if (data.user) {
          console.log('Login successful for user:', data.user.id);
          onAuth({
            id: data.user.id,
            username: data.user.user_metadata?.username || formData.email.split('@')[0],
            email: data.user.email || formData.email,
            joinedAt: data.user.created_at || new Date().toISOString()
          } as any);
        }
      } else {
        // Validate password strength
        if (formData.password.length < 6) {
          setErrorMsg('Password must be at least 6 characters long.');
          return;
        }

        console.log('Attempting signup with email:', formData.email);
        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              username: formData.username
            }
          }
        });

        if (error) {
          console.error('Signup error:', error);
          // Check for specific error messages from Supabase
          if (error.message.includes('already registered') || error.message.includes('User already exists')) {
            setErrorMsg('This email already has an account. Please log in instead.');
          } else if (error.message.includes('rate limit') || error.message.includes('429')) {
            setErrorMsg('Too many signup attempts. Please try again in a few minutes.');
          } else if (error.message.includes('invalid email')) {
            setErrorMsg('Please enter a valid email address.');
          } else {
            setErrorMsg(error.message || 'Signup failed. Please try again.');
          }
        } else if (data.session || data.user) {
          // If email confirmation is required, the user might not be immediately logged in.
          // But for simplicity, we pass them right through if a session exists
          console.log('Signup successful for user:', data.user?.id);
          onAuth({
            id: data.user?.id || crypto.randomUUID(),
            username: formData.username || formData.email.split('@')[0],
            email: formData.email,
            joinedAt: data.user?.created_at || new Date().toISOString()
          } as any);
        } else {
          setErrorMsg('Account created! Check your email for the confirmation link.');
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setErrorMsg(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-theme-primary via-theme-secondary to-theme-tertiary">
      <div className="max-w-md w-full animate-fade-in">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center bg-theme-accent p-4 rounded-[2rem] shadow-2xl shadow-theme-accent mb-6">
            <BrainCircuit size={48} className="text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-theme-primary mb-2">StudyGenius AI</h1>
          <p className="text-theme-muted font-medium">Your personal AI learning companion</p>
        </div>

        <div className="bg-theme-card p-10 rounded-[2.5rem] shadow-xl border border-theme-primary">
          <h2 className="text-2xl font-bold text-theme-primary mb-8">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>

          {errorMsg && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-sm flex flex-col gap-3 animate-fade-in">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
              {showResendOption && isLogin && (
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={loading}
                  className="mt-2 px-4 py-2 bg-rose-500 text-white rounded-lg text-xs font-bold hover:bg-rose-600 transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 size={14} className="inline animate-spin" /> : 'Resend Confirmation Email'}
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-tertiary" size={20} />
                <input
                  type="text"
                  placeholder="Full Name"
                  required
                  className="w-full pl-12 pr-4 py-4 bg-theme-hover border border-theme-secondary rounded-2xl focus:ring-2 focus:ring-theme-accent focus:border-theme-accent outline-none transition-all text-theme-primary font-medium"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-tertiary" size={20} />
              <input
                type="email"
                placeholder="Email Address"
                required
                className="w-full pl-12 pr-4 py-4 bg-theme-hover border border-theme-secondary rounded-2xl focus:ring-2 focus:ring-theme-accent focus:border-theme-accent outline-none transition-all text-theme-primary font-medium"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-tertiary" size={20} />
              <input
                type="password"
                placeholder="Password"
                required
                className="w-full pl-12 pr-4 py-4 bg-theme-hover border border-theme-secondary rounded-2xl focus:ring-2 focus:ring-theme-accent focus:border-theme-accent outline-none transition-all text-theme-primary font-medium"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <button
              disabled={loading}
              className="w-full py-4 bg-theme-accent text-white rounded-2xl font-bold text-lg hover:bg-theme-accent-secondary transition-all flex items-center justify-center gap-2 shadow-lg shadow-theme-accent disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Login' : 'Create Account'} <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-theme-primary text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-theme-muted font-semibold hover:text-theme-accent transition-colors"
            >
              {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
