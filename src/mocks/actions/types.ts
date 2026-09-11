export interface PersistedVehicleAction {
  id: string;
  vehicleId: string;
  statusId: string;
  note: string | null;
  createdAt: string;
  createdByActorId: string;
  createdByDisplayName: string;
  createdByType: 'USER' | 'SYSTEM' | 'AI';
}

export interface TrustedActor {
  id: string;
  displayName: string;
  type: 'USER' | 'SYSTEM' | 'AI';
  isAuthorized: boolean;
}

export interface TrustedActorProvider {
  getCurrentActor(request?: Request): Promise<TrustedActor | null> | TrustedActor | null;
}
