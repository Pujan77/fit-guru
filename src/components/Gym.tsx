import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Target, Send, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { TabProps, WorkoutPlan, Exercise } from '../types';

export default function Gym({ session, profile }: TabProps) {
  const [readiness, setReadiness] = useState('Feeling good, standard energy');
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [inputLog, setInputLog] = useState('');
  const [loading, setLoading] = useState(false);

  // FIXED: Moved the fetch function inside useEffect with an isMounted check
  useEffect(() => {
    let isMounted = true;

    const fetchWorkout = async () => {
      const { data } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('logged_date', new Date().toISOString().split('T')[0])
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0 && isMounted) {
        setWorkoutPlan(data[0].plan_json as WorkoutPlan);
      }
    };

    fetchWorkout();

    return () => {
      isMounted = false; // Cleanup function to prevent state updates on unmounted components
    };
  }, [session.user.id]);

  const handleGenerateWorkout = async () => {
    if (!inputLog.trim()) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('process-ai-log', {
        body: { 
          prompt: inputLog, 
          type: 'workout',
          context: { goal: profile.primary_goal, readiness: readiness }
        }
      });

      if (error) throw error;

      await supabase.from('workout_logs').insert({
        user_id: session.user.id,
        target_muscle_group: inputLog,
        readiness_score: readiness,
        plan_json: data
      });

      setWorkoutPlan(data as WorkoutPlan);
      setInputLog('');
      toast.success('Workout generated!');
    } catch (err: unknown) {
      console.error('Workout Gen Error:', err);
      toast.error('Failed to generate workout.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-24 animate-in fade-in space-y-6">
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
            The AI knows your goal is <strong>{profile.primary_goal}</strong>. Describe the specific muscles you want to hit today in the input bar below.
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

      {!workoutPlan && (
        <div className="fixed bottom-[72px] left-0 right-0 mx-auto max-w-md bg-gradient-to-t from-slate-900 via-slate-900 to-transparent p-4 pb-2 z-20">
          <div className="flex items-end gap-2">
            <textarea rows={2} value={inputLog} onChange={e => setInputLog(e.target.value)} placeholder="Request workout (e.g. Heavy pull day, 45 mins)..." className="flex-1 resize-none rounded-xl bg-slate-800 p-3 text-sm text-white focus:outline-none border border-slate-700 shadow-xl" />
            <button onClick={handleGenerateWorkout} disabled={loading || !inputLog.trim()} className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white disabled:opacity-50"><Loader2 className={loading ? 'animate-spin' : 'hidden'} size={20} /><Send className={loading ? 'hidden' : 'block'} size={20} /></button>
          </div>
        </div>
      )}
    </div>
  );
}