import { Page } from '../components/Page';
import { ChallengeList } from '../features/challenges/ChallengeList';
import { HomeHeader } from '../features/challenges/HomeHeader';

export function HomePage() {
  return (
    <Page>
      <HomeHeader />
      <ChallengeList />
    </Page>
  );
}
