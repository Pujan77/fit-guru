import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import type { Session } from '@supabase/supabase-js';
import { Utensils, Dumbbell, Flame, User, Loader2, CheckCircle2 } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

// Import our separated components
import Diet from './components/Diet';
import Gym from './components/Gym';
import Activity from './components/Activity';
import Profile from './components/Profile';
import type { UserProfile } from './types';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState('diet');
  const [verifiedScreen, setVerifiedScreen] = useState(false);
  
  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginView, setIsLoginView] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  // Parse URL hash for email verification
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('type=signup')) {
      window.history.replaceState(null, '', window.location.pathname);
      supabase.auth.signOut().then(() => setVerifiedScreen(true));
    }
  }, []);

  // Safely hoisted fetch profile function
  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setProfile(data as UserProfile);
      // Force user to setup profile if AI hasn't calculated macros yet
      if (!data.daily_target_calories) {
        setActiveTab('profile'); 
      }
    }
  }, []);

  // Watch Auth State
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: initSession } }) => {
      if (initSession && !verifiedScreen) { 
        setSession(initSession); 
        fetchProfile(initSession.user.id); 
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (currentSession && !verifiedScreen) { 
        setSession(currentSession); 
        fetchProfile(currentSession.user.id); 
      } else if (!currentSession) { 
        setSession(null); 
        setProfile(null); 
      }
    });

    return () => subscription.unsubscribe();
  }, [verifiedScreen, fetchProfile]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setAuthLoading(true);
    
    try {
      if (isLoginView) { 
        const { error } = await supabase.auth.signInWithPassword({ email, password }); 
        if (error) throw error;
        toast.success('Welcome back!'); 
      } else { 
        const { error } = await supabase.auth.signUp({ email, password }); 
        if (error) throw error;
        toast.success('Check email for confirmation link!', { duration: 5000 }); 
        setIsLoginView(true); 
      }
    } catch (err: unknown) { 
      if (err instanceof Error) {
        toast.error(err.message); 
      }
    } finally { 
      setAuthLoading(false); 
    }
  };

  // --- Auth & Verification Screens ---
  if (verifiedScreen) return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 bg-slate-900 text-center">
      <CheckCircle2 size={64} className="text-emerald-500 mb-6" />
      <h2 className="text-3xl font-bold text-white mb-2">Account Verified!</h2>
      <button onClick={() => setVerifiedScreen(false)} className="w-full max-w-sm rounded-xl bg-blue-600 p-4 font-bold mt-8 text-white">Go to Sign In</button>
    </div>
  );

  if (!session) return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-slate-900">
      <Toaster position="top-center" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} />
      <form onSubmit={handleAuth} className="w-full max-w-sm rounded-xl bg-slate-800 p-6 shadow-lg border border-slate-700">
        <h2 className="mb-6 text-center text-2xl font-bold text-white">{isLoginView ? 'Welcome Back' : 'Create Account'}</h2>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="mb-4 w-full rounded-lg bg-slate-700 p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="mb-6 w-full rounded-lg bg-slate-700 p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        <button type="submit" disabled={authLoading} className="w-full rounded-lg bg-blue-600 p-3 font-semibold text-white disabled:opacity-50 transition">
          {authLoading ? <Loader2 className="mx-auto animate-spin" size={24} /> : (isLoginView ? 'Sign In' : 'Sign Up')}
        </button>
        <p className="mt-4 text-center text-sm text-slate-400">
          <button type="button" onClick={() => setIsLoginView(!isLoginView)} className="text-blue-400 hover:underline">
            {isLoginView ? 'Sign Up instead' : 'Sign In instead'}
          </button>
        </p>
      </form>
    </div>
  );

  // --- Main Layout ---
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-900 text-slate-100">
      <Toaster position="top-center" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} />
      <header className="p-4 pt-6 sticky top-0 bg-slate-900/90 backdrop-blur z-10">
        <h1 className="text-2xl font-black bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">AI FIT PWA</h1>
      </header>
      
      <main className="flex-1 p-4">
        {/* Render Active Tab Component */}
        {profile && activeTab === 'diet' && <Diet session={session} profile={profile} />}
        {profile && activeTab === 'gym' && <Gym session={session} profile={profile} />}
        {profile && activeTab === 'activity' && <Activity session={session} profile={profile} />}
        {profile && activeTab === 'profile' && <Profile session={session} profile={profile} setProfile={setProfile} />}
      </main>

      {/* FIXED BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 left-0 right-0 mx-auto max-w-md bg-slate-900 border-t border-slate-800 flex justify-between px-6 py-3 z-30 pb-safe">
        <button onClick={() => setActiveTab('diet')} className={`flex flex-col items-center gap-1 ${activeTab === 'diet' ? 'text-blue-500' : 'text-slate-500 hover:text-slate-300 transition'}`}>
          <Utensils size={24} /><span className="text-[10px] font-bold">Diet</span>
        </button>
        <button onClick={() => setActiveTab('gym')} className={`flex flex-col items-center gap-1 ${activeTab === 'gym' ? 'text-blue-500' : 'text-slate-500 hover:text-slate-300 transition'}`}>
          <Dumbbell size={24} /><span className="text-[10px] font-bold">Gym</span>
        </button>
        <button onClick={() => setActiveTab('activity')} className={`flex flex-col items-center gap-1 ${activeTab === 'activity' ? 'text-blue-500' : 'text-slate-500 hover:text-slate-300 transition'}`}>
          <Flame size={24} /><span className="text-[10px] font-bold">Activity</span>
        </button>
        <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center gap-1 ${activeTab === 'profile' ? 'text-blue-500' : 'text-slate-500 hover:text-slate-300 transition'}`}>
          <User size={24} /><span className="text-[10px] font-bold">Profile</span>
        </button>
      </nav>
    </div>
  );
}