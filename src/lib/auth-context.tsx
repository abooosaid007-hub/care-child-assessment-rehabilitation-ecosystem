import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "administrator"
  | "psychologist"
  | "teacher"
  | "speech_therapist"
  | "parent";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole;
  active: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchProfile(userId: string): Promise<{ profile: Profile | null; error: string | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, active")
    .eq("id", userId)
    .maybeSingle();
  if (error) return { profile: null, error: error.message };
  if (!data) return { profile: null, error: "Account setup incomplete — contact administrator." };
  return { profile: data as Profile, error: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Defer to avoid deadlock
        setTimeout(() => {
          fetchProfile(newSession.user.id).then(({ profile, error }) => {
            setProfile(profile);
            setProfileError(error);
          });
        }, 0);
      } else {
        setProfile(null);
        setProfileError(null);
      }
    });

    // Then load existing session
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        fetchProfile(existing.user.id).then(({ profile, error }) => {
          setProfile(profile);
          setProfileError(error);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (!user) return;
    const { profile, error } = await fetchProfile(user.id);
    setProfile(profile);
    setProfileError(error);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, profile, loading, profileError, refreshProfile, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function dashboardPathForRole(role: AppRole): string {
  switch (role) {
    case "administrator":
      return "/admin";
    case "psychologist":
      return "/psychologist";
    case "teacher":
    case "speech_therapist":
      return "/teacher";
    case "parent":
      return "/parent";
    default:
      return "/";
  }
}
