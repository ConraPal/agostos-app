// ===== Storage — Supabase + localStorage fallback =====
const Storage = (() => {
  const SUPABASE_URL = 'https://zetsiitizxrtgmlkkuqo.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_523LtrIKkd9BUf8DL9J7_g_xo8WpRDO';

  // Keys that stay local-only (UI preferences, not shared data)
  const LOCAL_ONLY = new Set(['ag_dark_mode']);

  // All data keys (used for localStorage migration)
  const DATA_KEYS = [
    'ag_animals', 'ag_movements', 'ag_history', 'ag_reproduction',
    'ag_transactions', 'ag_amortizations',
    'ag_fields', 'ag_crop_history', 'ag_forraje'
  ];

  let sb = null;
  const cache = {};
  let useSupabase = false;

  async function init() {
    try {
      sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

      const { data, error } = await sb.from('app_data').select('key, value');
      if (error) throw error;

      useSupabase = true;

      if (data.length === 0) {
        // Primera vez: migrar datos existentes de localStorage
        await _migrateFromLocalStorage();
      } else {
        data.forEach(row => { cache[row.key] = row.value; });
      }

      return true;
    } catch (err) {
      console.warn('Supabase no disponible, usando localStorage:', err.message);
      useSupabase = false;
      // Cargar localStorage al cache como fallback
      DATA_KEYS.forEach(key => {
        try {
          const raw = localStorage.getItem(key);
          if (raw) cache[key] = JSON.parse(raw);
        } catch {}
      });
      return false;
    }
  }

  async function _migrateFromLocalStorage() {
    const rows = [];
    DATA_KEYS.forEach(key => {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const value = JSON.parse(raw);
          if (Array.isArray(value) && value.length > 0) {
            cache[key] = value;
            rows.push({ key, value });
          }
        }
      } catch {}
    });

    if (rows.length === 0) return;

    const { error } = await sb.from('app_data').upsert(rows);
    if (error) {
      console.error('Error migrando a Supabase:', error);
    } else {
      console.log(`Migrados ${rows.length} registros de localStorage a Supabase`);
    }
  }

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
    if (useSupabase && sb) {
      sb.from('app_data').upsert({ key, value }).then(({ error }) => {
        if (error) console.error('Error escribiendo en Supabase:', error);
      });
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  function remove(key) {
    delete cache[key];
    if (useSupabase && sb) {
      sb.from('app_data').delete().eq('key', key).then(({ error }) => {
        if (error) console.error('Error eliminando de Supabase:', error);
      });
    } else {
      localStorage.removeItem(key);
    }
  }

  return { init, get, set, remove };
})();
