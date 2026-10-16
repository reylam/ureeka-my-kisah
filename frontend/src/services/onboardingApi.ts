import type {
  Account,
  OnboardingAddress,
  OnboardingConsent,
  OnboardingHealth,
  OnboardingPersonal,
  OnboardingState,
} from '@/types/account';
import { api } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';

/**
 * Patient onboarding and consent, saved to the API one step at a time so the
 * wizard resumes. Each call returns the server's copy of the onboarding state,
 * which replaces the one held on the signed-in account.
 */

function apply(onboarding: OnboardingState): OnboardingState {
  const { account, setAccount } = useAuthStore.getState();
  if (account) {
    setAccount({ ...account, onboarding, name: onboarding.personal?.fullName || account.name });
  }
  return onboarding;
}

type Wrapped = { onboarding: OnboardingState };

export async function saveOnboardingPersonal(value: OnboardingPersonal): Promise<void> {
  apply((await api.patch<Wrapped>('/me/onboarding/personal', value)).onboarding);
}

export async function saveOnboardingAddress(value: OnboardingAddress): Promise<void> {
  apply((await api.patch<Wrapped>('/me/onboarding/address', value)).onboarding);
}

export async function saveOnboardingHealth(value: OnboardingHealth): Promise<void> {
  apply((await api.patch<Wrapped>('/me/onboarding/health', value)).onboarding);
}

export async function completeOnboarding(
  consent: Pick<OnboardingConsent, 'dataUse' | 'healthInfo'>,
): Promise<void> {
  const result = await api.post<{ onboarding: OnboardingState; account: Account }>(
    '/me/onboarding/complete',
    consent,
  );
  useAuthStore.getState().setAccount(result.account);
  // The clinical record was created by completing; load it.
  await useAuthStore.getState().loadWorkspace();
}

/** Withdraw consent to share health answers. The server clears the answers. */
export async function withdrawHealthConsent(): Promise<void> {
  apply((await api.patch<Wrapped>('/me/consent/health', { healthInfo: false })).onboarding);
}
