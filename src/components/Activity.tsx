import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Send, Loader2, Flame, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { TabProps, ActivityItem } from '../types';

// STRICT TYPING: Tell TypeScript exactly what an Activity DB row looks like
interface ActivityLog {
  id: string;
  total_calories_burned: number;
  activities_breakdown: ActivityItem[];
}

const getLocalDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export default function Activity({ session, profile }: TabProps) {
  const [inputLog, setInputLog] = useState('');
  const [loading, setLoading] = useState(false);
  const [totalBurned, setTotalBurned] = useState(0);
  
  // NO MORE 'any' - using the strict ActivityLog interface
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    let isMounted = true;

    const fetchActivities = async () => {
      const today = getLocalDate();
      const { data } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('logged_date', today)
        .order('created_at', { ascending: true });

      if (data && isMounted) {
        let burned = 0; 
        data.forEach(log => { burned += log.total_calories_burned; });
        setTotalBurned(burned); 
        setLogs(data as ActivityLog[]);
      }
    };

    fetchActivities();
    return () => { isMounted = false; };
  }, [session.user.id]);

  const handleProcessLog = async () => {
    if (!inputLog.trim()) return;
    setLoading(true);
    
    try {
      const today = getLocalDate();
      const { data, error } = await supabase.functions.invoke('process-ai-log', {
        body: { prompt: inputLog, type: 'activity', context: { weight: profile.current_weight_kg } }
      });
      if (error) throw error;
      
      const newLog = { 
        user_id: session.user.id, 
        raw_input: inputLog, 
        total_calories_burned: data.total_calories_burned, 
        activities_breakdown: data.activities,
        logged_date: today
      };

      const { data: insertedData, error: insertError } = await supabase.from('activity_logs').insert(newLog).select().single();
      if (insertError) throw insertError;

      setTotalBurned(prev => prev + data.total_calories_burned); 
      setLogs(prev => [...prev, insertedData as ActivityLog]);
      setInputLog(''); 
      toast.success('Activity logged!');
    } catch (err: unknown) { 
      console.error('Activity Parse Error:', err);
      toast.error('Failed to log activity.'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleDeleteLog = async (logId: string, caloriesBurned: number) => {
    try {
      const { error } = await supabase.from('activity_logs').delete().eq('id', logId);
      if (error) throw error;

      setLogs(prev => prev.filter(log => log.id !== logId));
      setTotalBurned(prev => Math.max(0, prev - caloriesBurned));
      toast.success('Entry removed');
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete entry');
    }
  };

  const burnPercent = profile.daily_target_burn_calories ? Math.min(100, Math.round((totalBurned / profile.daily_target_burn_calories) * 100)) : 0;

  return (
    <div className="pb-24 animate-in fade-in">
      <div className="rounded-xl bg-slate-800 p-6 border border-slate-700 shadow-sm text-center mb-6 relative overflow-hidden">
        <Flame className="mx-auto mb-2 text-orange-500" size={32} />
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Active Calories Burned</h3>
        <p className="text-4xl font-black text-white mt-1">{totalBurned} <span className="text-sm text-slate-500 font-medium">/ {profile.daily_target_burn_calories || 0} kcal</span></p>
        <div className="w-full bg-slate-900 h-2 rounded-full mt-4 overflow-hidden"><div className="h-full bg-orange-500" style={{ width: `${burnPercent}%` }}></div></div>
      </div>

      <div className="space-y-3">
        {logs.map((log) => (
          <div key={log.id} className="relative rounded-xl bg-slate-800 p-4 border border-slate-700/50 group">
            <button 
                onClick={() => handleDeleteLog(log.id, log.total_calories_burned)}
                className="absolute top-2 right-2 p-1.5 text-slate-500 hover:text-red-500 bg-slate-900 rounded-lg border border-slate-700 opacity-80 transition"
                title="Delete Entry"
              >
                <Trash2 size={16} />
            </button>
            {log.activities_breakdown.map((item: ActivityItem, idx: number) => (
              <div key={idx} className="flex justify-between items-center mt-2 first:mt-0 pr-8">
                <div><p className="font-bold text-slate-100">{item.name}</p><p className="text-xs text-slate-400">{item.duration}</p></div>
                <p className="font-bold text-orange-400">{item.calories_burned} kcal</p>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="fixed bottom-[72px] left-0 right-0 mx-auto max-w-md bg-gradient-to-t from-slate-900 via-slate-900 to-transparent p-4 pb-2 z-20">
        <div className="flex items-end gap-2">
          <textarea rows={2} value={inputLog} onChange={e => setInputLog(e.target.value)} placeholder="Log activity (e.g. Played tennis for 45 mins)..." className="flex-1 resize-none rounded-xl bg-slate-800 p-3 text-sm text-white focus:outline-none border border-slate-700 shadow-xl" />
          <button onClick={handleProcessLog} disabled={loading || !inputLog.trim()} className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-orange-600 text-white disabled:opacity-50"><Loader2 className={loading ? 'animate-spin' : 'hidden'} size={20} /><Send className={loading ? 'hidden' : 'block'} size={20} /></button>
        </div>
      </div>
    </div>
  );
}