import type { Session } from '@supabase/supabase-js';

export interface FoodItem {
  name: string;
  portion: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rpe: number;
  notes?: string;
}

export interface WorkoutPlan {
  routine_title: string;
  estimated_minutes: number;
  estimated_calories_burned: number; 
  exercises: Exercise[];
}
export interface ActivityItem {
  name: string;
  duration: string;
  calories_burned: number;
}

export interface UserProfile {
  id: string;
  display_name: string;
  gender?: string; 
  height_cm: number;
  current_weight_kg: number;
  target_weight_kg: number;
  primary_goal: string;
  target_date: string;
  daily_target_calories: number;
  daily_target_protein_g: number;
  daily_target_carbs_g: number;
  daily_target_fat_g: number;
  daily_target_burn_calories: number;
}

// Shared props for our tab components
export interface TabProps {
  session: Session;
  profile: UserProfile;
}
