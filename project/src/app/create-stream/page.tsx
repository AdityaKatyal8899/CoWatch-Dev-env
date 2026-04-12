export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import CreateStream from '../pages/CreateStream';

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CreateStream />
    </Suspense>
  );
}
