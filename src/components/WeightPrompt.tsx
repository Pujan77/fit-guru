import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Scale, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { UserProfile } from '../types';
import type { Session } from '@supabase/supabase-js';

interface WeightPromptProps {
  session: Session;
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
}

const getLocalDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export default function WeightPrompt({ session, profile, setProfile }: WeightPromptProps) {
  const [showModal, setShowModal] = useState(false);
  const [weight, setWeight] = useState(profile.current_weight_kg ? String(profile.current_weight_kg) : '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkDailyWeight = async () => {
      const today = getLocalDate();
      
      // 1. Check if user already dismissed it today
      const dismissedDate = localStorage.getItem('weight_prompt_dismissed');
      if (dismissedDate === today) return;

      // 2. Check the database to see if a weight was already logged today
      const { data, error } = await supabase
        .from('weight_logs')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('logged_date', today)
        .maybeSingle();

      if (error) {
        console.error('Error checking weight log:', error);
        return;
      }

      // If no data exists for today, show the prompt!
      if (!data && isMounted) {
        // Add a slight delay so it doesn't jarringly pop up before the dashboard loads
        setTimeout(() => setShowModal(true), 1000);
      }
    };

    checkDailyWeight();

    return () => { isMounted = false; };
  }, [session.user.id]);

  const handleDismiss = () => {
    const today = getLocalDate();
    localStorage.setItem('weight_prompt_dismissed', today);
    setShowModal(false);
  };

  const handleSave = async () => {
    const numericWeight = Number(weight);
    if (!numericWeight || numericWeight <= 0) {
      toast.error('Please enter a valid weight');
      return;
    }

    setLoading(true);
    try {
      const today = getLocalDate();

      // 1. Log to the historical weight table
      const { error: logError } = await supabase.from('weight_logs').insert({
        user_id: session.user.id,
        weight_kg: numericWeight,
        logged_date: today
      });
      if (logError) throw logError;

      // 2. Update the active profile
      const { error: profileError } = await supabase.from('profiles')
        .update({ current_weight_kg: numericWeight })
        .eq('id', session.user.id);
      if (profileError) throw profileError;

      // 3. Update local state
      setProfile({ ...profile, current_weight_kg: numericWeight });
      
      toast.success('Weight logged!');
      setShowModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to log weight');
    } finally {
      setLoading(false);
    }
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-sm rounded-3xl bg-slate-800 p-6 shadow-2xl border border-slate-700 animate-in zoom-in-95 duration-300">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 rounded-2xl">
              <Scale size={24} className="text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Daily Check-in</h3>
              <p className="text-xs text-slate-400">Keep the AI accurate</p>
            </div>
          </div>
          <button onClick={handleDismiss} className="p-2 text-slate-500 hover:text-white transition rounded-full hover:bg-slate-700">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Today's Weight (kg)</label>
            <input 
              type="number" 
              step="0.1"
              value={weight} 
              onChange={(e) => setWeight(e.target.value)}
              className="w-full bg-slate-900 p-4 rounded-xl text-2xl font-bold text-white text-center border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              onClick={handleDismiss}
              className="flex-1 py-3 rounded-xl bg-slate-900 text-slate-400 font-bold text-sm border border-slate-700 hover:text-white transition"
            >
              Not Today
            </button>
            <button 
              onClick={handleSave}
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition disabled:opacity-50 flex justify-center items-center"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : 'Log & Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}