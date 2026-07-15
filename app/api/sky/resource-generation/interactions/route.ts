import { NextRequest } from 'next/server';

import { getServerStorage } from '@/lib/server/server-storage';
import { createProfileSignalDAO } from '@/lib/student/profile-signals';
import {
  resourceInteractionToProfileSignals,
  type ResourceInteractionAction,
} from '@/lib/student/resource-interactions';

const ACTIONS = new Set<ResourceInteractionAction>(['view', 'favorite', 'skip', 'complete']);

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    userId?: string;
    resourceId?: string;
    resourceType?: string;
    action?: ResourceInteractionAction;
    completionRate?: number;
    durationSeconds?: number;
  };

  if (!body.userId || !body.resourceId || !body.resourceType || !body.action) {
    return Response.json(
      {
        success: false,
        error: 'userId, resourceId, resourceType, and action are required',
      },
      { status: 400 },
    );
  }

  if (!ACTIONS.has(body.action)) {
    return Response.json(
      {
        success: false,
        error: 'unsupported interaction action',
      },
      { status: 400 },
    );
  }

  const profileSignals = resourceInteractionToProfileSignals({
    userId: body.userId,
    resourceId: body.resourceId,
    resourceType: body.resourceType,
    action: body.action,
    completionRate: body.completionRate,
    durationSeconds: body.durationSeconds,
  });

  if (profileSignals.length > 0) {
    const storage = await getServerStorage();
    await createProfileSignalDAO(storage).addMany(profileSignals);
  }

  return Response.json({
    success: true,
    data: {
      profileSignals,
    },
  });
}
