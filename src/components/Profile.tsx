import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Loader2, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import type { TabProps, UserProfile } from '../types';

// Extend TabProps to include the setter function from App.tsx
interface ProfileProps extends TabProps {
  setProfile: (profile: UserProfile) => void;
}

export default function Profile({ session, profile, setProfile }: ProfileProps) {
  const [formData, setFormData] = useState<Partial<UserProfile>>(profile || { primary_goal: 'Fat Loss' });
  const [loading, setLoading] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: aiData, error: aiError } = await supabase.functions.invoke('process-ai-log', {
        body: { type: 'calculate_macros', context: formData }
      });
      
      if (aiError) throw aiError;

      const completeProfile = { ...formData, ...aiData };

      const { error } = await supabase.from('profiles').update(completeProfile).eq('id', session.user.id);
      if (error) throw error;

      setProfile(completeProfile as UserProfile);
      toast.success('AI calculated your perfect targets!');
    } catch (err: unknown) { 
      console.error('Profile Save Error:', err);
      toast.error('Error saving profile'); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="pb-24 animate-in fade-in">
      <div className="rounded-xl bg-slate-800 p-6 border border-slate-700 shadow-sm">
        <h2 className="text-xl font-bold mb-4 border-b border-slate-700 pb-2">Your AI Goals</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div><label className="text-xs text-slate-400 font-bold uppercase">Name</label><input type="text" required value={formData.display_name || ''} onChange={e => setFormData({...formData, display_name: e.target.value})} className="w-full mt-1 p-3 rounded-lg bg-slate-900 text-white border border-slate-700" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-slate-400 font-bold uppercase">Height (cm)</label><input type="number" required value={formData.height_cm || ''} onChange={e => setFormData({...formData, height_cm: Number(e.target.value)})} className="w-full mt-1 p-3 rounded-lg bg-slate-900 text-white border border-slate-700" /></div>
            <div><label className="text-xs text-slate-400 font-bold uppercase">Current Wt (kg)</label><input type="number" step="0.1" required value={formData.current_weight_kg || ''} onChange={e => setFormData({...formData, current_weight_kg: Number(e.target.value)})} className="w-full mt-1 p-3 rounded-lg bg-slate-900 text-white border border-slate-700" /></div>
          </div>
          <div><label className="text-xs text-slate-400 font-bold uppercase">Primary Goal</label><select value={formData.primary_goal || 'Fat Loss'} onChange={e => setFormData({...formData, primary_goal: e.target.value})} className="w-full mt-1 p-3 rounded-lg bg-slate-900 text-white border border-slate-700 appearance-none"><option>Fat Loss</option><option>Hypertrophy (Muscle Gain)</option><option>Maintenance</option></select></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-slate-400 font-bold uppercase">Target Wt (kg)</label><input type="number" step="0.1" required value={formData.target_weight_kg || ''} onChange={e => setFormData({...formData, target_weight_kg: Number(e.target.value)})} className="w-full mt-1 p-3 rounded-lg bg-slate-900 text-white border border-slate-700" /></div>
            <div><label className="text-xs text-slate-400 font-bold uppercase">Target Date</label><input type="date" required value={formData.target_date || ''} onChange={e => setFormData({...formData, target_date: e.target.value})} className="w-full mt-1 p-3 rounded-lg bg-slate-900 text-white border border-slate-700" /></div>
          </div>
          <button type="submit" disabled={loading} className="w-full mt-6 flex justify-center items-center rounded-lg bg-emerald-600 p-4 font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
             {loading ? <Loader2 className="animate-spin mr-2" size={20} /> : null} Recalculate AI Targets
          </button>
        </form>
      </div>
      
      <button onClick={() => supabase.auth.signOut()} className="w-full mt-4 flex items-center justify-center gap-2 rounded-lg border border-red-900/50 bg-red-950/30 p-4 font-bold text-red-500">
        <LogOut size={18} /> Sign Out
      </button>
    </div>
  );
}