import { useParams } from 'react-router-dom';
import SponsorForm   from '@/features/cro/components/sponsors/SponsorForm';

export default function SponsorEditPage() {
  const { sponsorId } = useParams();
  return <SponsorForm mode="edit" sponsorId={sponsorId} />;
}
