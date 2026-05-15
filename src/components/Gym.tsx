import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Target, Send, Loader2, CheckCircle, History, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import type { TabProps, WorkoutPlan, Exercise } from '../types';

const getLocalDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export default function Gym({ session, profile }: TabProps) {
  const [readiness, setReadiness] = useState('Feeling good, standard energy');
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [inputLog, setInputLog] = useState('');
  const [loading, setLoading] = useState(false);
  const [previousWorkouts, setPreviousWorkouts] = useState<WorkoutPlan[]>([]);

  useEffect(() => {
    let isMounted = true;

    const fetchGymData = async () => {
      const today = getLocalDate();

      const { data: todayData } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('logged_date', today)
        .order('created_at', { ascending: false })
        .limit(1);

      if (todayData && todayData.length > 0 && isMounted) {
        setWorkoutPlan(todayData[0].plan_json as WorkoutPlan);
        setIsCompleted(todayData[0].is_completed);
      }

      const { data: historyData } = await supabase
        .from('workout_logs')
        .select('plan_json')
        .eq('user_id', session.user.id)
        .neq('logged_date', today)
        .order('created_at', { ascending: false })
        .limit(20);

      if (historyData && isMounted) {
        const uniquePlans: WorkoutPlan[] = [];
        const titles = new Set();
        historyData.forEach(item => {
          const plan = item.plan_json as WorkoutPlan;
          if (plan && plan.routine_title && !titles.has(plan.routine_title)) {
            titles.add(plan.routine_title);
            uniquePlans.push(plan);
          }
        });
        setPreviousWorkouts(uniquePlans.slice(0, 5)); 
      }
    };

    fetchGymData();

    return () => { isMounted = false; };
  }, [session.user.id]);

  const handleGenerateWorkout = async () => {
    if (!inputLog.trim()) return;
    setLoading(true);

    try {
      const today = getLocalDate();
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
        plan_json: data,
        is_completed: false,
        logged_date: today
      });

      setWorkoutPlan(data as WorkoutPlan);
      setIsCompleted(false);
      setInputLog('');
      toast.success('Workout generated!');
    } catch (err: unknown) {
      console.error('Workout Gen Error:', err);
      toast.error('Failed to generate workout.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadPrevious = async (plan: WorkoutPlan) => {
    setLoading(true);
    try {
      const today = getLocalDate();
      await supabase.from('workout_logs').insert({
        user_id: session.user.id,
        target_muscle_group: 'Loaded from history',
        readiness_score: readiness,
        plan_json: plan,
        is_completed: false,
        logged_date: today
      });
      setWorkoutPlan(plan);
      setIsCompleted(false);
      toast.success('Restored previous routine!');
    } catch (err) {
      console.error(err);
      toast.error('Could not load routine.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkCompleted = async () => {
    if (!workoutPlan) return;
    setLoading(true);

    try {
      const today = getLocalDate();
      
      await supabase.from('workout_logs')
        .update({ is_completed: true })
        .eq('user_id', session.user.id)
        .eq('logged_date', today);

      const burnEstimate = workoutPlan.estimated_calories_burned || 300; 
      
      await supabase.from('activity_logs').insert({
        user_id: session.user.id,
        raw_input: `Completed Gym Routine: ${workoutPlan.routine_title}`,
        total_calories_burned: burnEstimate,
        activities_breakdown: [{
          name: workoutPlan.routine_title,
          duration: `${workoutPlan.estimated_minutes} mins`,
          calories_burned: burnEstimate
        }],
        logged_date: today
      });

      setIsCompleted(true);
      toast.success(`Completed! ${burnEstimate} kcal added to Activity.`);
    } catch (err) {
      console.error(err);
      toast.error('Error marking completed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-32 animate-in fade-in space-y-6">
      {!workoutPlan ? (
        <div className="space-y-6">
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

          {previousWorkouts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-400">
                <History size={16} />
                <h3 className="text-xs font-bold uppercase tracking-wider">Quick Load Previous</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {previousWorkouts.map((plan, idx) => (
                  <button 
                    key={idx}
                    onClick={() => handleLoadPrevious(plan)}
                    disabled={loading}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 px-3 py-2 rounded-lg transition disabled:opacity-50"
                  >
                    <RefreshCw size={12} className="text-blue-400" />
                    {plan.routine_title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-start border-b border-slate-700 pb-3">
            <div>
              <h3 className="font-bold text-base text-blue-400 leading-tight">{workoutPlan.routine_title}</h3>
              <p className="text-xs text-slate-500 mt-1">Est. Burn: {workoutPlan.estimated_calories_burned || 300} kcal</p>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider bg-blue-900/30 text-blue-400 px-2.5 py-1 rounded-full border border-blue-800/50 whitespace-nowrap">
              ⏱ {workoutPlan.estimated_minutes} min
            </span>
          </div>

          {workoutPlan.exercises.map((ex: Exercise, idx: number) => (
            <div key={idx} className={`rounded-xl p-4 space-y-1 border shadow-sm transition-colors ${isCompleted ? 'bg-slate-800/50 border-slate-700/30 opacity-70' : 'bg-slate-800 border-slate-700/50'}`}>
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

          <div className="pt-4 space-y-3">
            {isCompleted ? (
              <div className="w-full flex justify-center items-center gap-2 py-3.5 rounded-xl bg-emerald-900/20 border border-emerald-800/50 text-emerald-400 font-bold uppercase tracking-wider text-xs">
                <CheckCircle size={18} /> Workout Logged to Activity
              </div>
            ) : (
              <button 
                onClick={handleMarkCompleted}
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-emerald-600 text-center text-sm font-bold text-white hover:bg-emerald-500 transition shadow-lg shadow-emerald-900/20 disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                Mark as Completed (+{workoutPlan.estimated_calories_burned || 300} kcal)
              </button>
            )}

            <button 
              onClick={() => { setWorkoutPlan(null); setIsCompleted(false); }} 
              className="w-full py-3 rounded-xl bg-slate-800 text-center text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white border border-slate-700 transition"
            >
              Clear & Generate New
            </button>
          </div>
        </div>
      )}

      {!workoutPlan && (
        <div className="fixed bottom-[72px] left-0 right-0 mx-auto max-w-md bg-gradient-to-t from-slate-900 via-slate-900 to-transparent p-4 pb-2 z-20">
          <div className="flex items-end gap-2">
            <textarea rows={2} value={inputLog} onChange={e => setInputLog(e.target.value)} placeholder="Request new AI workout (e.g. Heavy pull day, 45 mins)..." className="flex-1 resize-none rounded-xl bg-slate-800 p-3 text-sm text-white focus:outline-none border border-slate-700 shadow-xl" />
            <button onClick={handleGenerateWorkout} disabled={loading || !inputLog.trim()} className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white disabled:opacity-50 transition hover:bg-blue-500 shadow-lg"><Loader2 className={loading ? 'animate-spin' : 'hidden'} size={20} /><Send className={loading ? 'hidden' : 'block'} size={20} /></button>
          </div>
        </div>
      )}
    </div>
  );
}