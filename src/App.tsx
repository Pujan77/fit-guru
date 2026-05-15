import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import type { Session } from '@supabase/supabase-js';
import { Utensils, Dumbbell, Send, Loader2, LogOut } from 'lucide-react';

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

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [inputLog, setInputLog] = useState('');
  const [activeTab, setActiveTab] = useState<'food' | 'workout'>('food');
  const [dailyTotals, setDailyTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [readiness, setReadiness] = useState('Feeling good, standard energy');

  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginView, setIsLoginView] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  // 1. Moved fetchData ABOVE useEffect so it is initialized before being called
  const fetchData = async (userId: string) => {
    // Fetch Today's Nutrition
    const { data: foodData } = await supabase
      .from('nutrition_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('logged_date', new Date().toISOString().split('T')[0]);

    if (foodData && foodData.length > 0) {
      let cals = 0, prot = 0, carbs = 0, fat = 0;
      // 2. Replaced any[] with FoodItem[]
      let items: FoodItem[] = []; 
      
      foodData.forEach(log => {
        cals += log.total_calories;
        prot += log.total_protein_g;
        carbs += log.total_carbs_g;
        fat += log.total_fat_g;
        // Cast the JSONB database column to our explicit TypeScript interface
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
      // Cast the JSONB database column to WorkoutPlan
      setWorkoutPlan(workoutData[0].plan_json as WorkoutPlan);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchData(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchData(session.user.id);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Keeping empty dependency array to only run on mount

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    
    try {
      if (isLoginView) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Check your email for the confirmation link!');
      }
    } catch (error: unknown) { // 3. Replaced any with unknown for strict catching
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert('An unexpected error occurred during authentication.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleProcessLog = async () => {
    if (!inputLog.trim() || !session) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('process-ai-log', {
        body: { 
          prompt: inputLog, 
          type: activeTab,
          context: { goal: 'Hypertrophy', targetCalories: 2500 } 
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
        
      } else {
        await supabase.from('workout_logs').insert({
          user_id: session.user.id,
          target_muscle_group: 'Custom AI Routine',
          readiness_score: readiness,
          plan_json: data
        });
        setWorkoutPlan(data as WorkoutPlan);
      }

      setInputLog('');
    } catch (err: unknown) { // 4. Replaced any with unknown
      const errorMessage = err instanceof Error ? err.message : 'Check console';
      alert(`Error processing log: ${errorMessage}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- LOGIN SCREEN ---
  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 bg-slate-900">
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
            {authLoading ? 'Processing...' : (isLoginView ? 'Sign In' : 'Sign Up')}
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

  // --- MAIN APP SCREEN ---
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col pb-24 bg-slate-900 text-slate-100">
      {/* Top Bar */}
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-4 sticky top-0 bg-slate-900/90 backdrop-blur z-10">
        <h1 className="text-xl font-bold tracking-wider text-blue-500">AI FIT PWA</h1>
        <button onClick={() => supabase.auth.signOut()} className="text-slate-400 hover:text-white p-2">
          <LogOut size={20} />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-4 py-4">
        {/* Navigation Toggle */}
        <div className="mb-6 flex rounded-xl bg-slate-800 p-1 border border-slate-700">
          <button
            onClick={() => setActiveTab('food')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${activeTab === 'food' ? 'bg-blue-600 text-white shadow' : 'text-slate-400'}`}
          >
            <Utensils size={18} /> Diet
          </button>
          <button
            onClick={() => setActiveTab('workout')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${activeTab === 'workout' ? 'bg-blue-600 text-white shadow' : 'text-slate-400'}`}
          >
            <Dumbbell size={18} /> Gym
          </button>
        </div>

        {/* View 1: Diet Dashboard */}
        {activeTab === 'food' && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-xl bg-slate-800 p-3 border-t-2 border-amber-500 shadow-sm">
                <span className="block text-[10px] font-bold text-slate-400 tracking-wider">CALS</span>
                <span className="text-base font-extrabold">{dailyTotals.calories}</span>
              </div>
              <div className="rounded-xl bg-slate-800 p-3 border-t-2 border-blue-500 shadow-sm">
                <span className="block text-[10px] font-bold text-slate-400 tracking-wider">PRO</span>
                <span className="text-base font-extrabold">{dailyTotals.protein}g</span>
              </div>
              <div className="rounded-xl bg-slate-800 p-3 border-t-2 border-emerald-500 shadow-sm">
                <span className="block text-[10px] font-bold text-slate-400 tracking-wider">CARBS</span>
                <span className="text-base font-extrabold">{dailyTotals.carbs}g</span>
              </div>
              <div className="rounded-xl bg-slate-800 p-3 border-t-2 border-red-500 shadow-sm">
                <span className="block text-[10px] font-bold text-slate-400 tracking-wider">FAT</span>
                <span className="text-base font-extrabold">{dailyTotals.fat}g</span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Today's Intake</h3>
              {foodItems.length === 0 ? (
                <div className="text-center rounded-xl border border-dashed border-slate-700 p-8 text-slate-500 text-sm">
                  No food logged yet. Type what you ate below!
                </div>
              ) : (
                foodItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between rounded-xl bg-slate-800 p-3 text-sm border border-slate-700/50">
                    <div>
                      <p className="font-semibold text-slate-100">{item.name}</p>
                      <p className="text-xs text-slate-400">{item.portion}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-amber-400">{item.calories} kcal</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-1">P:{item.protein_g} C:{item.carbs_g} F:{item.fat_g}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* View 2: Workout Dashboard */}
        {activeTab === 'workout' && (
          <div className="space-y-6">
            {!workoutPlan ? (
              <div className="rounded-xl bg-slate-800 p-4 space-y-3 border border-slate-700">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Readiness Check</label>
                <input 
                  type="text" 
                  value={readiness} 
                  onChange={e => setReadiness(e.target.value)}
                  placeholder="e.g., Sore hamstrings, short on time (30m)"
                  className="w-full rounded-lg bg-slate-700 p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-500">Describe what you want to hit today in the main input bar below to generate the routine.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                  <h3 className="font-bold text-base text-blue-400">{workoutPlan.routine_title}</h3>
                  <span className="text-xs bg-slate-800 px-2 py-1 rounded-full text-slate-400 border border-slate-700">{workoutPlan.estimated_minutes} mins</span>
                </div>
                {/* 5. Replaced any in map loop with Exercise interface */}
                {workoutPlan.exercises.map((ex: Exercise, idx: number) => (
                  <div key={idx} className="rounded-xl bg-slate-800 p-3.5 space-y-1 border border-slate-700/50">
                    <div className="flex justify-between font-bold text-sm text-white">
                      <span>{idx + 1}. {ex.name}</span>
                      <span className="text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded text-xs border border-emerald-800/50">{ex.sets} sets x {ex.reps}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                      <span className="font-mono bg-slate-900 px-1.5 py-0.5 rounded">RPE: {ex.rpe}/10</span>
                      {ex.notes && <span className="italic">{ex.notes}</span>}
                    </div>
                  </div>
                ))}
                <button 
                  onClick={() => setWorkoutPlan(null)} 
                  className="w-full py-2.5 mt-2 rounded-lg bg-slate-800 text-center text-xs text-slate-400 hover:text-white border border-slate-700"
                >
                  Reset / Generate New Routine
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Single-Input Dock */}
      <div className="fixed bottom-0 left-0 right-0 mx-auto max-w-md border-t border-slate-800 bg-slate-900/90 p-3 backdrop-blur-md z-20">
        <div className="flex items-end gap-2">
          <textarea
            rows={2}
            value={inputLog}
            onChange={e => setInputLog(e.target.value)}
            placeholder={activeTab === 'food' ? "Log food (e.g., 200g cooked rice, 2 eggs in butter)..." : "Request workout (e.g., Heavy pull day focusing on lats)..."}
            className="flex-1 resize-none rounded-xl bg-slate-800 p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 border border-slate-700"
          />
          <button
            onClick={handleProcessLog}
            disabled={loading || !inputLog.trim()}
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}