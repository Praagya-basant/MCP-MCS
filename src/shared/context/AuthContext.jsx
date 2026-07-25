import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { shortenBuyerName } from '@/shared/utils/formatters';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*, hall:halls(id, hall_number), buyer:buyers(id, name)')
      .eq('id', userId)
      .single();

    if (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load profile', error);
      setProfile(null);
      return;
    }
    setProfile(data.buyer ? { ...data, buyer: { ...data.buyer, name: shortenBuyerName(data.buyer.name) } } : data);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      if (session?.user) await loadProfile(session.user.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        await loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? null,
    loading,
    signIn,
    signOut,
    refreshProfile: () => loadProfile(session?.user?.id),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
