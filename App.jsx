import React, { useState, useEffect, useMemo, createContext, useContext, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Star, Gift, Check, Home, User, Settings, 
  Sparkles, CheckCircle, ChevronRight, Plus, 
  Trophy, Heart, Target, Calendar as CalendarIcon,
  X, Clock, Trash2, AlertCircle, Lock, Delete
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, updateDoc, 
  onSnapshot, deleteDoc, writeBatch, serverTimestamp
} from 'firebase/firestore';

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'family-app-dev';

const INITIAL_PROFILES = [
  { id: 'kid-1', name: 'Leo', avatar: '🦖', color: 'bg-emerald-100 text-emerald-700', points: 120, targetRewardId: 'reward-2', role: 'kid' },
  { id: 'kid-2', name: 'Mia', avatar: '🦄', color: 'bg-purple-100 text-purple-700', points: 85, targetRewardId: 'reward-1', role: 'kid' }
];

const INITIAL_TASKS = [
  { id: 'task-1', title: 'Make your bed', points: 10, assigneeId: 'kid-1', completed: false, status: 'active', requiresApproval: false, icon: '🛏️', frequency: 'daily' },
  { id: 'task-2', title: 'Feed the dog', points: 15, assigneeId: 'kid-1', completed: false, status: 'active', requiresApproval: true, icon: '🐕', frequency: 'daily' },
  { id: 'task-3', title: 'Read for 20 mins', points: 20, assigneeId: 'kid-2', completed: false, status: 'active', requiresApproval: false, icon: '📚', frequency: 'daily' },
  { id: 'task-4', title: 'Put away toys', points: 10, assigneeId: 'kid-2', completed: false, status: 'active', requiresApproval: true, icon: '🧸', frequency: 'daily' },
];

const INITIAL_REWARDS = [
  { id: 'reward-1', title: 'Extra Screen Time', cost: 100, icon: '🎮', color: 'bg-blue-100' },
  { id: 'reward-2', title: 'Ice Cream Trip', cost: 250, icon: '🍦', color: 'bg-pink-100' },
  { id: 'reward-3', title: 'New Lego Set', cost: 1000, icon: '🧱', color: 'bg-yellow-100' },
];

// Helper to get local date string YYYY-MM-DD
const getLocalDateString = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().split('T')[0];
};

const FamilyContext = createContext(null);

const useFamilyData = (user) => {
  const [profiles, setProfiles] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [history, setHistory] = useState([]);
  const [dailyStars, setDailyStars] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [activeKidId, setActiveKidId] = useState(null);

  useEffect(() => {
    if (!user) return;

    const baseRef = collection(db, 'artifacts', appId, 'users', user.uid, 'family_data');
    
    const unsubs = [
      onSnapshot(collection(baseRef, 'profiles', 'docs'), (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setProfiles(data);
        if (data.length > 0 && !activeKidId) {
          setActiveKidId(data.find(p => p.role === 'kid')?.id || data[0].id);
        }
      }, console.error),
      
      onSnapshot(collection(baseRef, 'tasks', 'docs'), (snap) => {
        setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, console.error),

      onSnapshot(collection(baseRef, 'rewards', 'docs'), (snap) => {
        setRewards(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, console.error),

      onSnapshot(collection(baseRef, 'redemptions', 'docs'), (snap) => {
        setRedemptions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, console.error),

      onSnapshot(collection(baseRef, 'history', 'docs'), (snap) => {
        setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, console.error),

      onSnapshot(collection(baseRef, 'daily_stars', 'docs'), (snap) => {
        setDailyStars(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }, console.error)
    ];

    return () => unsubs.forEach(unsub => unsub());
  }, [user, activeKidId]);

  // Seed data if empty
  useEffect(() => {
    if (!user || loading) return;
    if (profiles.length === 0 && tasks.length === 0) {
      const seedDatabase = async () => {
        const batch = writeBatch(db);
        const baseRef = collection(db, 'artifacts', appId, 'users', user.uid, 'family_data');
        
        INITIAL_PROFILES.forEach(p => batch.set(doc(collection(baseRef, 'profiles', 'docs'), p.id), p));
        INITIAL_TASKS.forEach(t => batch.set(doc(collection(baseRef, 'tasks', 'docs'), t.id), t));
        INITIAL_REWARDS.forEach(r => batch.set(doc(collection(baseRef, 'rewards', 'docs'), r.id), r));
        
        await batch.commit();
      };
      seedDatabase();
    }
  }, [user, loading, profiles.length, tasks.length]);

  return { profiles, tasks, rewards, redemptions, history, dailyStars, loading, activeKidId, setActiveKidId, user };
};

const ConfettiParticle = ({ delay, color, x, y }) => (
  <motion.div
    initial={{ opacity: 1, scale: 0, x: '50vw', y: '50vh' }}
    animate={{ 
      opacity: 0, 
      scale: [0, 1.5, 0],
      x: `calc(50vw + ${x}px)`, 
      y: `calc(50vh + ${y}px)`,
      rotate: [0, 180, 360]
    }}
    transition={{ duration: 1.5, delay, ease: "easeOut" }}
    className={`absolute w-3 h-3 rounded-full ${color} pointer-events-none z-50`}
  />
);

const CelebrationOverlay = ({ show, onComplete }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onComplete, 2500);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!show) return null;

  const particles = Array.from({ length: 50 }).map((_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 500,
    y: (Math.random() - 0.5) * 500 - 100,
    color: ['bg-pink-400', 'bg-blue-400', 'bg-yellow-400', 'bg-emerald-400'][Math.floor(Math.random() * 4)],
    delay: Math.random() * 0.3
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden flex items-center justify-center bg-white/20 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0, opacity: 0, y: 50 }}
        animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 1, 0], y: 0 }}
        transition={{ duration: 2, times: [0, 0.2, 0.8, 1] }}
        className="text-6xl md:text-8xl font-black text-yellow-400 drop-shadow-2xl flex flex-col items-center gap-4 text-center"
      >
        <Sparkles size={80} className="text-yellow-400 animate-spin-slow" />
        <span className="bg-white/90 px-8 py-4 rounded-full shadow-xl border-4 border-yellow-200">Awesome!</span>
      </motion.div>
      {particles.map(p => (
        <ConfettiParticle key={p.id} {...p} />
      ))}
    </div>
  );
};

const StoreIcon = ({ size, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/></svg>
);

const Sidebar = ({ currentView, setCurrentView }) => {
  const navItems = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'dashboard', icon: Trophy, label: 'Quests' },
    { id: 'rewards', icon: Gift, label: 'Rewards' },
    { id: 'calendar', icon: CalendarIcon, label: 'Calendar' },
    { id: 'parents', icon: Settings, label: 'Parents' },
  ];

  return (
    <div className="w-24 md:w-32 bg-white h-full shadow-sm rounded-r-[3rem] flex flex-col items-center py-8 gap-8 z-10 relative shrink-0">
      <div className="w-16 h-16 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-2xl flex items-center justify-center shadow-md mb-4 text-white">
        <Heart size={32} fill="currentColor" />
      </div>
      
      <div className="flex flex-col gap-6 w-full px-4">
        {navItems.map(({ id, icon: Icon, label }) => {
          const isActive = currentView === id;
          return (
            <button
              key={id}
              onClick={() => setCurrentView(id)}
              className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-300 ${
                isActive ? 'bg-indigo-50 text-indigo-600 scale-110 shadow-sm' : 'text-slate-400 hover:bg-slate-50'
              }`}
            >
              <Icon size={28} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-xs font-bold tracking-wide">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const KidSelector = () => {
  const { profiles, activeKidId, setActiveKidId } = useContext(FamilyContext);
  const kids = profiles.filter(p => p.role === 'kid');

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
      {kids.map(kid => {
        const isActive = activeKidId === kid.id;
        return (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            key={kid.id}
            onClick={() => setActiveKidId(kid.id)}
            className={`flex items-center gap-3 px-6 py-3 rounded-full transition-all duration-300 border-2 ${
              isActive 
                ? 'bg-white border-indigo-200 shadow-md ring-4 ring-indigo-50' 
                : 'bg-white/50 border-transparent text-slate-500 hover:bg-white/80'
            }`}
          >
            <span className="text-3xl">{kid.avatar}</span>
            <span className={`text-xl font-extrabold ${isActive ? 'text-slate-800' : 'text-slate-500'}`}>
              {kid.name}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
};

const HomeView = ({ setCurrentView, setActiveKidId }) => {
  const { profiles, dailyStars } = useContext(FamilyContext);
  const kids = profiles.filter(p => p.role === 'kid');

  const today = new Date();
  const currentDayOfWeek = today.getDay(); 
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - currentDayOfWeek);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return {
      date: d,
      dateStr: getLocalDateString(d),
      dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()],
      dayNum: d.getDate(),
      isToday: d.toDateString() === today.toDateString()
    };
  });

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col gap-8 pb-8">
      <header>
        <h1 className="text-4xl font-black text-slate-800">Family Hub</h1>
        <p className="text-lg text-slate-500 font-bold mt-2">Welcome home! What's on the agenda today?</p>
      </header>

      <section>
         <div 
           onClick={() => setCurrentView('calendar')}
           className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 cursor-pointer hover:border-indigo-200 transition-all group relative overflow-hidden"
         >
           <div className="absolute -right-10 -top-10 text-indigo-50 opacity-50 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
             <CalendarIcon size={200} />
           </div>
           <div className="flex justify-between items-center mb-6 relative z-10">
             <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
               <CalendarIcon className="text-indigo-400 group-hover:scale-110 transition-transform" />
               This Week
             </h2>
             <span className="text-indigo-500 font-bold flex items-center text-sm group-hover:translate-x-1 transition-transform">
               Full Calendar <ChevronRight size={16} />
             </span>
           </div>
           
           <div className="grid grid-cols-7 gap-2 md:gap-4 relative z-10">
             {weekDays.map(day => {
               const starsOnDay = dailyStars.filter(s => s.date === day.dateStr && s.allCompleted);
               return (
                 <div 
                   key={day.dateStr} 
                   className={`flex flex-col items-center justify-center p-3 md:p-4 rounded-2xl border-2 transition-colors ${
                     day.isToday 
                       ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                       : 'bg-slate-50 border-transparent hover:bg-slate-100'
                   }`}
                 >
                   <span className={`font-bold text-xs uppercase mb-1 ${day.isToday ? 'text-indigo-400' : 'text-slate-400'}`}>
                     {day.dayName}
                   </span>
                   <span className={`text-2xl md:text-3xl font-black ${day.isToday ? 'text-indigo-700' : 'text-slate-700'}`}>
                     {day.dayNum}
                   </span>
                   <div className="h-4 mt-2 flex -space-x-1">
                     {starsOnDay.slice(0, 3).map((star, idx) => (
                       <Star key={idx} size={12} className="text-yellow-400 fill-yellow-400 drop-shadow-sm" />
                     ))}
                   </div>
                 </div>
               )
             })}
           </div>
         </div>
      </section>

      <section className="flex-1">
        <h2 className="text-2xl font-extrabold text-slate-800 mb-6 flex items-center gap-2">
          <User className="text-emerald-400" /> Adventurers
        </h2>
        {kids.length === 0 ? (
          <div className="bg-slate-50 rounded-3xl p-8 border-2 border-dashed border-slate-200 text-center flex flex-col items-center justify-center text-slate-400">
             <User size={48} className="mb-4 text-slate-300" />
             <p className="font-bold text-lg">No adventurers yet!</p>
             <p className="text-sm font-medium">Head to the Parents zone to add profiles.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {kids.map(kid => (
              <motion.div
                key={kid.id}
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setActiveKidId(kid.id);
                  setCurrentView('dashboard');
                }}
                className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 cursor-pointer hover:border-emerald-200 transition-all flex items-center gap-6 group"
              >
                <div className={`text-5xl w-24 h-24 rounded-3xl flex items-center justify-center shadow-inner ${kid.color}`}>
                  <motion.div group-hover={{ rotate: 10 }} transition={{ type: "spring" }}>
                    {kid.avatar}
                  </motion.div>
                </div>
                <div className="flex-1">
                  <h3 className="text-3xl font-black text-slate-800 mb-1 group-hover:text-emerald-600 transition-colors">{kid.name}</h3>
                  <div className="flex items-center gap-2 font-bold text-slate-500">
                    <Star size={24} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-2xl text-slate-700">{kid.points}</span>
                    <span className="text-sm uppercase tracking-wider text-slate-400 mt-1">Stars</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                  <ChevronRight size={24} />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const DashboardView = ({ triggerCelebration }) => {
  const { profiles, tasks, activeKidId, user } = useContext(FamilyContext);
  
  const activeProfile = profiles.find(p => p.id === activeKidId);
  const activeTasks = tasks.filter(t => t.assigneeId === activeKidId && (t.status ? t.status !== 'completed' : !t.completed));
  const { rewards } = useContext(FamilyContext);

  const handleCompleteTask = async (task) => {
    if (!user || !activeProfile || task.status === 'pending') return;
    
    const baseRef = collection(db, 'artifacts', appId, 'users', user.uid, 'family_data');
    const taskRef = doc(collection(baseRef, 'tasks', 'docs'), task.id);
    
    if (task.requiresApproval) {
      try {
        await updateDoc(taskRef, { status: 'pending' });
      } catch (error) {
        console.error("Error submitting task for approval:", error);
      }
      return;
    }

    const profileRef = doc(collection(baseRef, 'profiles', 'docs'), activeProfile.id);
    const historyRef = doc(collection(baseRef, 'history', 'docs'));
    
    const todayStr = getLocalDateString();
    const batch = writeBatch(db);

    try {
      batch.update(taskRef, { completed: true, status: 'completed' });
      batch.update(profileRef, { points: activeProfile.points + task.points });
      
      batch.set(historyRef, {
        kidId: activeKidId,
        taskId: task.id,
        taskTitle: task.title,
        points: task.points,
        date: todayStr,
        timestamp: serverTimestamp()
      });

      const remainingTasks = activeTasks.filter(t => t.id !== task.id);
      if (remainingTasks.length === 0) {
        const starRef = doc(collection(baseRef, 'daily_stars', 'docs'), `${todayStr}_${activeKidId}`);
        batch.set(starRef, { date: todayStr, kidId: activeKidId, allCompleted: true });
      }

      await batch.commit();
      triggerCelebration();
    } catch (error) {
      console.error("Error completing task:", error);
    }
  };

  if (!activeProfile) return <div className="p-8 text-slate-400 font-bold">Loading adventurer...</div>;

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col gap-8 pb-8">
      <header className="flex flex-col gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-800 flex items-center gap-3">
            Hey, {activeProfile.name}! {activeProfile.avatar}
          </h1>
          <p className="text-lg text-slate-500 font-bold mt-1">Ready for today's quests?</p>
        </div>
        
        {activeProfile.targetRewardId && rewards.find(r => r.id === activeProfile.targetRewardId) && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center gap-6">
             <div className="text-4xl">{rewards.find(r => r.id === activeProfile.targetRewardId).icon}</div>
             <div className="flex-1">
                <p className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Current Goal</p>
                <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden mt-2">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((activeProfile.points / rewards.find(r => r.id === activeProfile.targetRewardId).cost) * 100, 100)}%` }}
                    className="h-full bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full"
                  />
                </div>
             </div>
             <div className="flex items-center gap-1 text-slate-800 font-black text-2xl">
                <Star size={20} className="text-yellow-400 fill-yellow-400" />
                {activeProfile.points} <span className="text-slate-400 text-lg">/ {rewards.find(r => r.id === activeProfile.targetRewardId).cost}</span>
             </div>
          </div>
        )}
      </header>

      <section className="flex-1">
        <h2 className="text-2xl font-extrabold text-slate-800 mb-6 flex items-center gap-2">
          <Sparkles className="text-indigo-400" />
          Active Quests
        </h2>
        
        {activeTasks.length === 0 ? (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-100 rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-4 shadow-sm">
            <Trophy size={80} className="text-emerald-400 drop-shadow-sm mb-2" />
            <h3 className="text-3xl font-black text-emerald-800">All Quests Complete!</h3>
            <p className="text-emerald-600 font-bold text-lg">You earned a star on the calendar today. Great job!</p>
          </motion.div>
        ) : (
          <motion.div layout className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            <AnimatePresence>
              {activeTasks.map(task => {
                const isPending = task.status === 'pending';
                const isRejected = task.status === 'rejected';

                return (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    whileHover={isPending ? {} : { scale: 1.02, y: -4 }}
                    whileTap={isPending ? {} : { scale: 0.98 }}
                    onClick={() => handleCompleteTask(task)}
                    className={`rounded-3xl p-6 shadow-sm border cursor-pointer flex flex-col justify-between aspect-square group transition-all relative overflow-hidden ${
                      isPending ? 'bg-slate-50 border-slate-200 opacity-80 cursor-not-allowed' :
                      isRejected ? 'bg-red-50 border-red-200' :
                      'bg-white border-slate-100 hover:border-indigo-100'
                    }`}
                  >
                    {isPending && (
                      <div className="absolute top-0 left-0 w-full bg-slate-200 text-slate-600 text-[10px] font-black uppercase py-1 text-center flex items-center justify-center gap-1">
                        <Clock size={12} /> Waiting on Parent
                      </div>
                    )}
                    {isRejected && (
                      <div className="absolute top-0 left-0 w-full bg-red-500 text-white text-[10px] font-black uppercase py-1 text-center flex items-center justify-center gap-1 z-10">
                        <AlertCircle size={12} /> Try Again
                      </div>
                    )}

                    <div className={`flex justify-between items-start ${isPending || isRejected ? 'mt-4' : ''}`}>
                      <div className={`text-5xl w-20 h-20 rounded-2xl flex items-center justify-center transition-transform duration-300 relative ${isPending ? 'bg-slate-100 grayscale' : isRejected ? 'bg-red-100' : 'bg-slate-50 group-hover:rotate-12'}`}>
                        {task.icon}
                        {task.frequency && task.frequency !== 'once' && (
                          <span className={`absolute -top-2 -right-2 text-[10px] font-black uppercase px-2 py-1 rounded-lg shadow-sm border ${
                            isPending ? 'bg-slate-200 text-slate-500 border-slate-300' : 
                            isRejected ? 'bg-red-200 text-red-700 border-red-300' : 
                            'bg-indigo-100 text-indigo-600 border-indigo-200'
                          }`}>
                            {task.frequency}
                          </span>
                        )}
                      </div>
                      <div className={`font-black px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-sm ${
                        isPending ? 'bg-slate-200 text-slate-500' : 
                        isRejected ? 'bg-red-200 text-red-700' : 
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        <Star size={16} className={isPending ? 'text-slate-400 fill-slate-400' : isRejected ? 'text-red-500 fill-red-500' : 'fill-yellow-500 text-yellow-500'} />
                        +{task.points}
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <h3 className={`text-xl font-extrabold leading-tight transition-colors ${
                        isPending ? 'text-slate-500' : 
                        isRejected ? 'text-red-800' : 
                        'text-slate-800 group-hover:text-indigo-600'
                      }`}>
                        {task.title}
                      </h3>
                      <div className={`flex items-center gap-2 mt-3 font-bold ${
                        isPending ? 'text-slate-400' : 
                        isRejected ? 'text-red-500' : 
                        'text-slate-400'
                      }`}>
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                          isPending ? 'border-slate-300 bg-slate-100' : 
                          isRejected ? 'border-red-300 bg-red-100' : 
                          'border-slate-200 group-hover:bg-emerald-500 group-hover:border-emerald-500 group-hover:text-white'
                        }`}>
                          {isPending ? <Clock size={16} strokeWidth={3} /> : isRejected ? <AlertCircle size={16} strokeWidth={3} /> : <Check size={16} strokeWidth={3} />}
                        </div>
                        <span className={!isPending && !isRejected ? 'group-hover:text-emerald-500 transition-colors' : ''}>
                          {isPending ? 'Pending' : isRejected ? 'Needs Fix' : 'Tap to finish'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </section>
    </div>
  );
};

const RewardsView = () => {
  const { profiles, rewards, activeKidId, user } = useContext(FamilyContext);
  const activeProfile = profiles.find(p => p.id === activeKidId);
  const [notification, setNotification] = useState(null);

  const handleSetTarget = async (reward) => {
    if (!user || !activeProfile) return;
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'family_data', 'profiles', 'docs', activeProfile.id);
    await updateDoc(profileRef, { targetRewardId: reward.id });
  };

  const handleRedeem = async (reward) => {
    if (!user || !activeProfile || activeProfile.points < reward.cost) return;
    
    const baseRef = collection(db, 'artifacts', appId, 'users', user.uid, 'family_data');
    const profileRef = doc(collection(baseRef, 'profiles', 'docs'), activeProfile.id);
    const redemptionRef = doc(collection(baseRef, 'redemptions', 'docs'));
    
    const batch = writeBatch(db);
    
    batch.update(profileRef, { 
      points: activeProfile.points - reward.cost,
      targetRewardId: activeProfile.targetRewardId === reward.id ? null : activeProfile.targetRewardId
    });

    batch.set(redemptionRef, {
      kidId: activeKidId,
      kidName: activeProfile.name,
      rewardId: reward.id,
      rewardTitle: reward.title,
      cost: reward.cost,
      status: 'pending',
      timestamp: serverTimestamp(),
      date: getLocalDateString()
    });

    try {
      await batch.commit();
      // Replacing the blocked alert() with a safe on-screen notification
      setNotification(`Woohoo! You requested "${reward.title}". A parent will approve it soon!`);
      setTimeout(() => setNotification(null), 4000);
    } catch (e) {
      console.error("Error redeeming", e);
    }
  };

  if (!activeProfile) return null;

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col gap-8 pb-8 relative">
      
      {/* Safe Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }}
            className="absolute top-0 left-1/2 -translate-x-1/2 bg-emerald-500 text-white font-bold px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-2"
          >
            <CheckCircle size={20} /> {notification}
          </motion.div>
        )}
      </AnimatePresence>

      <header>
        <h1 className="text-4xl font-black text-slate-800">Reward Store 🎁</h1>
        <p className="text-lg text-slate-500 font-bold mt-2">
          You have <span className="text-yellow-500 font-black">{activeProfile.points}</span> stars to spend!
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rewards.map(reward => {
          const isTarget = activeProfile.targetRewardId === reward.id;
          const affordable = activeProfile.points >= reward.cost;
          
          return (
            <motion.div 
              key={reward.id}
              whileHover={{ scale: 1.02 }}
              className={`rounded-3xl p-6 border-2 transition-all flex flex-col ${
                isTarget 
                  ? 'bg-white border-indigo-400 shadow-lg ring-4 ring-indigo-50' 
                  : 'bg-white border-slate-100 shadow-sm'
              }`}
            >
              <div className="flex justify-between items-start mb-6">
                <div className={`text-6xl w-24 h-24 rounded-3xl flex items-center justify-center shadow-inner ${reward.color}`}>
                  {reward.icon}
                </div>
                {isTarget && (
                  <div className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-full font-bold text-sm flex items-center gap-1 shadow-sm">
                    <Target size={16} /> Goal
                  </div>
                )}
              </div>
              
              <h3 className="text-2xl font-extrabold text-slate-800 mb-2">{reward.title}</h3>
              <div className="flex items-center gap-1 text-slate-600 font-bold mb-6">
                Cost: <Star size={18} className="text-yellow-400 fill-yellow-400 ml-1" /> {reward.cost}
              </div>
              
              <div className="mt-auto pt-4 flex gap-2">
                {affordable ? (
                  <button 
                    onClick={() => handleRedeem(reward)}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-4 rounded-2xl transition-colors shadow-md text-lg"
                  >
                    Buy Reward
                  </button>
                ) : (
                  <button 
                    onClick={() => handleSetTarget(reward)}
                    disabled={isTarget}
                    className={`flex-1 font-bold py-3 px-4 rounded-2xl transition-colors text-lg ${
                      isTarget 
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                        : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                    }`}
                  >
                    {isTarget ? 'Target Set!' : 'Set as Goal'}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

const CalendarView = () => {
  const { history, dailyStars, profiles } = useContext(FamilyContext);
  const [selectedDate, setSelectedDate] = useState(null);

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return { dayNumber: d, dateStr };
  });

  const getKidProfile = (kidId) => profiles.find(p => p.id === kidId);

  const selectedDayHistory = selectedDate ? history.filter(h => h.date === selectedDate) : [];

  return (
    <div className="max-w-6xl mx-auto h-full flex gap-8 pb-8">
      <div className="flex-1 flex flex-col">
        <header className="mb-8">
          <h1 className="text-4xl font-black text-slate-800">Overview Calendar 📅</h1>
          <p className="text-lg text-slate-500 font-bold mt-2">
            {today.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </p>
        </header>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <div className="grid grid-cols-7 gap-2 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center font-bold text-slate-400 uppercase text-sm tracking-wider">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square bg-slate-50 rounded-2xl opacity-50" />
            ))}
            
            {days.map(({ dayNumber, dateStr }) => {
              const starsOnDay = dailyStars.filter(s => s.date === dateStr && s.allCompleted);
              const isToday = dateStr === getLocalDateString();
              const isSelected = selectedDate === dateStr;

              return (
                <motion.button
                  key={dayNumber}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`aspect-square rounded-2xl flex flex-col items-center justify-center p-2 relative transition-all border-2 ${
                    isSelected ? 'border-indigo-400 bg-indigo-50 shadow-md ring-4 ring-indigo-50 z-10' : 
                    isToday ? 'border-emerald-300 bg-emerald-50' : 
                    'border-transparent hover:bg-slate-50 bg-white shadow-sm'
                  }`}
                >
                  <span className={`text-xl font-extrabold mb-1 ${isToday ? 'text-emerald-700' : 'text-slate-600'}`}>
                    {dayNumber}
                  </span>
                  
                  <div className="flex -space-x-2">
                    {starsOnDay.map((star, idx) => {
                      const kid = getKidProfile(star.kidId);
                      if (!kid) return null;
                      return (
                        <div key={idx} className="w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center text-xs border border-yellow-200" title={`${kid.name} finished all tasks!`}>
                          {kid.avatar}
                        </div>
                      );
                    })}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="w-80 flex flex-col">
        <AnimatePresence mode="wait">
          {selectedDate ? (
            <motion.div 
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex-1 sticky top-0"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <CalendarIcon className="text-indigo-400" />
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </h3>
                <button onClick={() => setSelectedDate(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              {selectedDayHistory.length === 0 ? (
                <div className="text-center text-slate-400 py-10 flex flex-col items-center gap-3">
                  <Clock size={40} className="text-slate-200" />
                  <p className="font-medium">No tasks recorded on this day.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {profiles.filter(p => p.role === 'kid').map(kid => {
                    const kidHistory = selectedDayHistory.filter(h => h.kidId === kid.id);
                    if (kidHistory.length === 0) return null;
                    
                    const earnedStar = dailyStars.some(s => s.date === selectedDate && s.kidId === kid.id && s.allCompleted);

                    return (
                      <div key={kid.id} className="bg-slate-50 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-bold text-slate-700 flex items-center gap-2">
                            {kid.avatar} {kid.name}
                          </span>
                          {earnedStar && <Star size={16} className="text-yellow-400 fill-yellow-400" />}
                        </div>
                        <ul className="flex flex-col gap-2">
                          {kidHistory.map(h => (
                            <li key={h.id} className="text-sm font-medium text-slate-600 flex justify-between bg-white px-3 py-2 rounded-xl shadow-sm">
                              <span className="truncate">{h.taskTitle}</span>
                              <span className="text-emerald-500 font-bold ml-2">+{h.points}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ) : (
             <motion.div 
               key="empty"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               className="bg-slate-100/50 rounded-3xl p-6 border-2 border-dashed border-slate-200 flex-1 flex flex-col items-center justify-center text-center text-slate-400"
             >
               <CalendarIcon size={48} className="mb-4 text-slate-300" />
               <p className="font-bold text-lg">Tap a day to see<br/>task history!</p>
             </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const PinPad = ({ onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const CORRECT_PIN = '123456'; 

  const handlePress = (num) => {
    if (pin.length < 6) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 6) {
        if (newPin === CORRECT_PIN) {
          onUnlock();
        } else {
          setError(true);
          setTimeout(() => { setPin(''); setError(false); }, 500);
        }
      }
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  return (
    <div className="h-full flex flex-col items-center justify-center">
      <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-500 mb-6 shadow-inner">
        <Lock size={40} />
      </div>
      <h2 className="text-3xl font-black text-slate-800 mb-2">Parent Zone</h2>
      <p className="text-slate-500 font-bold mb-8">Enter PIN to unlock</p>

      <motion.div 
        animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="flex gap-4 mb-8"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`w-6 h-6 rounded-full border-2 transition-all duration-200 ${
            pin.length > i ? 'bg-indigo-500 border-indigo-500 scale-110' : 
            error ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-slate-100'
          }`} />
        ))}
      </motion.div>

      <div className="grid grid-cols-3 gap-4 max-w-[280px]">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button 
            key={num} onClick={() => handlePress(num.toString())}
            className="w-20 h-20 rounded-full bg-white border border-slate-200 shadow-sm text-2xl font-black text-slate-700 hover:bg-slate-50 hover:border-indigo-200 active:scale-95 transition-all"
          >
            {num}
          </button>
        ))}
        <div /> {/* Empty slot for alignment */}
        <button 
          onClick={() => handlePress('0')}
          className="w-20 h-20 rounded-full bg-white border border-slate-200 shadow-sm text-2xl font-black text-slate-700 hover:bg-slate-50 hover:border-indigo-200 active:scale-95 transition-all"
        >
          0
        </button>
        <button 
          onClick={handleBackspace}
          className="w-20 h-20 rounded-full bg-slate-100 border border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-700 active:scale-95 transition-all flex items-center justify-center"
        >
          <Delete size={28} />
        </button>
      </div>
    </div>
  );
};

const ParentsView = () => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const { profiles, redemptions, rewards, tasks, user } = useContext(FamilyContext);
  
  const pendingRedemptions = redemptions.filter(r => r.status === 'pending');
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  
  const [newKidName, setNewKidName] = useState('');
  const [newKidEmoji, setNewKidEmoji] = useState('🐯');
  
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPoints, setNewTaskPoints] = useState(10);
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskIcon, setNewTaskIcon] = useState('🧹');
  const [newTaskFrequency, setNewTaskFrequency] = useState('daily');
  const [newTaskRequiresApproval, setNewTaskRequiresApproval] = useState(false);

  const [newRewardTitle, setNewRewardTitle] = useState('');
  const [newRewardCost, setNewRewardCost] = useState(100);
  const [newRewardIcon, setNewRewardIcon] = useState('🎁');
  const rewardColors = ['bg-blue-100', 'bg-pink-100', 'bg-yellow-100', 'bg-emerald-100', 'bg-purple-100'];
  const [newRewardColor, setNewRewardColor] = useState(rewardColors[0]);

  const [adjustKidId, setAdjustKidId] = useState('');
  const [adjustAmount, setAdjustAmount] = useState(5);

  const kids = profiles.filter(p => p.role === 'kid');

  // Show PIN Pad if not unlocked
  if (!isUnlocked) {
    return <PinPad onUnlock={() => setIsUnlocked(true)} />;
  }

  const handleApproveRedemption = async (redemptionId) => {
    if (!user) return;
    const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'family_data', 'redemptions', 'docs', redemptionId);
    await updateDoc(ref, { status: 'approved' });
  };

  const handleApproveTask = async (task) => {
    if (!user) return;
    
    const kidProfile = profiles.find(p => p.id === task.assigneeId);
    if (!kidProfile) return;

    const baseRef = collection(db, 'artifacts', appId, 'users', user.uid, 'family_data');
    const taskRef = doc(collection(baseRef, 'tasks', 'docs'), task.id);
    const profileRef = doc(collection(baseRef, 'profiles', 'docs'), kidProfile.id);
    const historyRef = doc(collection(baseRef, 'history', 'docs'));
    
    const todayStr = getLocalDateString();
    const batch = writeBatch(db);

    try {
      batch.update(taskRef, { completed: true, status: 'completed' });
      batch.update(profileRef, { points: kidProfile.points + task.points });
      
      batch.set(historyRef, {
        kidId: kidProfile.id,
        taskId: task.id,
        taskTitle: task.title,
        points: task.points,
        date: todayStr,
        timestamp: serverTimestamp()
      });

      const kidActiveTasks = tasks.filter(t => t.assigneeId === task.assigneeId && (t.status ? t.status !== 'completed' : !t.completed));
      const remainingTasks = kidActiveTasks.filter(t => t.id !== task.id);
      if (remainingTasks.length === 0) {
        const starRef = doc(collection(baseRef, 'daily_stars', 'docs'), `${todayStr}_${task.assigneeId}`);
        batch.set(starRef, { date: todayStr, kidId: task.assigneeId, allCompleted: true });
      }

      await batch.commit();
    } catch (error) {
      console.error("Error approving task:", error);
    }
  };

  const handleRejectTask = async (taskId) => {
    if (!user) return;
    const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'family_data', 'tasks', 'docs', taskId);
    await updateDoc(ref, { status: 'rejected' });
  };

  const handleAddKid = async (e) => {
    e.preventDefault();
    if (!user || !newKidName) return;
    const newId = `kid-${Date.now()}`;
    const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'family_data', 'profiles', 'docs', newId);
    await setDoc(ref, { id: newId, name: newKidName, avatar: newKidEmoji, color: 'bg-orange-100 text-orange-700', points: 0, targetRewardId: null, role: 'kid' });
    setNewKidName('');
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!user || !newTaskTitle || !newTaskAssignee) return;
    const newId = `task-${Date.now()}`;
    const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'family_data', 'tasks', 'docs', newId);
    await setDoc(ref, {
      id: newId, title: newTaskTitle, points: Number(newTaskPoints), assigneeId: newTaskAssignee,
      completed: false, status: 'active', requiresApproval: newTaskRequiresApproval, icon: newTaskIcon, frequency: newTaskFrequency
    });
    setNewTaskTitle(''); setNewTaskRequiresApproval(false);
  };

  const handleAddReward = async (e) => {
    e.preventDefault();
    if (!user || !newRewardTitle) return;
    const newId = `reward-${Date.now()}`;
    const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'family_data', 'rewards', 'docs', newId);
    await setDoc(ref, { id: newId, title: newRewardTitle, cost: Number(newRewardCost), icon: newRewardIcon, color: newRewardColor });
    setNewRewardTitle('');
  };

  const handleDeleteReward = async (rewardId) => {
    if (!user) return;
    const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'family_data', 'rewards', 'docs', rewardId);
    await deleteDoc(ref);
  };

  const handleAdjustStars = async (e) => {
    e.preventDefault();
    if (!user || !adjustKidId) return;
    const kidProfile = profiles.find(p => p.id === adjustKidId);
    if (!kidProfile) return;
    const amount = Number(adjustAmount);
    if (amount === 0) return;
    
    const baseRef = collection(db, 'artifacts', appId, 'users', user.uid, 'family_data');
    const profileRef = doc(baseRef, 'profiles', 'docs', kidProfile.id);
    const historyRef = doc(baseRef, 'history', 'docs');
    const todayStr = getLocalDateString();
    const batch = writeBatch(db);

    batch.update(profileRef, { points: Math.max(0, kidProfile.points + amount) });
    batch.set(historyRef, {
      kidId: kidProfile.id, taskId: `manual-${Date.now()}`, taskTitle: amount > 0 ? 'Bonus Stars!' : 'Star Adjustment',
      points: amount, date: todayStr, timestamp: serverTimestamp()
    });

    try {
      await batch.commit();
      setAdjustKidId(''); setAdjustAmount(5);
    } catch (error) { console.error("Error adjusting stars:", error); }
  };

  return (
    <div className="max-w-6xl mx-auto h-full pb-8 flex gap-8">
      
      {/* Left Column: Management Forms */}
      <div className="flex-1 flex flex-col gap-6">
        <header className="mb-2 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black text-slate-800 flex items-center gap-3">
              <Settings className="text-slate-400" size={36} /> Parent Zone
            </h1>
            <p className="text-lg text-slate-500 font-bold mt-2">Manage your crew, quests, and rewards.</p>
          </div>
          <button 
            onClick={() => setIsUnlocked(false)} 
            className="flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold px-4 py-2 rounded-xl transition-colors"
          >
            <Lock size={16} /> Lock
          </button>
        </header>

        {/* Add Task Form */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Plus className="text-indigo-500 bg-indigo-100 rounded-full p-1" size={24} /> Create New Quest
          </h2>
          <form onSubmit={handleAddTask} className="flex flex-col gap-4">
            <div className="flex gap-4">
              <input type="text" value={newTaskIcon} onChange={e => setNewTaskIcon(e.target.value)} className="w-16 text-center text-2xl bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400" maxLength={2} />
              <input type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Quest Title (e.g., Wash dishes)" className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400" required />
            </div>
            <div className="flex gap-4">
               <select value={newTaskAssignee} onChange={e => setNewTaskAssignee(e.target.value)} className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400" required>
                 <option value="" disabled>Select child...</option>
                 {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
               </select>
               <select value={newTaskFrequency} onChange={e => setNewTaskFrequency(e.target.value)} className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400">
                 <option value="once">One-Time</option> <option value="daily">Daily</option> <option value="weekly">Weekly</option> <option value="monthly">Monthly</option>
               </select>
               <div className="relative flex-1">
                 <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Star size={16} className="text-yellow-500 fill-yellow-500" /></div>
                 <input type="number" value={newTaskPoints} onChange={e => setNewTaskPoints(e.target.value)} min="1" className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400" required />
               </div>
            </div>
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 mt-2">
              <label className="flex items-center gap-3 cursor-pointer text-slate-700 font-bold select-none">
                <input type="checkbox" checked={newTaskRequiresApproval} onChange={(e) => setNewTaskRequiresApproval(e.target.checked)} className="w-5 h-5 rounded text-indigo-500 focus:ring-indigo-400 border-slate-300" />
                Require Parent Approval
              </label>
              <button type="submit" className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold px-6 py-2 rounded-xl transition-colors shadow-sm whitespace-nowrap">Add Quest</button>
            </div>
          </form>
        </div>

        {/* Add Reward Form */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><Gift className="text-pink-500 bg-pink-100 rounded-full p-1" size={24} /> Create New Reward</h2>
          <form onSubmit={handleAddReward} className="flex flex-col gap-4">
            <div className="flex gap-4">
              <input type="text" value={newRewardIcon} onChange={e => setNewRewardIcon(e.target.value)} className="w-16 text-center text-2xl bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-pink-400" maxLength={2} />
              <input type="text" value={newRewardTitle} onChange={e => setNewRewardTitle(e.target.value)} placeholder="Reward Title (e.g., Movie Night)" className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-pink-400" required />
              <div className="relative w-32">
                 <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Star size={16} className="text-yellow-500 fill-yellow-500" /></div>
                 <input type="number" value={newRewardCost} onChange={e => setNewRewardCost(e.target.value)} min="1" className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-pink-400" required />
              </div>
            </div>
            <div className="flex gap-4 items-center justify-between">
              <div className="flex gap-2 items-center">
                <span className="text-sm font-bold text-slate-400 mr-2">Color:</span>
                {rewardColors.map(color => (
                  <button key={color} type="button" onClick={() => setNewRewardColor(color)} className={`w-8 h-8 rounded-full ${color} border-2 transition-all ${newRewardColor === color ? 'border-slate-800 scale-110 shadow-sm' : 'border-transparent hover:scale-105'}`} />
                ))}
              </div>
              <button type="submit" className="bg-pink-500 hover:bg-pink-600 text-white font-bold px-8 py-3 rounded-xl transition-colors shadow-sm">Add to Store</button>
            </div>
          </form>
        </div>

        {/* Adjust Stars Form */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><Star className="text-yellow-500 bg-yellow-100 rounded-full p-1" size={24} /> Adjust Star Balance</h2>
          <form onSubmit={handleAdjustStars} className="flex gap-4">
            <select value={adjustKidId} onChange={e => setAdjustKidId(e.target.value)} className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-yellow-400" required>
              <option value="" disabled>Select child...</option>
              {kids.map(k => <option key={k.id} value={k.id}>{k.name} ({k.points} ⭐)</option>)}
            </select>
            <div className="relative w-32">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><span className="text-slate-400 font-bold text-lg">±</span></div>
              <input type="number" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-yellow-400" required />
            </div>
            <button type="submit" className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold px-6 rounded-xl transition-colors shadow-sm whitespace-nowrap">Update</button>
          </form>
        </div>

        {/* Add Kid Form */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><User className="text-emerald-500 bg-emerald-100 rounded-full p-1" size={24} /> Add Adventurer</h2>
          <form onSubmit={handleAddKid} className="flex gap-4">
             <input type="text" value={newKidEmoji} onChange={e => setNewKidEmoji(e.target.value)} className="w-16 text-center text-2xl bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-400" maxLength={2} />
             <input type="text" value={newKidName} onChange={e => setNewKidName(e.target.value)} placeholder="Child's Name" className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-400" required />
             <button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-6 rounded-xl transition-colors shadow-sm whitespace-nowrap">Add Child</button>
          </form>
        </div>
      </div>

      {/* Right Column: Notifications / Redemptions / Store List */}
      <div className="w-96 flex flex-col gap-6">
         <div className="bg-gradient-to-b from-indigo-50 to-white rounded-3xl p-6 shadow-sm border border-indigo-100 shrink-0">
            <h2 className="text-xl font-black text-indigo-900 mb-6 flex items-center gap-2">
              <CheckCircle className="text-indigo-500" /> Action Required
              {(pendingRedemptions.length + pendingTasks.length) > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">{pendingRedemptions.length + pendingTasks.length}</span>
              )}
            </h2>
            {(pendingRedemptions.length === 0 && pendingTasks.length === 0) ? (
              <div className="text-center text-indigo-300 py-6 flex flex-col items-center gap-2">
                <CheckCircle size={40} className="opacity-50" />
                <p className="font-bold text-sm">All caught up!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 max-h-80 overflow-y-auto pr-2 hide-scrollbar">
                <AnimatePresence>
                  {pendingTasks.map(task => {
                    const kid = profiles.find(p => p.id === task.assigneeId);
                    return (
                      <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-100 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-400" />
                        <p className="text-xs font-bold text-emerald-500 mb-1">Quest Approval</p>
                        <p className="text-slate-800 font-bold mb-1"><span className="text-emerald-600">{kid?.name || 'A child'}</span> finished:</p>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="text-3xl bg-slate-50 p-2 rounded-xl">{task.icon}</div>
                          <p className="text-lg font-black text-slate-800 leading-tight">{task.title}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleApproveTask(task)} className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-1"><Check size={16} strokeWidth={3} /> Approve</button>
                          <button onClick={() => handleRejectTask(task.id)} className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-1"><X size={16} strokeWidth={3} /> Reject</button>
                        </div>
                      </motion.div>
                    );
                  })}
                  {pendingRedemptions.map(req => (
                    <motion.div key={req.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-100 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-indigo-400" />
                      <p className="text-xs font-bold text-indigo-400 mb-1">Reward Request • {req.date}</p>
                      <p className="text-slate-800 font-bold mb-1"><span className="text-indigo-600">{req.kidName}</span> wants:</p>
                      <p className="text-lg font-black text-slate-800 flex items-center justify-between">
                        {req.rewardTitle}
                        <span className="text-sm bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg flex items-center gap-1"><Star size={12} className="fill-yellow-500" /> {req.cost}</span>
                      </p>
                      <button onClick={() => handleApproveRedemption(req.id)} className="w-full mt-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-2"><Check size={18} strokeWidth={3} /> Mark as Given</button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
         </div>

         {/* Active Store List */}
         <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex-1 flex flex-col">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><StoreIcon className="text-slate-400" size={24} /> Active Store Items</h2>
            <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-2 hide-scrollbar">
              {rewards.length === 0 ? (
                <p className="text-slate-400 font-medium text-center py-4">No rewards in store.</p>
              ) : (
                rewards.map(reward => (
                  <div key={reward.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100 group">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${reward.color}`}>{reward.icon}</div>
                      <div>
                        <p className="font-bold text-slate-700 text-sm">{reward.title}</p>
                        <p className="text-xs font-bold text-slate-400 flex items-center gap-1"><Star size={10} className="fill-yellow-400 text-yellow-400" /> {reward.cost}</p>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteReward(reward.id)} className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="Remove Reward"><Trash2 size={18} /></button>
                  </div>
                ))
              )}
            </div>
         </div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [currentView, setCurrentView] = useState('home');
  const [showCelebration, setShowCelebration] = useState(false);

  // Initialize Auth - using the required standard environment variable format
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth init failed:", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthChecking(false);
    });

    return () => unsubscribe();
  }, []);

  const familyData = useFamilyData(user);

  if (authChecking || familyData.loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-500 rounded-full" />
      </div>
    );
  }

  return (
    <FamilyContext.Provider value={familyData}>
      <div className="min-h-screen bg-slate-50 font-sans flex text-slate-800 overflow-hidden selection:bg-indigo-100">
        
        <Sidebar currentView={currentView} setCurrentView={setCurrentView} />

        <main className="flex-1 h-screen overflow-y-auto px-8 py-8 relative">
          
          {/* Top Bar for Kid Selector - Not shown on home/parents/calendar */}
          {currentView !== 'parents' && currentView !== 'calendar' && currentView !== 'home' && (
            <div className="mb-10 max-w-5xl mx-auto flex items-center justify-between">
              <KidSelector />
            </div>
          )}

          <motion.div key={currentView} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="h-full">
            {currentView === 'home' && <HomeView setCurrentView={setCurrentView} setActiveKidId={familyData.setActiveKidId} />}
            {currentView === 'dashboard' && <DashboardView triggerCelebration={() => setShowCelebration(true)} />}
            {currentView === 'rewards' && <RewardsView />}
            {currentView === 'calendar' && <CalendarView />}
            {currentView === 'parents' && <ParentsView />}
          </motion.div>

        </main>
        
        <CelebrationOverlay show={showCelebration} onComplete={() => setShowCelebration(false)} />
      
      </div>
    </FamilyContext.Provider>
  );
}
