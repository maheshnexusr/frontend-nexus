/**
 * useFormulaTemplates — load + manage the user's saved formula templates.
 *
 * Saved templates come from the backend (per-sponsor + shared). They're cached
 * at module scope so every Formula Builder / column editor on the page shares
 * one fetch; mutations update the cache and notify all subscribers so the
 * library picker refreshes immediately after a save/delete.
 *
 * Returns the templates already shaped like the built-in registry entries
 * (id, name, category, inputs, expression, outputType, precision) so they can be
 * merged straight into FormulaTemplateMapper.
 */
import { useEffect, useState } from 'react';
import { formulaTemplatesClient } from '@/features/cro/api/formulaTemplatesClient';

let cache = null;            // null = not loaded yet
let inFlight = null;
const subscribers = new Set();

const notify = () => subscribers.forEach((fn) => fn(cache));

async function loadOnce(force = false) {
  if (cache && !force) return cache;
  if (inFlight && !force) return inFlight;
  inFlight = formulaTemplatesClient.list()
    .then((items) => { cache = items; inFlight = null; notify(); return items; })
    .catch((e) => { inFlight = null; if (!cache) cache = []; notify(); throw e; });
  return inFlight;
}

export function useFormulaTemplates() {
  const [templates, setTemplates] = useState(cache || []);

  useEffect(() => {
    const sub = (next) => setTemplates(next || []);
    subscribers.add(sub);
    if (cache) setTemplates(cache);
    else loadOnce().catch(() => {});
    return () => subscribers.delete(sub);
  }, []);

  const saveTemplate = async (data) => {
    const saved = await formulaTemplatesClient.save(data);
    cache = [saved, ...(cache || []).filter((t) => t.id !== saved.id)];
    notify();
    return saved;
  };

  const removeTemplate = async (id) => {
    await formulaTemplatesClient.remove(id);
    cache = (cache || []).filter((t) => t.id !== id);
    notify();
  };

  return { userTemplates: templates, reload: () => loadOnce(true), saveTemplate, removeTemplate };
}

export default useFormulaTemplates;
