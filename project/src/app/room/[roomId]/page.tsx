export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import Room from '../../pages/Room';

export default function Page() {
  return (
    <Suspense fallback={<div>Loading room...</div>}>
      <Room />
    </Suspense>
  );
}
