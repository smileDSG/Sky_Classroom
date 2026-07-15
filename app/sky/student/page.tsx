import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { StudentProfilePage } from './student-profile-page';

export default function StudentProfileRoute() {
  return (
    <SkyAppShell>
      <StudentProfilePage />
    </SkyAppShell>
  );
}
