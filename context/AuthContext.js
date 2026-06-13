import { createContext, useContext, useState, useEffect } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signUp = async (email, password, name) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName: name });
    return result.user;
  };

  const signIn = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

  const logout = () => signOut(auth);

  const getIdToken = () => auth.currentUser?.getIdToken();

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, logout, getIdToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
