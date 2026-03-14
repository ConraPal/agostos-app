// ===== App Bootstrap =====
document.addEventListener('DOMContentLoaded', () => {

  // --- Tabs (scoped to parent module) ---
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      const module = tab.closest('.module');
      module.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      module.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      module.querySelector(`#tab-${target}`)?.classList.add('active');
    });
  });

  // --- Module routing (sidebar) ---
  const pageTitle = document.getElementById('page-title');
  const moduleTitles = { livestock: 'Hacienda', finance: 'Finanzas' };
  const moduleButtons = {
    livestock: document.getElementById('btn-new-animal'),
    finance:   document.getElementById('btn-new-transaction'),
  };

  document.querySelectorAll('.nav-item:not(.disabled)').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const mod = item.dataset.module;
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
      item.classList.add('active');
      document.getElementById(`module-${mod}`)?.classList.add('active');

      if (pageTitle && moduleTitles[mod]) pageTitle.textContent = moduleTitles[mod];

      Object.entries(moduleButtons).forEach(([key, btn]) => {
        if (!btn) return;
        btn.classList.toggle('hidden', key !== mod);
      });
    });
  });

  // --- Init modules ---
  Livestock.init();
  Finance.init();
});
