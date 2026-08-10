'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase, supabaseConfigurado } from '../lib/supabase';

const LINKS = [
  { href: '/',              label: 'Panel',          icon: '📊' },
  { href: '/ventas',        label: 'Ventas diarias', icon: '💵' },
  { href: '/gastos',        label: 'Gastos',         icon: '🧾' },
  { href: '/reporte',       label: 'Reporte semanal',icon: '📄' },
  { href: '/objetivos',     label: 'Objetivos',      icon: '🎯' },
  { href: '/colaboradores', label: 'Colaboradores',  icon: '👥' },
  { href: '/bonos',         label: 'Bonos',          icon: '🏆' },
  { href: '/nomina',        label: 'Nómina',         icon: '💰' },
  { href: '/sucursales',    label: 'Sucursales',     icon: '🏬' },
  { href: '/configuracion', label: 'Configuración',  icon: '⚙️' },
];

export default function Shell({ children }) {
  const pathname = usePathname();
  const [sesion, setSesion] = useState(undefined); // undefined = cargando
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [msg, setMsg] = useState('');
  const [modo, setModo] = useState('login');

  useEffect(() => {
    if (!supabaseConfigurado) { setSesion(null); return; }
    supabase.auth.getSession().then(({ data }) => setSesion(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function entrar(e) {
    e.preventDefault(); setMsg('');
    const fn = modo === 'login'
      ? supabase.auth.signInWithPassword({ email, password: pass })
      : supabase.auth.signUp({ email, password: pass });
    const { error } = await fn;
    if (error) setMsg(error.message);
    else if (modo === 'signup') setMsg('Cuenta creada. Ya puedes iniciar sesión.');
  }

  // --- Sin configurar Supabase ---
  if (!supabaseConfigurado) {
    return (
      <div className="center-screen">
        <div className="card login">
          <h2>Falta configurar Supabase</h2>
          <p className="muted">Crea un archivo <code>.env.local</code> con tus llaves
          (<code>NEXT_PUBLIC_SUPABASE_URL</code> y <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>)
          y vuelve a cargar. Revisa el README para los pasos.</p>
        </div>
      </div>
    );
  }

  // --- Cargando sesión ---
  if (sesion === undefined) {
    return <div className="center-screen"><span className="muted">Cargando…</span></div>;
  }

  // --- Login ---
  if (!sesion) {
    return (
      <div className="center-screen">
        <form className="card login" onSubmit={entrar}>
          <div className="brand"><img src="/logo.png" className="brand-logo" alt="Logo" /> Ventas por Sucursal</div>
          <p className="muted" style={{marginTop:0}}>
            {modo === 'login' ? 'Inicia sesión para continuar' : 'Crea tu cuenta de administrador'}
          </p>
          <div style={{margin:'12px 0'}}>
            <label>Correo</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
          </div>
          <div style={{margin:'12px 0'}}>
            <label>Contraseña</label>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} required minLength={6} />
          </div>
          {msg && <p className="hint" style={{color:'#fca5a5'}}>{msg}</p>}
          <button className="btn" style={{width:'100%'}} type="submit">
            {modo === 'login' ? 'Entrar' : 'Registrarme'}
          </button>
          <p className="hint" style={{textAlign:'center',marginTop:14,cursor:'pointer'}}
             onClick={()=>{setModo(modo==='login'?'signup':'login');setMsg('');}}>
            {modo === 'login' ? '¿No tienes cuenta? Crear una' : '¿Ya tienes cuenta? Iniciar sesión'}
          </p>
        </form>
      </div>
    );
  }

  // --- App autenticada ---
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand"><img src="/logo.png" className="brand-logo" alt="Logo" /> <span>Ventas<small>Panel administrativo</small></span></div>
        <nav className="nav">
          {LINKS.map(l => (
            <Link key={l.href} href={l.href} className={pathname === l.href ? 'active' : ''}>
              <span>{l.icon}</span><span>{l.label}</span>
            </Link>
          ))}
        </nav>
        <div style={{marginTop:18,padding:'0 8px'}}>
          <p className="hint" style={{marginBottom:8}}>{sesion.user.email}</p>
          <button className="btn ghost sm" onClick={()=>supabase.auth.signOut()}>Cerrar sesión</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
