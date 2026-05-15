import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import type { Session } from '@supabase/supabase-js';
import { Utensils, Dumbbell, Flame, User, Loader2, CheckCircle2, Zap, BrainCircuit, Activity as ActivityIcon } from 'lucide-react';
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
      
      // If they haven't filled out their physical stats, force them to the Profile tab.
      if (!data.height_cm || !data.target_weight_kg) {
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

  // --- NEW LANDING PAGE (Unauthenticated View) ---
  if (!session) return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans overflow-x-hidden">
      <Toaster position="top-center" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} />

      {/* Landing Header */}
      <header className="p-6 flex justify-center items-center">
        <h1 className="text-2xl font-black tracking-widest bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent uppercase">
          AI FIT
        </h1>
      </header>

      <main className="flex-1 w-full max-w-md mx-auto px-6 pb-16 flex flex-col gap-8">
        
        {/* Hero Text */}
        <div className="text-center space-y-4 mt-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h2 className="text-4xl font-black leading-tight text-white">
            Your Personal <br/>
            <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">AI Coach.</span>
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed px-2">
            Log meals instantly using natural language. Get highly customized gym routines based on your fatigue, goals, and schedule.
          </p>
        </div>

        {/* HERO IMAGE PLACEHOLDER */}
        <div className="relative w-full h-56 rounded-3xl overflow-hidden border border-slate-700/50 shadow-2xl shadow-blue-900/20 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 fill-mode-backwards">
          {/* REPLACE THE 'src' URL BELOW WITH YOUR OWN IMAGE LINK */}
          <img
            src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1000&auto=format&fit=crop"
            alt="Fitness training"
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent"></div>
          <div className="absolute bottom-4 left-4 flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
             <span className="text-xs font-bold uppercase tracking-wider text-white drop-shadow-md">Powered by Gemini 2.5</span>
          </div>
        </div>

        {/* Auth Form Card */}
        <div className="w-full rounded-3xl bg-slate-800 p-6 shadow-xl border border-slate-700/50 relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-backwards">
          <h3 className="mb-6 text-center text-xl font-bold text-white">
            {isLoginView ? 'Welcome Back' : 'Start Your Journey'}
          </h3>
          <form onSubmit={handleAuth} className="space-y-4">
            <input 
              type="email" 
              placeholder="Email address" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="w-full rounded-xl bg-slate-900 p-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 border border-slate-700 placeholder:text-slate-500" 
              required 
            />
            <input 
              type="password" 
              placeholder="Password (min 6 chars)" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="w-full rounded-xl bg-slate-900 p-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 border border-slate-700 placeholder:text-slate-500" 
              required 
            />
            <button type="submit" disabled={authLoading} className="w-full mt-2 rounded-xl bg-blue-600 p-4 font-bold text-white disabled:opacity-50 transition hover:bg-blue-500 shadow-lg shadow-blue-900/30">
              {authLoading ? <Loader2 className="mx-auto animate-spin" size={20} /> : (isLoginView ? 'Sign In' : 'Create Free Account')}
            </button>
          </form>
          
          <p className="mt-6 text-center text-sm text-slate-400">
            {isLoginView ? "Don't have an account? " : "Already have an account? "}
            <button type="button" onClick={() => setIsLoginView(!isLoginView)} className="text-blue-400 font-semibold hover:text-blue-300 transition">
              {isLoginView ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="space-y-4 pt-4 animate-in fade-in duration-700 delay-500 fill-mode-backwards">
          <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-800/50 border border-slate-700/30">
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 shrink-0"><BrainCircuit size={24} /></div>
            <div>
              <h4 className="font-bold text-white text-sm mb-1">Effortless Tracking</h4>
              <p className="text-xs text-slate-400 leading-relaxed">Type what you ate naturally. The AI calculates exact calories, protein, carbs, and fats instantly.</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-800/50 border border-slate-700/30">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 shrink-0"><Zap size={24} /></div>
            <div>
              <h4 className="font-bold text-white text-sm mb-1">Dynamic Routines</h4>
              <p className="text-xs text-slate-400 leading-relaxed">Tell the AI you are sore or short on time, and it adjusts your daily workout to keep you on track safely.</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-800/50 border border-slate-700/30">
            <div className="p-3 bg-orange-500/10 rounded-xl text-orange-400 shrink-0"><ActivityIcon size={24} /></div>
            <div>
              <h4 className="font-bold text-white text-sm mb-1">Goal Forecasting</h4>
              <p className="text-xs text-slate-400 leading-relaxed">Set your target weight and date. The AI automatically defines the exact daily deficit needed to succeed.</p>
            </div>
          </div>
        </div>

      </main>
    </div>
  );

  // --- Main Authenticated Layout ---
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-900 text-slate-100">
      <Toaster position="top-center" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} />
      <header className="p-4 pt-6 sticky top-0 bg-slate-900/90 backdrop-blur z-10">
        <h1 className="text-2xl font-black bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">Fit Guru</h1>
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