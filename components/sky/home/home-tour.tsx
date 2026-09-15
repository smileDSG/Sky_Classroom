import { SpotlightTour } from '@/components/sky/tour/spotlight-tour';
import { HOME_TOUR_SEEN_KEY, HOME_TOUR_STEPS } from '@/lib/sky/home-tour';

export function HomeTour() {
  return <SpotlightTour steps={HOME_TOUR_STEPS} seenKey={HOME_TOUR_SEEN_KEY} />;
}
