import { http, HttpResponse, type RequestHandler } from 'msw';
import { ActionService, ActionServiceError } from './action-service';
import type { CreateVehicleActionInput } from '../../api/types';

export function createActionHandlers(actionService: ActionService): RequestHandler[] {
  return [
    http.get('/vehicle-action-statuses', () => {
      const statuses = actionService.getStatusCatalog().getActiveStatuses();
      return HttpResponse.json(statuses);
    }),

    http.get('/vehicles/:vehicleId/actions', async ({ params }) => {
      const vehicleId = params.vehicleId as string;
      try {
        const actions = await actionService.getActionsForVehicle(vehicleId);
        return HttpResponse.json(actions);
      } catch (err) {
        if (err instanceof ActionServiceError) {
          return HttpResponse.json(
            {
              code: err.code,
              message: err.message,
              requestId: crypto.randomUUID(),
              details: err.details,
            },
            { status: err.status },
          );
        }
        return HttpResponse.json(
          {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            requestId: crypto.randomUUID(),
          },
          { status: 500 },
        );
      }
    }),

    http.post('/vehicles/:vehicleId/actions', async ({ params, request }) => {
      const vehicleId = params.vehicleId as string;
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return HttpResponse.json(
          {
            code: 'INVALID_REQUEST_BODY',
            message: 'Malformed JSON payload',
            requestId: crypto.randomUUID(),
          },
          { status: 400 },
        );
      }

      try {
        // Trusted actor is resolved solely by the backend provider; client input does not choose actor context
        const actor = await actionService.getActorProvider().getCurrentActor();
        const created = await actionService.createAction(
          vehicleId,
          body as CreateVehicleActionInput,
          actor ?? undefined,
        );
        return HttpResponse.json(created, { status: 201 });
      } catch (err) {
        if (err instanceof ActionServiceError) {
          return HttpResponse.json(
            {
              code: err.code,
              message: err.message,
              requestId: crypto.randomUUID(),
              details: err.details,
            },
            { status: err.status },
          );
        }
        return HttpResponse.json(
          {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            requestId: crypto.randomUUID(),
          },
          { status: 500 },
        );
      }
    }),
  ];
}
