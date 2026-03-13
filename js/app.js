// ===== App Bootstrap =====
document.addEventListener('DOMContentLoaded', () => {

  // --- Tabs ---
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${target}`).classList.add('active');
    });
  });

  // --- Module routing (sidebar) ---
  document.querySelectorAll('.nav-item:not(.disabled)').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const module = item.dataset.module;
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
      item.classList.add('active');
      document.getElementById(`module-${module}`)?.classList.add('active');
    });
  });

  // --- Init modules ---
  Livestock.init();
});
