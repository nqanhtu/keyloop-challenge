import { useState, type FormEvent } from 'react';
import { isApiError } from '../../api';
import { useActionStatuses } from '../inventory/queries';
import { useCreateVehicleAction } from './queries';

export interface CreateActionFormProps {
  vehicleId: string;
}

/**
 * System Design 5.5 / 5.7 / ACT-008: the status options are the dynamically
 * fetched active statuses, and the POST body carries only statusId plus the
 * optional note. The note draft is optional; an untouched draft is sent as
 * `null` rather than inventing a validation rule (Decision 0001).
 */
export function CreateActionForm({ vehicleId }: CreateActionFormProps) {
  const statusesQuery = useActionStatuses();
  const mutation = useCreateVehicleAction(vehicleId);
  const [statusIdDraft, setStatusIdDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');

  const activeStatuses = (statusesQuery.data ?? []).filter((status) => status.isActive);
  const statusId = statusIdDraft || activeStatuses[0]?.id || '';
  const selectedStatus = activeStatuses.find((status) => status.id === statusId);
  const isSubmitting = mutation.isPending;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedStatus || isSubmitting) {
      return;
    }

    mutation.mutate(
      { status: selectedStatus, note: noteDraft === '' ? null : noteDraft },
      { onSuccess: () => setNoteDraft('') },
    );
  };

  return (
    <form className="create-action-form" onSubmit={handleSubmit}>
      <div className="filter-field">
        <label htmlFor="create-action-status">Action status</label>
        <select
          id="create-action-status"
          value={statusId}
          onChange={(event) => setStatusIdDraft(event.target.value)}
          disabled={activeStatuses.length === 0}
        >
          {activeStatuses.map((status) => (
            <option key={status.id} value={status.id}>
              {status.label}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-field">
        <label htmlFor="create-action-note">Note (optional)</label>
        <textarea
          id="create-action-note"
          value={noteDraft}
          onChange={(event) => setNoteDraft(event.target.value)}
        />
      </div>

      <button type="submit" className="button button--primary" disabled={!statusId || isSubmitting}>
        Record action
      </button>

      {mutation.isError && (
        <p className="create-action-form__error" role="alert">
          {isApiError(mutation.error) ? mutation.error.message : 'Unable to record the action.'}
        </p>
      )}
    </form>
  );
}
