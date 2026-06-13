/**
 * formulaTemplatesClient — saved (custom) formula templates master.
 *
 * `inputs` is sent as a JSON string so the axios request interceptor's
 * camelCase→snake_case transform doesn't rewrite the nested keys; the server
 * stores it verbatim and returns it as a parsed array (camelCase preserved).
 */
import axiosClient from '@/api/axiosClient';

const BASE = '/api/v1/masters/formula-templates';

function normalize(raw) {
  return {
    id:          raw.template_id ?? raw.id,
    name:        raw.name ?? '',
    category:    raw.category ?? 'Custom',
    description: raw.description ?? '',
    inputs:      Array.isArray(raw.inputs) ? raw.inputs : [],
    expression:  raw.expression ?? '',
    outputType:  raw.output_type ?? raw.outputType ?? 'number',
    precision:   raw.precision ?? 2,
    createdBy:   raw.created_by ?? raw.createdBy ?? null,
    createdByName: raw.created_by_name ?? raw.createdByName ?? null,
    createdAt:   raw.created_at ?? raw.createdAt,
  };
}

const extractList = (res) => {
  const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
  return arr.map(normalize);
};

const toPayload = (data) => ({
  name: data.name,
  category: data.category ?? 'Custom',
  description: data.description ?? '',
  inputs: JSON.stringify(Array.isArray(data.inputs) ? data.inputs : []),
  expression: data.expression,
  outputType: data.outputType ?? 'number',
  precision: data.precision ?? 2,
  createdByName: data.createdByName ?? null,
});

export const formulaTemplatesClient = {
  async list() {
    const res = await axiosClient.get(BASE);
    return extractList(res);
  },
  async save(data) {
    const res = await axiosClient.post(BASE, toPayload(data));
    return normalize(res?.item ?? res);
  },
  async update(id, data) {
    const res = await axiosClient.put(`${BASE}/${id}`, toPayload(data));
    return normalize(res?.item ?? res);
  },
  async remove(id) {
    await axiosClient.delete(`${BASE}/${id}`);
    return id;
  },
};

export default formulaTemplatesClient;
