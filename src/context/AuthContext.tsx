// src/context/AuthContext.tsx
"use client";
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { auth, firestore } from "../lib/firebase";
import {
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { UserProfile, UserRole, UserStatus } from "../types";
import { auditService } from "../services/auditService";

interface AuthContextProps {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isOwner: boolean;
  isActive: boolean;
  isDisabled: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserStatus: (targetUid: string, status: UserStatus) => Promise<void>;
  updateUserRole: (targetUid: string, role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Middleware verifies this signed token before allowing protected routes.
        if (typeof document !== "undefined") {
          const idToken = await firebaseUser.getIdToken();
          const secure = window.location.protocol === "https:" ? "; Secure" : "";
          document.cookie = `auth=${encodeURIComponent(idToken)}; path=/; max-age=3600; SameSite=Lax${secure}`;
        }
        try {
          const docRef = doc(firestore, "users", firebaseUser.uid);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            const updatedProfile: UserProfile = {
              uid: data.uid || firebaseUser.uid,
              name: data.name || firebaseUser.displayName || "",
              email: data.email || firebaseUser.email || "",
              role: data.role || "staff",
              status: data.status || "active",
              createdAt: data.createdAt || new Date().toISOString(),
              updatedAt: data.updatedAt,
            };
            setProfile(updatedProfile);
          } else {
            // New user without document yet
            const defaultProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Staff User",
              email: firebaseUser.email || "",
              role: "staff",
              status: "active",
              createdAt: firebaseUser.metadata.creationTime || new Date().toISOString(),
            };
            await setDoc(docRef, defaultProfile);
            setProfile(defaultProfile);
          }
        } catch (err) {
          console.warn("Could not load user profile from Firestore:", err);
          setProfile({
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.email || "Staff User",
            email: firebaseUser.email || "",
            role: "staff",
            status: "active",
            createdAt: new Date().toISOString(),
          });
        }
      } else {
        setProfile(null);
        // Clear cookie
        if (typeof document !== "undefined") {
          document.cookie = "auth=; path=/; max-age=0";
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    auditService.log("LOGIN", "user", cred.user.uid, `User ${email} logged in`, {
      uid: cred.user.uid,
      name: cred.user.displayName || email,
      email,
    });
  };

  const register = async (name: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;
    const now = new Date().toISOString();

    // Public registration strictly creates staff role with active status
    const userDoc: UserProfile = {
      uid,
      name,
      email,
      role: "staff",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    try {
      await setDoc(doc(firestore, "users", uid), userDoc);
    } catch (e) {
      console.warn("Failed to set user profile in Firestore:", e);
    }

    setProfile(userDoc);
    auditService.log("LOGIN", "user", uid, `New user ${name} (${email}) registered as staff`, {
      uid,
      name,
      email,
    });
  };

  const logout = async () => {
    if (user) {
      auditService.log("LOGOUT", "user", user.uid, `User ${user.email} logged out`, {
        uid: user.uid,
        name: profile?.name || user.email || "User",
        email: user.email || "",
      });
    }
    await signOut(auth);
    setProfile(null);
  };

  const updateUserStatus = async (targetUid: string, newStatus: UserStatus) => {
    if (profile?.role !== "owner") {
      throw new Error("Only an owner can update user status");
    }
    if (targetUid === profile.uid && newStatus === "disabled") {
      throw new Error("You cannot disable your own owner account");
    }

    const docRef = doc(firestore, "users", targetUid);
    const now = new Date().toISOString();
    await updateDoc(docRef, { status: newStatus, updatedAt: now });

    await auditService.log(
      newStatus === "disabled" ? "STAFF_DISABLED" : "STAFF_REACTIVATED",
      "user",
      targetUid,
      `Owner ${profile.name} changed status of user ${targetUid} to ${newStatus}`,
      { uid: profile.uid, name: profile.name, email: profile.email }
    );
  };

  const updateUserRole = async (targetUid: string, newRole: UserRole) => {
    if (profile?.role !== "owner") {
      throw new Error("Only an owner can update user roles");
    }
    if (targetUid === profile.uid && newRole !== "owner") {
      throw new Error("You cannot demote your own owner account");
    }

    const docRef = doc(firestore, "users", targetUid);
    const now = new Date().toISOString();
    await updateDoc(docRef, { role: newRole, updatedAt: now });

    await auditService.log(
      "STAFF_ROLE_CHANGED",
      "user",
      targetUid,
      `Owner ${profile.name} changed role of user ${targetUid} to ${newRole}`,
      { uid: profile.uid, name: profile.name, email: profile.email }
    );
  };

  const isOwner = profile?.role === "owner";
  const isActive = profile?.status === "active";
  const isDisabled = profile?.status === "disabled";

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isOwner,
        isActive,
        isDisabled,
        login,
        register,
        logout,
        updateUserStatus,
        updateUserRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
