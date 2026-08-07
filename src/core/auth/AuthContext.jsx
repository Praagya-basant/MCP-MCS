import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/core/lib/supabaseClient';
import { shortenBuyerName } from '@/core/utils/formatters';

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
      .select('*, hall:halls(id, hall_number, name), buyer:buyers(id, name)')
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

    // Deliberately NOT an async callback, and the profile query is
    // deferred via setTimeout rather than awaited inline — supabase-js
    // warns that calling its own methods synchronously inside
    // onAuthStateChange can deadlock the internal auth lock (most
    // visible as the session silently failing to rehydrate on reload,
    // since the callback never resolves). Deferring one tick sidesteps it.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession?.user) {
        setTimeout(() => {
          if (!mounted) return;
          loadProfile(newSession.user.id).finally(() => mounted && setLoading(false));
        }, 0);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // profiles_select's `id = auth.uid()` branch works regardless of
    // is_disabled (it has to, or a disabled user could never learn why
    // they're locked out) — checked here, right after auth succeeds, so a
    // disabled account never reaches the app shell even momentarily.
    const { data: profileRow } = await supabase.from('profiles').select('is_disabled').eq('id', data.user.id).single();
    if (profileRow?.is_disabled) {
      await supabase.auth.signOut();
      throw new Error('Your account has been disabled. Contact your administrator.');
    }

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
