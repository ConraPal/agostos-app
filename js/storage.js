// ===== Storage — Supabase + localStorage fallback =====
const Storage = (() => {
  const SUPABASE_URL = 'https://zetsiitizxrtgmlkkuqo.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_523LtrIKkd9BUf8DL9J7_g_xo8WpRDO';

  // Keys that stay local-only (UI preferences, not shared data)
  const LOCAL_ONLY = new Set(['ag_dark_mode']);

  // All data keys (used for localStorage migration)
  const DATA_KEYS = [
    'ag_animals', 'ag_movements', 'ag_history', 'ag_reproduction', 'ag_sanidad',
    'ag_transactions', 'ag_amortizations', 'ag_presupuesto',
    'ag_fields', 'ag_crop_history', 'ag_forraje',
    'ag_alertas'
  ];

  let sb = null;
  const cache = {};
  let useSupabase = false;
  let currentUser = null;

  // --- Conecta a Supabase y verifica sesión activa ---
  // Retorna { needsAuth: true } si no hay usuario logueado
  async function init() {
    try {
      sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        useSupabase = true; // cliente OK pero sin sesión
        return { needsAuth: true };
      }

      currentUser = user;
      await _loadUserData();
      return { needsAuth: false };

    } catch (err) {
      console.warn('Supabase no disponible, usando localStorage:', err.message);
      useSupabase = false;
      DATA_KEYS.forEach(key => {
        try {
          const raw = localStorage.getItem(key);
          if (raw) cache[key] = JSON.parse(raw);
        } catch {}
      });
      return { needsAuth: false };
    }
  }

  // --- Carga los datos del usuario autenticado desde Supabase ---
  async function _loadUserData() {
    Object.keys(cache).forEach(k => delete cache[k]);
    const { data, error } = await sb.from('app_data').select('key, value').eq('user_id', currentUser.id);
    if (error) throw error;
    useSupabase = true;
    if (data.length === 0) {
      await _migrateFromLocalStorage();
    } else {
      data.forEach(row => { cache[row.key] = row.value; });
    }
  }

  // --- Migra arrays existentes de localStorage a Supabase (one-time) ---
  async function _migrateFromLocalStorage() {
    const rows = [];
    DATA_KEYS.forEach(key => {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const value = JSON.parse(raw);
          if (Array.isArray(value) && value.length > 0) {
            cache[key] = value;
            rows.push({ key, value, user_id: currentUser.id });
          }
        }
      } catch {}
    });
    if (rows.length === 0) return;
    const { error } = await sb.from('app_data').upsert(rows);
    if (error) console.error('Error migrando a Supabase:', error);
    else console.log(`Migrados ${rows.length} registros de localStorage a Supabase`);
  }

  // --- Auth ---
  async function login(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentUser = data.user;
    await _loadUserData();
  }

  async function logout() {
    await sb.auth.signOut();
    currentUser = null;
    Object.keys(cache).forEach(k => delete cache[k]);
  }

  function getUser() { return currentUser; }

  // --- CRUD ---
  function get(key, fallback = null) {
    if (LOCAL_ONLY.has(key)) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch { return fallback; }
    }
    return key in cache ? cache[key] : fallback;
  }

  function set(key, value) {
    if (LOCAL_ONLY.has(key)) {
      localStorage.setItem(key, JSON.stringify(value));
      return;
    }
    cache[key] = value;
    if (useSupabase && sb && currentUser) {
      sb.from('app_data').upsert({ key, value, user_id: currentUser.id }).then(({ error }) => {
        if (error) {
          console.error('Error escribiendo en Supabase:', error);
          if (typeof ui !== 'undefined') ui.toast('Error al guardar en la nube.', 'error');
        }
      });
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  function remove(key) {
    delete cache[key];
    if (useSupabase && sb && currentUser) {
      sb.from('app_data').delete().eq('key', key).eq('user_id', currentUser.id).then(({ error }) => {
        if (error) console.error('Error eliminando de Supabase:', error);
      });
    } else {
      localStorage.removeItem(key);
    }
  }

  return { init, login, logout, getUser, get, set, remove };
})();
