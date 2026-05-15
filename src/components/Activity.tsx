import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Send, Loader2, Flame } from 'lucide-react';
import toast from 'react-hot-toast';
import type { TabProps, ActivityItem } from '../types';

export default function Activity({ session, profile }: TabProps) {
  const [inputLog, setInputLog] = useState('');
  const [loading, setLoading] = useState(false);
  const [totalBurned, setTotalBurned] = useState(0);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  // FIXED: Moved the fetch function inside useEffect with an isMounted check
  useEffect(() => {
    let isMounted = true;

    const fetchActivities = async () => {
      const { data } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('logged_date', new Date().toISOString().split('T')[0]);

      if (data && data.length > 0 && isMounted) {
        let burned = 0; 
        let items: ActivityItem[] = [];
        data.forEach(log => { 
          burned += log.total_calories_burned; 
          items = [...items, ...(log.activities_breakdown as ActivityItem[])]; 
        });
        setTotalBurned(burned); 
        setActivities(items);
      }
    };

    fetchActivities();

    return () => {
      isMounted = false;
    };
  }, [session.user.id]);

  const handleProcessLog = async () => {
    if (!inputLog.trim()) return;
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('process-ai-log', {
        body: { prompt: inputLog, type: 'activity', context: { weight: profile.current_weight_kg } }
      });
      
      if (error) throw error;
      
      await supabase.from('activity_logs').insert({ 
        user_id: session.user.id, 
        raw_input: inputLog, 
        total_calories_burned: data.total_calories_burned, 
        activities_breakdown: data.activities 
      });
      
      setTotalBurned(prev => prev + data.total_calories_burned); 
      setActivities(prev => [...prev, ...(data.activities as ActivityItem[])]);
      setInputLog(''); 
      toast.success('Activity logged!');
    } catch (err: unknown) { 
      console.error('Activity Parse Error:', err);
      toast.error('Failed to log activity.'); 
    } finally { 
      setLoading(false); 
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
        {activities.map((item, idx) => (
          <div key={idx} className="flex justify-between items-center rounded-xl bg-slate-800 p-4 border border-slate-700/50">
            <div><p className="font-bold text-slate-100">{item.name}</p><p className="text-xs text-slate-400">{item.duration}</p></div>
            <p className="font-bold text-orange-400">{item.calories_burned} kcal</p>
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