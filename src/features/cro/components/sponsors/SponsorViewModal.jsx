import { useNavigate } from 'react-router-dom';
import { Pencil, Mail, Phone, Building2, Globe, MapPin, Hash } from 'lucide-react';
import Modal       from '@/components/feedback/Modal';
import StatusBadge from '@/components/feedback/StatusBadge';
import styles from './SponsorViewModal.module.css';

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function Avatar({ photo, name }) {
  if (photo) return <img src={photo} alt={name} className={styles.photo} />;
  const initials = (name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return <div className={styles.photoInitials}>{initials}</div>;
}

export default function SponsorViewModal({ sponsor, onClose }) {
  const navigate = useNavigate();
  if (!sponsor) return null;

  const addressParts = [
    sponsor.addressLine1, sponsor.addressLine2,
    sponsor.city, sponsor.district, sponsor.state,
    sponsor.zipcode, sponsor.countryName,
  ].filter(Boolean);

  const footer = (
    <>
      <button className={styles.btnClose} onClick={onClose} type="button">Close</button>
      <button
        className={styles.btnEdit}
        onClick={() => { onClose(); navigate(`/cro/sponsors/${sponsor.id}`); }}
        type="button"
      >
        <Pencil size={14} />
        Edit Sponsor
      </button>
    </>
  );

  return (
    <Modal open onClose={onClose} title="Sponsor Details" size="md" footer={footer}>
      <div className={styles.body}>

        {/* Profile header */}
        <div className={styles.profileHead}>
          <Avatar photo={sponsor.photograph} name={sponsor.fullName} />
          <div>
            <h3 className={styles.name}>{sponsor.fullName}</h3>
            <p className={styles.orgName}>{sponsor.organizationName}</p>
            <StatusBadge status={sponsor.status} />
          </div>
        </div>

        {/* Details grid */}
        <div className={styles.grid}>
          <DetailRow icon={<Mail size={14} />}     label="Email"               value={sponsor.email} />
          <DetailRow icon={<Phone size={14} />}    label="Contact Number"      value={sponsor.contactNumber} />
          <DetailRow icon={<Hash size={14} />}     label="Registration Number" value={sponsor.registrationNumber} />
          {sponsor.website && (
            <DetailRow icon={<Globe size={14} />}  label="Website"
              value={<a href={sponsor.website} target="_blank" rel="noreferrer" className={styles.link}>{sponsor.website}</a>}
            />
          )}
          {addressParts.length > 0 && (
            <DetailRow icon={<MapPin size={14} />} label="Address" value={addressParts.join(', ')} />
          )}
          <DetailRow icon={<Building2 size={14} />} label="Created" value={fmt(sponsor.createdAt)} />
        </div>
      </div>
    </Modal>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailIcon}>{icon}</span>
      <span className={styles.detailLabel}>{label}</span>
      <span className={styles.detailValue}>{value || '—'}</span>
    </div>
  );
}
