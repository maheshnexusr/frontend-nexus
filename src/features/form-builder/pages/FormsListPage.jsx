import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Pencil, Trash2, Calendar } from 'lucide-react';
import { base44 } from '@/features/form-builder/api/formsClient';
import s from './FormsListPage.module.css';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Forms() {
  const navigate = useNavigate();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    base44.entities.Form.list('-created_date').then((data) => {
      setForms(data);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const handleDelete = (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Delete this form?')) return;
    base44.entities.Form.delete(id).then(load);
  };

  const statusClass = { draft: s.badgeDraft, published: s.badgePublished, archived: s.badgeArchived };

  return (
    <div className={s.page}>
      <div className={s.container}>
        <div className={s.header}>
          <div className={s.headerText}>
            <h1>EDC Forms</h1>
            <p>Build and manage your electronic data capture forms</p>
          </div>
          <button className={s.btnPrimary} onClick={() => navigate('/cro/forms/new')}>
            <Plus size={15} /> New Form
          </button>
        </div>

        {loading ? (
          <div className={s.skeletonGrid}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={s.skeletonCard}>
                <div className={s.skeletonLine} style={{ width: '70%' }} />
                <div className={s.skeletonLine} style={{ width: '40%' }} />
              </div>
            ))}
          </div>
        ) : forms.length === 0 ? (
          <div className={s.empty}>
            <div className={s.emptyIcon}><FileText size={24} /></div>
            <h3>No forms yet</h3>
            <p>Create your first EDC form to get started</p>
            <button className={s.btnPrimary} style={{ margin: '0 auto' }} onClick={() => navigate('/cro/forms/new')}>
              <Plus size={15} /> Create Form
            </button>
          </div>
        ) : (
          <div className={s.grid}>
            {forms.map((form) => (
              <div key={form.id} className={s.card} onClick={() => navigate(`/cro/forms/${form.id}`)}>
                <div className={s.cardTop}>
                  <div className={s.cardTitle}>{form.title || 'Untitled Form'}</div>
                  <span className={`${s.badge} ${statusClass[form.status] || s.badgeDraft}`}>
                    {form.status || 'draft'}
                  </span>
                </div>
                <div className={s.cardMeta}>
                  <span className={s.metaItem}><FileText size={13} /> {form.fields?.length || 0} fields</span>
                  <span className={s.metaItem}><Calendar size={13} /> {formatDate(form.created_date)}</span>
                </div>
                <div className={s.cardActions}>
                  <button className={s.btnOutline} onClick={(e) => { e.stopPropagation(); navigate(`/cro/forms/${form.id}`); }}>
                    <Pencil size={12} /> Edit
                  </button>
                  <button className={`${s.btnOutline} ${s.btnDanger}`} onClick={(e) => handleDelete(e, form.id)}>
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
