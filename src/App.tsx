import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import type { Session } from '@supabase/supabase-js';
import { Utensils, Dumbbell, Send, Loader2, LogOut, User, Target, Scale, CheckCircle2, X } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

// --- TypeScript Interfaces ---
interface FoodItem {
  name: string;
  portion: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rpe: number;
  notes?: string;
}

interface WorkoutPlan {
  routine_title: string;
  estimated_minutes: number;
  exercises: Exercise[];
}

interface UserProfile {
  id: string;
  display_name: string;
  height_cm: number;
  current_weight_kg: number;
  target_weight_kg: number;
  primary_goal: string;
  target_date: string;
  daily_target_calories: number;
  daily_target_protein_g: number;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [inputLog, setInputLog] = useState('');
  const [activeTab, setActiveTab] = useState<'food' | 'workout'>('food');
  const [dailyTotals, setDailyTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [readiness, setReadiness] = useState('Feeling good, standard energy');

  // New State Variables
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWeightPrompt, setShowWeightPrompt] = useState(false);
  const [verifiedScreen, setVerifiedScreen] = useState(false);
  const [todaysWeight, setTodaysWeight] = useState('');

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
      supabase.auth.signOut().then(() => {
        setVerifiedScreen(true);
      });
    }
  }, []);

  // 1. Moved helper functions ABOVE fetchUserData to resolve hoisting error
  const checkDailyWeightPrompt = () => {
    const today = new Date().toISOString().split('T')[0];
    const lastPromptDate = localStorage.getItem('lastWeightPromptDate');
    if (lastPromptDate !== today) {
      setShowWeightPrompt(true);
    }
  };

  const skipWeightPrompt = () => {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('lastWeightPromptDate', today);
    setShowWeightPrompt(false);
  };

  const fetchUserData = async (userId: string) => {
    // Fetch Profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileData) {
      setProfile(profileData as UserProfile);
      if (!profileData.height_cm || !profileData.current_weight_kg) {
        setShowOnboarding(true);
      } else {
        checkDailyWeightPrompt(); // Safely called now!
      }
    }

    // Fetch Today's Nutrition
    const { data: foodData } = await supabase
      .from('nutrition_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('logged_date', new Date().toISOString().split('T')[0]);

    if (foodData && foodData.length > 0) {
      let cals = 0, prot = 0, carbs = 0, fat = 0;
      let items: FoodItem[] = []; 
      
      foodData.forEach(log => {
        cals += log.total_calories;
        prot += log.total_protein_g;
        carbs += log.total_carbs_g;
        fat += log.total_fat_g;
        items = [...items, ...(log.items_breakdown as FoodItem[])];
      });
      setDailyTotals({ calories: cals, protein: prot, carbs: carbs, fat: fat });
      setFoodItems(items);
    }

    // Fetch Today's Workout
    const { data: workoutData } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('logged_date', new Date().toISOString().split('T')[0])
      .order('created_at', { ascending: false })
      .limit(1);

    if (workoutData && workoutData.length > 0) {
      setWorkoutPlan(workoutData[0].plan_json as WorkoutPlan);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !verifiedScreen) {
        setSession(session);
        fetchUserData(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !verifiedScreen) {
        setSession(session);
        fetchUserData(session.user.id);
      } else if (!session) {
        setSession(null);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifiedScreen]);

  const saveDailyWeight = async () => {
    if (!todaysWeight || !session || !profile) return;
    const weightNum = parseFloat(todaysWeight);
    
    try {
      await supabase.from('weight_logs').insert({
        user_id: session.user.id,
        weight_kg: weightNum
      });
      
      await supabase.from('profiles').update({ current_weight_kg: weightNum }).eq('id', session.user.id);
      
      setProfile({ ...profile, current_weight_kg: weightNum });
      skipWeightPrompt();
      toast.success('Weight logged!');
    } catch (err) {
      // 2. Used the err variable by logging it
      console.error('Error saving weight:', err);
      toast.error('Failed to save weight.');
    }
  };

  const saveProfileSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!session || !profile) return;
    
    try {
      const { error } = await supabase.from('profiles').update({
        display_name: profile.display_name,
        height_cm: profile.height_cm,
        current_weight_kg: profile.current_weight_kg,
        target_weight_kg: profile.target_weight_kg,
        primary_goal: profile.primary_goal,
        target_date: profile.target_date,
        daily_target_calories: profile.daily_target_calories,
        daily_target_protein_g: profile.daily_target_protein_g
      }).eq('id', session.user.id);

      if (error) throw error;
      
      toast.success('Profile updated!');
      setShowOnboarding(false);
      setShowProfileSettings(false);
      
      if (showOnboarding) {
        skipWeightPrompt();
      }
    } catch (err) {
      // 3. Used the err variable by logging it
      console.error('Error saving profile:', err);
      toast.error('Error saving profile');
    }
  };

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
        toast.success('Check your email for the confirmation link!', { duration: 5000 });
        setEmail('');
        setPassword('');
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

  const handleProcessLog = async () => {
    if (!inputLog.trim() || !session || !profile) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('process-ai-log', {
        body: { 
          prompt: inputLog, 
          type: activeTab,
          context: { 
            goal: profile.primary_goal, 
            targetCalories: profile.daily_target_calories,
            weight: profile.current_weight_kg
          } 
        }
      });

      if (error) throw error;

      if (activeTab === 'food') {
        const { items, totals } = data;
        await supabase.from('nutrition_logs').insert({
          user_id: session.user.id,
          raw_input: inputLog,
          total_calories: totals.total_calories,
          total_protein_g: totals.total_protein,
          total_carbs_g: totals.total_carbs,
          total_fat_g: totals.total_fat,
          items_breakdown: items
        });
        
        setDailyTotals(prev => ({
          calories: prev.calories + totals.total_calories,
          protein: prev.protein + totals.total_protein,
          carbs: prev.carbs + totals.total_carbs,
          fat: prev.fat + totals.total_fat,
        }));
        setFoodItems(prev => [...prev, ...(items as FoodItem[])]);
        toast.success('Meal tracked!');
      } else {
        await supabase.from('workout_logs').insert({
          user_id: session.user.id,
          target_muscle_group: 'Custom AI Routine',
          readiness_score: readiness,
          plan_json: data
        });
        setWorkoutPlan(data as WorkoutPlan);
        toast.success('Workout generated!');
      }

      setInputLog('');
    } catch (err: unknown) {
      toast.error('AI Error. Check connection.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- POST-VERIFICATION SCREEN ---
  if (verifiedScreen) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 bg-slate-900 text-center">
        <CheckCircle2 size={64} className="text-emerald-500 mb-6" />
        <h2 className="text-3xl font-bold text-white mb-2">Account Verified!</h2>
        <p className="text-slate-400 mb-8">Your email has been successfully confirmed. You can now log in to set up your profile.</p>
        <button 
          onClick={() => setVerifiedScreen(false)}
          className="w-full max-w-sm rounded-xl bg-blue-600 p-4 font-bold text-white hover:bg-blue-500 transition"
        >
          Go to Sign In
        </button>
      </div>
    );
  }

  // --- LOGIN SCREEN ---
  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 bg-slate-900">
        <Toaster position="top-center" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} />
        <form onSubmit={handleAuth} className="w-full max-w-sm rounded-xl bg-slate-800 p-6 shadow-lg border border-slate-700">
          <h2 className="mb-6 text-center text-2xl font-bold text-white">
            {isLoginView ? 'Welcome Back' : 'Create Account'}
          </h2>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="mb-4 w-full rounded-lg bg-slate-700 p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <input
            type="password"
            placeholder="Password (min 6 chars)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="mb-6 w-full rounded-lg bg-slate-700 p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <button 
            type="submit" 
            disabled={authLoading}
            className="w-full rounded-lg bg-blue-600 p-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition"
          >
            {authLoading ? <Loader2 className="mx-auto animate-spin" size={24} /> : (isLoginView ? 'Sign In' : 'Sign Up')}
          </button>
          
          <p className="mt-4 text-center text-sm text-slate-400">
            {isLoginView ? "Don't have an account? " : "Already have an account? "}
            <button 
              type="button" 
              onClick={() => setIsLoginView(!isLoginView)}
              className="text-blue-400 hover:underline"
            >
              {isLoginView ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </form>
      </div>
    );
  }

  // --- ONBOARDING & PROFILE SETTINGS MODAL ---
  if (showOnboarding || showProfileSettings) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900 px-4 py-8">
        <Toaster position="top-center" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} />
        <div className="mx-auto max-w-md bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">{showOnboarding ? 'Complete Profile' : 'Profile Settings'}</h2>
            {!showOnboarding && (
              <button onClick={() => setShowProfileSettings(false)} className="text-slate-400 hover:text-white"><X /></button>
            )}
          </div>
          
          {profile && (
            <form onSubmit={saveProfileSettings} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-bold uppercase">Name</label>
                <input type="text" required value={profile.display_name || ''} onChange={e => setProfile({...profile, display_name: e.target.value})} className="w-full mt-1 p-3 rounded-lg bg-slate-700 text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-bold uppercase">Height (cm)</label>
                  <input type="number" required value={profile.height_cm || ''} onChange={e => setProfile({...profile, height_cm: Number(e.target.value)})} className="w-full mt-1 p-3 rounded-lg bg-slate-700 text-white" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold uppercase">Current Wt (kg)</label>
                  <input type="number" step="0.1" required value={profile.current_weight_kg || ''} onChange={e => setProfile({...profile, current_weight_kg: Number(e.target.value)})} className="w-full mt-1 p-3 rounded-lg bg-slate-700 text-white" />
                </div>
              </div>
              
              <hr className="border-slate-700 my-4" />
              
              <div>
                <label className="text-xs text-slate-400 font-bold uppercase">Primary Goal</label>
                <select value={profile.primary_goal || 'Fat Loss'} onChange={e => setProfile({...profile, primary_goal: e.target.value})} className="w-full mt-1 p-3 rounded-lg bg-slate-700 text-white appearance-none">
                  <option>Fat Loss</option>
                  <option>Hypertrophy (Muscle Gain)</option>
                  <option>Maintenance</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-bold uppercase">Target Wt (kg)</label>
                  <input type="number" step="0.1" required value={profile.target_weight_kg || ''} onChange={e => setProfile({...profile, target_weight_kg: Number(e.target.value)})} className="w-full mt-1 p-3 rounded-lg bg-slate-700 text-white" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold uppercase">Target Date</label>
                  <input type="date" required value={profile.target_date || ''} onChange={e => setProfile({...profile, target_date: e.target.value})} className="w-full mt-1 p-3 rounded-lg bg-slate-700 text-white" />
                </div>
              </div>

              <hr className="border-slate-700 my-4" />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-bold uppercase">Daily Calories</label>
                  <input type="number" required value={profile.daily_target_calories || 2000} onChange={e => setProfile({...profile, daily_target_calories: Number(e.target.value)})} className="w-full mt-1 p-3 rounded-lg bg-slate-700 text-white font-bold text-amber-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold uppercase">Daily Protein (g)</label>
                  <input type="number" required value={profile.daily_target_protein_g || 150} onChange={e => setProfile({...profile, daily_target_protein_g: Number(e.target.value)})} className="w-full mt-1 p-3 rounded-lg bg-slate-700 text-white font-bold text-blue-500" />
                </div>
              </div>

              <button type="submit" className="w-full mt-6 rounded-lg bg-emerald-600 p-4 font-bold text-white hover:bg-emerald-500">
                Save & Continue
              </button>
              
              {!showOnboarding && (
                <button type="button" onClick={() => supabase.auth.signOut()} className="w-full mt-4 flex items-center justify-center gap-2 rounded-lg border border-red-900/50 bg-red-950/30 p-3 font-medium text-red-500 hover:bg-red-900/50">
                  <LogOut size={18} /> Sign Out
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    );
  }

  const calPercent = profile?.daily_target_calories ? Math.min(100, Math.round((dailyTotals.calories / profile.daily_target_calories) * 100)) : 0;
  const proPercent = profile?.daily_target_protein_g ? Math.min(100, Math.round((dailyTotals.protein / profile.daily_target_protein_g) * 100)) : 0;

  // --- MAIN APP DASHBOARD ---
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col pb-24 bg-slate-900 text-slate-100 relative">
      <Toaster position="top-center" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} />
      
      {showWeightPrompt && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/90 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-500/20 rounded-full"><Scale className="text-blue-500" size={24} /></div>
              <h3 className="text-xl font-bold">Today's Weight</h3>
            </div>
            <p className="text-sm text-slate-400 mb-6">Tracking daily helps the AI map your trajectory toward your {profile?.target_weight_kg}kg goal.</p>
            <input 
              type="number" 
              step="0.1" 
              placeholder="e.g. 75.5" 
              value={todaysWeight}
              onChange={e => setTodaysWeight(e.target.value)}
              className="w-full text-center text-3xl font-bold bg-slate-700 p-4 rounded-xl mb-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button onClick={skipWeightPrompt} className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 font-medium hover:bg-slate-600 transition">Skip Today</button>
              <button onClick={saveDailyWeight} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition">Save</button>
            </div>
          </div>
        </div>
      )}

      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-4 sticky top-0 bg-slate-900/90 backdrop-blur z-10">
        <div>
          <h1 className="text-xl font-black tracking-wider bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">AI FIT PWA</h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">{profile?.primary_goal}</p>
        </div>
        <button onClick={() => setShowProfileSettings(true)} className="p-2 bg-slate-800 rounded-full text-slate-300 hover:bg-slate-700 transition">
          <User size={20} />
        </button>
      </header>

      <main className="flex-1 px-4 py-4">
        <div className="mb-6 flex rounded-xl bg-slate-800 p-1 border border-slate-700">
          <button
            onClick={() => setActiveTab('food')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition ${activeTab === 'food' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Utensils size={18} /> Diet Progress
          </button>
          <button
            onClick={() => setActiveTab('workout')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition ${activeTab === 'workout' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Dumbbell size={18} /> AI Gym
          </button>
        </div>

        {activeTab === 'food' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-800 p-4 border border-slate-700 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs font-bold text-slate-400 tracking-wider">CALORIES</span>
                  <span className="text-xl font-black text-amber-500">{dailyTotals.calories} <span className="text-xs text-slate-500 font-medium">/ {profile?.daily_target_calories}</span></span>
                </div>
                <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                  <div className={`h-full ${calPercent > 100 ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${calPercent}%` }}></div>
                </div>
              </div>

              <div className="rounded-xl bg-slate-800 p-4 border border-slate-700 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs font-bold text-slate-400 tracking-wider">PROTEIN</span>
                  <span className="text-xl font-black text-blue-500">{dailyTotals.protein}g <span className="text-xs text-slate-500 font-medium">/ {profile?.daily_target_protein_g}g</span></span>
                </div>
                <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${proPercent}%` }}></div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
               <div className="rounded-xl bg-slate-800/50 p-3 border border-slate-700/50 text-center">
                  <span className="block text-[10px] font-bold text-slate-500 tracking-wider">CARBS LOGGED</span>
                  <span className="text-lg font-bold text-emerald-400">{dailyTotals.carbs}g</span>
               </div>
               <div className="rounded-xl bg-slate-800/50 p-3 border border-slate-700/50 text-center">
                  <span className="block text-[10px] font-bold text-slate-500 tracking-wider">FAT LOGGED</span>
                  <span className="text-lg font-bold text-red-400">{dailyTotals.fat}g</span>
               </div>
            </div>

            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-800 pb-2">Today's Timeline</h3>
              {foodItems.length === 0 ? (
                <div className="text-center rounded-xl border border-dashed border-slate-700 p-8 text-slate-500 text-sm">
                  Nothing tracked yet. Describe your meal below!
                </div>
              ) : (
                foodItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center rounded-xl bg-slate-800 p-4 text-sm border border-slate-700/50 shadow-sm">
                    <div>
                      <p className="font-bold text-slate-100">{item.name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{item.portion}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-amber-400">{item.calories} kcal</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-1 bg-slate-900 px-2 py-0.5 rounded">P:{item.protein_g} C:{item.carbs_g} F:{item.fat_g}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'workout' && (
          <div className="space-y-6">
            {!workoutPlan ? (
              <div className="rounded-xl bg-slate-800 p-5 space-y-3 border border-slate-700 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Target size={16} className="text-emerald-500" />
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">AI Readiness Context</label>
                </div>
                <input 
                  type="text" 
                  value={readiness} 
                  onChange={e => setReadiness(e.target.value)}
                  placeholder="e.g., Sore hamstrings, short on time (30m)"
                  className="w-full rounded-lg bg-slate-900 p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 border border-slate-700"
                />
                <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
                  The AI knows your goal is <strong>{profile?.primary_goal}</strong>. Describe the specific muscles you want to hit today in the input bar below.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                  <h3 className="font-bold text-base text-blue-400 leading-tight pr-4">{workoutPlan.routine_title}</h3>
                  <span className="text-[10px] uppercase font-bold tracking-wider bg-blue-900/30 text-blue-400 px-2.5 py-1 rounded-full border border-blue-800/50 whitespace-nowrap">
                    ⏱ {workoutPlan.estimated_minutes} min
                  </span>
                </div>
                {workoutPlan.exercises.map((ex: Exercise, idx: number) => (
                  <div key={idx} className="rounded-xl bg-slate-800 p-4 space-y-1 border border-slate-700/50 shadow-sm">
                    <div className="flex justify-between items-start font-bold text-sm text-white mb-2">
                      <span className="pr-4">{idx + 1}. {ex.name}</span>
                      <span className="text-emerald-400 bg-emerald-950/50 px-2 py-1 rounded text-xs border border-emerald-800/50 whitespace-nowrap">
                        {ex.sets} sets × {ex.reps}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-700/50">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Target RPE: <span className="text-white bg-slate-700 px-1.5 py-0.5 rounded ml-1">{ex.rpe}/10</span></span>
                      {ex.notes && <span className="text-[11px] italic text-slate-400 border-l-2 border-slate-600 pl-2 mt-1">{ex.notes}</span>}
                    </div>
                  </div>
                ))}
                <button 
                  onClick={() => setWorkoutPlan(null)} 
                  className="w-full py-3 mt-4 rounded-xl bg-slate-800 text-center text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white border border-slate-700 transition"
                >
                  Generate Alternative Routine
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 mx-auto max-w-md border-t border-slate-800 bg-slate-900/95 p-3 backdrop-blur-md z-20">
        <div className="flex items-end gap-2">
          <textarea
            rows={2}
            value={inputLog}
            onChange={e => setInputLog(e.target.value)}
            placeholder={activeTab === 'food' ? "Log a meal (e.g. 200g cooked rice, 1 chicken breast)..." : "Request workout (e.g. Heavy pull day, 45 mins)..."}
            className="flex-1 resize-none rounded-xl bg-slate-800 p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 border border-slate-700 placeholder:text-slate-500"
          />
          <button
            onClick={handleProcessLog}
            disabled={loading || !inputLog.trim()}
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-500 disabled:opacity-50 shadow-lg"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}