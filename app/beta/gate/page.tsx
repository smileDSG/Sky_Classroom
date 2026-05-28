import { InviteGate } from '@/components/beta/invite-gate';

export const metadata = {
  title: '邀请码 - 天空课堂 Beta',
  description: '输入邀请码以访问天空课堂内测版',
};

export default function BetaGatePage() {
  return <InviteGate />;
}
