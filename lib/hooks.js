'use client';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { DEFAULT_CONFIG } from './calculos';

export function useSucursales() {
  const [sucursales, setSucursales] = useState([]);
  const [cargando, setCargando] = useState(true);
  async function recargar() {
    // Solo sucursales activas para los selectores de toda la app
    const { data } = await supabase.from('sucursales').select('*').eq('activa', true).order('nombre');
    setSucursales(data || []); setCargando(false);
  }
  useEffect(() => { recargar(); }, []);
  return { sucursales, cargando, recargar };
}

export function useConfig() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  async function recargar() {
    const { data } = await supabase.from('config').select('*').eq('id', 1).single();
    if (data) setConfig(data);
  }
  useEffect(() => { recargar(); }, []);
  return { config, recargar, setConfig };
}
