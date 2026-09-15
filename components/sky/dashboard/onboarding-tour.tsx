import { SpotlightTour } from '@/components/sky/tour/spotlight-tour';
import { TOUR_SEEN_KEY, TOUR_STEPS } from '@/lib/sky/tour';

export function OnboardingTour() {
  return <SpotlightTour steps={TOUR_STEPS} seenKey={TOUR_SEEN_KEY} />;
}
