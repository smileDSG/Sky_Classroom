import { SpotlightTour } from '@/components/sky/tour/spotlight-tour';
import { PROFILE_TOUR_SEEN_KEY, PROFILE_TOUR_STEPS } from '@/lib/sky/profile-tour';

export function ProfileTour() {
  return <SpotlightTour steps={PROFILE_TOUR_STEPS} seenKey={PROFILE_TOUR_SEEN_KEY} />;
}
