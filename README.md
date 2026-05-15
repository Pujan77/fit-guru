# AI FIT 🤖💪

AI FIT is a premium, mobile-first Progressive Web App (PWA) that acts as your personal, AI-driven fitness and nutrition coach. Built specifically to eliminate the friction of traditional tracking apps, it uses natural language processing to log meals, estimate active calorie burn, and dynamically generate custom workout routines based on your daily readiness.

## ✨ Features

- **🧠 AI Macro Setup:** Enter your height, current weight, target weight, and deadline. The AI automatically calculates your required daily calories, macros, and active burn goals.
- **🍔 Natural Language Diet Tracking:** Stop searching for individual ingredients. Type what you ate (e.g., _"150g rice, 2 eggs in olive oil"_), and the AI extracts the exact calories, protein, carbs, and fats.
- **🏋️ Dynamic AI Workouts:** Tell the app how you feel (e.g., _"Sore hamstrings, only have 30 mins"_). The AI generates a safe, highly customized routine ensuring you hit your goals without overtraining.
- **⏱️ Quick-Load Workout History:** Save AI API calls by easily reloading and marking past custom routines as completed.
- **🔥 Activity Burn Estimation:** Describe your daily activity, and the AI estimates the caloric burn based on your specific body weight.
- **📱 Native PWA Experience:** Installable directly to your iOS or Android home screen with a sleek, bottom-navigation, mobile-native UI.

## 🛠️ Tech Stack

- **Frontend:** React (Vite), TypeScript, Tailwind CSS v4
- **Backend & Auth:** Supabase (PostgreSQL, Row Level Security)
- **AI Engine:** Google Gemini 2.5 Flash (via Supabase Edge Functions)
- **Icons & UI:** Lucide React, React Hot Toast
- **Hosting:** Vercel (Frontend), Supabase (Database & Functions)

---

## 🚀 Local Setup & Installation

### 1. Clone & Install Dependencies

```bash
git clone [https://github.com/pujan77/fitness-pwa.git](https://github.com/pujan77/fitness-pwa.git)
cd fitness-pwa
npm install
```

### 2. Supabase Database Setup

Create a free project on Supabase. Go to the SQL Editor and copy paste content of the **db.sql** file and run it in supabase to create your tables, triggers, and Row Level Security (RLS) policies

### 3. Environment Variables

Create a .env.local file in the root of your frontend project and add your Supabase credentials:

```
VITE_SUPABASE_URL=[https://your-project-id.supabase.co](https://your-project-id.supabase.co)
VITE_SUPABASE_ANON_KEY=your-long-anon-key-here
```

### 4. Deploy the AI Edge Function

You need the Supabase CLI installed to deploy the backend function that securely talks to the Gemini API.

```bash
# Login to Supabase CLI
npx supabase login

# Link your local project to your remote Supabase project
npx supabase link --project-ref your-project-id

# Set your Gemini API Key as a secure secret
npx supabase secrets set GEMINI_API_KEY="your-google-gemini-key"

# Deploy the function
npx supabase functions deploy process-ai-log
```

### 5. Run Locally

```Bash
npm run dev
Open http://localhost:5173 in your browser.
```

### 🌍 Deployment

This project is optimized for Vercel and Supabase.

1. Push your repository to GitHub.

2. Import the project into Vercel.

3. Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the Vercel Environment Variables.

4. Deploy!

**⚠️ Important: Don't forget to add your live Vercel URL to your Supabase Auth Redirect URLs (Authentication -> URL Configuration) so email confirmations route successfully back to your live app!**

### 📱 Installing on Mobile (PWA)

Open your live Vercel URL in Safari (iOS) or Chrome (Android).

Tap the Share icon (iOS) or Menu (Android).

Select Add to Home Screen.

Launch the app from your home screen for the full, fullscreen native experience.

**Disclaimer: This app was created with the use of Gemini AI**
