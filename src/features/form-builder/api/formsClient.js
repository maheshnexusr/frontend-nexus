const STORAGE_KEY = 'edc_forms';

const getForms = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
};

const saveForms = (forms) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(forms));
};

const generateId = () => `form_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export const base44 = {
  entities: {
    Form: {
      list: (sortField = '-created_date') => {
        const desc = sortField.startsWith('-');
        const field = desc ? sortField.slice(1) : sortField;
        const sorted = [...getForms()].sort((a, b) => {
          const av = a[field] || '';
          const bv = b[field] || '';
          if (av < bv) return desc ? 1 : -1;
          if (av > bv) return desc ? -1 : 1;
          return 0;
        });
        return Promise.resolve(sorted);
      },
      filter: (criteria) => {
        const results = getForms().filter((f) =>
          Object.entries(criteria).every(([k, v]) => f[k] === v)
        );
        return Promise.resolve(results);
      },
      create: (data) => {
        const forms = getForms();
        const form = { ...data, id: generateId(), created_date: new Date().toISOString() };
        forms.push(form);
        saveForms(forms);
        return Promise.resolve(form);
      },
      update: (id, data) => {
        const forms = getForms();
        const idx = forms.findIndex((f) => f.id === id);
        if (idx === -1) return Promise.reject(new Error('Form not found'));
        forms[idx] = { ...forms[idx], ...data };
        saveForms(forms);
        return Promise.resolve(forms[idx]);
      },
      delete: (id) => {
        saveForms(getForms().filter((f) => f.id !== id));
        return Promise.resolve();
      },
    },
  },
};
