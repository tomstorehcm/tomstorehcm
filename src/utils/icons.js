const ICONS = {
  'dien-thoai': '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2" stroke="currentColor" stroke-width="1.5"/><line x1="7" y1="18" x2="17" y2="18" stroke="currentColor" stroke-width="1.5"/></svg>',
  macbook: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="4" width="16" height="11" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M2 18h20l-1.5 2.5a1 1 0 0 1-.9.5H4.4a1 1 0 0 1-.9-.5L2 18Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  'may-tinh-bang': '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="18" x2="14" y2="18" stroke="currentColor" stroke-width="1.5"/></svg>',
  'tai-nghe': '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 13v-1a8 8 0 0 1 16 0v1" stroke="currentColor" stroke-width="1.5"/><rect x="2.5" y="13" width="5" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="16.5" y="13" width="5" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/></svg>'
};

const DEFAULT_ICON = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/><circle cx="8.5" cy="9" r="1.5" fill="currentColor"/><path d="M21 15l-5-5-9 9" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';

function categoryIcon(slug) {
  return ICONS[slug] || DEFAULT_ICON;
}

module.exports = { categoryIcon };
