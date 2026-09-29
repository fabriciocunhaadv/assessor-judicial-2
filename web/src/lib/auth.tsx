import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Permission, Role } from "@shared/roles";
import { api } from "./api";
import { auth, authDisabled, googleProvider } from "./firebase";

export interface Perfil {
  uid: string;
  email: string;
  nome: string;
  role: Role;
  tenantId: string;
  permissoes: Permission[];
}

interface AuthState {
  carregando: boolean;
  firebaseUser: User | null;
  perfil: Perfil | null;
  erro: string | null;
  entrar(): Promise<void>;
  sair(): Promise<void>;
  pode(p: Permission): boolean;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregarPerfil = async () => {
    try {
      setPerfil(await api.get<Perfil>("/me"));
      setErro(null);
    } catch (e) {
      setPerfil(null);
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (authDisabled || !auth) {
      void carregarPerfil();
      return;
    }
    return onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
      if (u) void carregarPerfil();
      else {
        setPerfil(null);
        setCarregando(false);
      }
    });
  }, []);

  const value: AuthState = {
    carregando,
    firebaseUser,
    perfil,
    erro,
    async entrar() {
      if (auth) await signInWithPopup(auth, googleProvider);
    },
    async sair() {
      if (auth) await signOut(auth);
    },
    pode: (p) => !!perfil?.permissoes.includes(p),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth fora do AuthProvider");
  return v;
}
