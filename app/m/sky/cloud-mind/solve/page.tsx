import { MobileSkyFrame } from '@/components/mobile/mobile-sky-frame';
import { MobileSkyShell } from '@/components/mobile/shell/mobile-sky-shell';

export default function MobileSkyMirrorPage() {
  return (
    <MobileSkyShell backHref="/m/sky/cloud-mind">
      <div className="flex flex-1 flex-col overflow-hidden">
        <MobileSkyFrame src="/sky/cloud-mind/solve" fitContainer />
      </div>
    </MobileSkyShell>
  );
}
