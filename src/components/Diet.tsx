import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Send, Loader2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { TabProps, FoodItem } from '../types';

// STRICT TYPING: Tell TypeScript exactly what a database row looks like
interface NutritionLog {
  id: string;
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  items_breakdown: FoodItem[];
}

const getLocalDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export default function Diet({ session, profile }: TabProps) {
  const [inputLog, setInputLog] = useState('');
  const [loading, setLoading] = useState(false);
  const [dailyTotals, setDailyTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  
  // NO MORE 'any' - using the strict NutritionLog interface
  const [logs, setLogs] = useState<NutritionLog[]>([]);

  useEffect(() => {
    let isMounted = true;

    const fetchDiet = async () => {
      const today = getLocalDate();
      const { data } = await supabase
        .from('nutrition_logs')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('logged_date', today)
        .order('created_at', { ascending: true });

      if (data && isMounted) {
        let cals = 0, prot = 0, carbs = 0, fat = 0;
        data.forEach(log => {
          cals += log.total_calories; 
          prot += log.total_protein_g; 
          carbs += log.total_carbs_g; 
          fat += log.total_fat_g;
        });
        setDailyTotals({ calories: cals, protein: prot, carbs: carbs, fat: fat });
        setLogs(data as NutritionLog[]);
      }
    };

    fetchDiet();
    return () => { isMounted = false; };
  }, [session.user.id]);

  const handleProcessLog = async () => {
    if (!inputLog.trim()) return;
    setLoading(true);
    
    try {
      const today = getLocalDate();
      const { data, error } = await supabase.functions.invoke('process-ai-log', {
        body: { prompt: inputLog, type: 'food' }
      });
      if (error) throw error;
      
      const newLog = {
        user_id: session.user.id, 
        raw_input: inputLog, 
        total_calories: data.totals.total_calories, 
        total_protein_g: data.totals.total_protein, 
        total_carbs_g: data.totals.total_carbs, 
        total_fat_g: data.totals.total_fat, 
        items_breakdown: data.items,
        logged_date: today 
      };

      const { data: insertedData, error: insertError } = await supabase.from('nutrition_logs').insert(newLog).select().single();
      if (insertError) throw insertError;
      
      setDailyTotals(prev => ({ 
        calories: prev.calories + data.totals.total_calories, 
        protein: prev.protein + data.totals.total_protein, 
        carbs: prev.carbs + data.totals.total_carbs, 
        fat: prev.fat + data.totals.total_fat 
      }));
      
      setLogs(prev => [...prev, insertedData as NutritionLog]);
      setInputLog('');
      toast.success('Meal tracked!');
    } catch (err: unknown) { 
      console.error('AI Error:', err);
      toast.error('Failed to parse diet log.'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleDeleteLog = async (logId: string, logCals: number, logProt: number, logCarbs: number, logFat: number) => {
    try {
      const { error } = await supabase.from('nutrition_logs').delete().eq('id', logId);
      if (error) throw error;

      setLogs(prev => prev.filter(log => log.id !== logId));
      setDailyTotals(prev => ({
        calories: Math.max(0, prev.calories - logCals),
        protein: Math.max(0, prev.protein - logProt),
        carbs: Math.max(0, prev.carbs - logCarbs),
        fat: Math.max(0, prev.fat - logFat),
      }));
      toast.success('Entry removed');
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete entry');
    }
  };

  const calPercent = profile.daily_target_calories ? Math.min(100, Math.round((dailyTotals.calories / profile.daily_target_calories) * 100)) : 0;
  const proPercent = profile.daily_target_protein_g ? Math.min(100, Math.round((dailyTotals.protein / profile.daily_target_protein_g) * 100)) : 0;
  const carbPercent = profile.daily_target_carbs_g ? Math.min(100, Math.round((dailyTotals.carbs / profile.daily_target_carbs_g) * 100)) : 0;
  const fatPercent = profile.daily_target_fat_g ? Math.min(100, Math.round((dailyTotals.fat / profile.daily_target_fat_g) * 100)) : 0;

  return (
    <div className="pb-24 animate-in fade-in">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-800 p-4 border border-slate-700 shadow-sm">
            <div className="flex justify-between items-end mb-2"><span className="text-xs font-bold text-slate-400">CALORIES</span><span className="text-xl font-black text-amber-500">{dailyTotals.calories} <span className="text-xs text-slate-500 font-medium">/ {profile.daily_target_calories}</span></span></div>
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden"><div className={`h-full ${calPercent > 100 ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${calPercent}%` }}></div></div>
          </div>
          <div className="rounded-xl bg-slate-800 p-4 border border-slate-700 shadow-sm">
            <div className="flex justify-between items-end mb-2"><span className="text-xs font-bold text-slate-400">PROTEIN</span><span className="text-xl font-black text-blue-500">{dailyTotals.protein}g <span className="text-xs text-slate-500 font-medium">/ {profile.daily_target_protein_g}g</span></span></div>
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${proPercent}%` }}></div></div>
          </div>
          <div className="rounded-xl bg-slate-800 p-4 border border-slate-700 shadow-sm">
            <div className="flex justify-between items-end mb-2"><span className="text-xs font-bold text-slate-400">CARBS</span><span className="text-xl font-black text-emerald-500">{dailyTotals.carbs}g <span className="text-xs text-slate-500 font-medium">/ {profile.daily_target_carbs_g}g</span></span></div>
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${carbPercent}%` }}></div></div>
          </div>
          <div className="rounded-xl bg-slate-800 p-4 border border-slate-700 shadow-sm">
            <div className="flex justify-between items-end mb-2"><span className="text-xs font-bold text-slate-400">FAT</span><span className="text-xl font-black text-red-500">{dailyTotals.fat}g <span className="text-xs text-slate-500 font-medium">/ {profile.daily_target_fat_g}g</span></span></div>
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden"><div className="h-full bg-red-500" style={{ width: `${fatPercent}%` }}></div></div>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          {logs.map((log) => (
            <div key={log.id} className="relative rounded-xl bg-slate-800 p-4 text-sm border border-slate-700/50 group">
              <button 
                onClick={() => handleDeleteLog(log.id, log.total_calories, log.total_protein_g, log.total_carbs_g, log.total_fat_g)}
                className="absolute top-2 right-2 p-1.5 text-slate-500 hover:text-red-500 bg-slate-900 rounded-lg border border-slate-700 opacity-80 transition"
                title="Delete Entry"
              >
                <Trash2 size={16} />
              </button>
              
              {log.items_breakdown.map((item: FoodItem, idx: number) => (
                <div key={idx} className="flex justify-between items-center mt-3 first:mt-0 pr-8">
                  <div><p className="font-bold text-slate-100">{item.name}</p><p className="text-[11px] text-slate-400">{item.portion}</p></div>
                  <div className="text-right"><p className="font-bold text-amber-400">{item.calories} kcal</p><p className="text-[10px] text-slate-400 font-mono">P:{item.protein_g} C:{item.carbs_g} F:{item.fat_g}</p></div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-[72px] left-0 right-0 mx-auto max-w-md bg-gradient-to-t from-slate-900 via-slate-900 to-transparent p-4 pb-2 z-20">
        <div className="flex items-end gap-2">
          <textarea rows={2} value={inputLog} onChange={e => setInputLog(e.target.value)} placeholder="Log a meal (e.g. 200g cooked rice)..." className="flex-1 resize-none rounded-xl bg-slate-800 p-3 text-sm text-white focus:outline-none border border-slate-700 shadow-xl" />
          <button onClick={handleProcessLog} disabled={loading || !inputLog.trim()} className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white disabled:opacity-50"><Loader2 className={loading ? 'animate-spin' : 'hidden'} size={20} /><Send className={loading ? 'hidden' : 'block'} size={20} /></button>
        </div>
      </div>
    </div>
  );
}