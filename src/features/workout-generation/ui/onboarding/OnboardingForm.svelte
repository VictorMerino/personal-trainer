<script lang="ts">
  import { onMount } from 'svelte';
  import { addLimitation as addLimitationRequest, getProfile, resolveLimitation as resolveLimitationRequest, saveProfile as saveProfileRequest, type StoredLimitation } from '../api-client';
  import type { BodyZone } from '../../domain/exercise/exercise.schema';
  import type { EquipmentContext } from '../../domain/readiness/daily-checkin.schema';
  import type { LimitationSeverity } from '../../domain/limitation.schema';
  import type { ExperienceLevel } from '../../domain/profile/user-profile.schema';
  import type { Goal } from '../../domain/generator/generator.constants';

  type Limitation = StoredLimitation;

  interface Props {
    // Not a callback: a function prop from a .astro template doesn't
    // survive client:load's JSON serialization — see LoginForm.svelte's
    // redirectTo prop for the same fix and why. String, not a callback.
    redirectTo?: string;
  }

  const { redirectTo = '/' }: Props = $props();

  const goals: Goal[] = ['strength', 'hypertrophy', 'general_fitness'];
  const levels: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced'];
  const equipmentContexts: EquipmentContext[] = ['none', 'basic', 'gym'];
  const zones: BodyZone[] = ['knee', 'hip', 'lower-back', 'shoulder', 'elbow', 'wrist', 'ankle', 'neck'];
  const severities: LimitationSeverity[] = ['mild', 'moderate', 'severe'];

  let goal = $state<Goal | null>(null);
  let level = $state<ExperienceLevel | null>(null);
  let defaultEquipmentContext = $state<EquipmentContext | null>(null);
  let limitations = $state<Limitation[]>([]);
  let newLimitationZone = $state<BodyZone | null>(null);
  let newLimitationSeverity = $state<LimitationSeverity | null>(null);
  let loading = $state(true);
  let saving = $state(false);
  let errorMessage = $state<string | null>(null);

  onMount(async () => {
    try {
      const result = await getProfile();
      if (result.ok) {
        goal = result.value.profile.goal;
        level = result.value.profile.level;
        defaultEquipmentContext = result.value.profile.defaultEquipmentContext;
        limitations = [...result.value.limitations];
      }
    } catch (err) {
      console.error('[onboarding] failed to load profile', err);
      errorMessage = 'Could not load your profile. Please try again.';
    } finally {
      loading = false;
    }
  });

  async function saveProfile() {
    if (!goal || !level || !defaultEquipmentContext) {
      errorMessage = 'Please choose a goal, experience level, and default equipment.';
      return;
    }
    saving = true;
    errorMessage = null;

    const result = await saveProfileRequest({ goal, level, defaultEquipmentContext });

    saving = false;
    if (!result.ok) {
      errorMessage = 'Could not save your profile. Please try again.';
      return;
    }
    window.location.href = redirectTo;
  }

  async function addLimitation() {
    if (!newLimitationZone || !newLimitationSeverity) return;

    const result = await addLimitationRequest(newLimitationZone, newLimitationSeverity);
    if (!result.ok) {
      errorMessage = 'Could not add that limitation.';
      return;
    }
    limitations = [...limitations, result.value.limitation];
    newLimitationZone = null;
    newLimitationSeverity = null;
  }

  async function resolveLimitation(id: string) {
    const result = await resolveLimitationRequest(id);
    if (!result.ok) {
      errorMessage = 'Could not update that limitation.';
      return;
    }
    limitations = limitations.map((l) => (l.id === id ? { ...l, isActive: false } : l));
  }
</script>

{#if loading}
  <p>Loading your profile…</p>
{:else}
  <section>
    <h2>Goal</h2>
    <div role="group" aria-label="Goal">
      {#each goals as option (option)}
        <button type="button" class:selected={goal === option} onclick={() => (goal = option)}>
          {option.replace('_', ' ')}
        </button>
      {/each}
    </div>
  </section>

  <section>
    <h2>Experience level</h2>
    <div role="group" aria-label="Experience level">
      {#each levels as option (option)}
        <button type="button" class:selected={level === option} onclick={() => (level = option)}>
          {option}
        </button>
      {/each}
    </div>
  </section>

  <section>
    <h2>Default equipment</h2>
    <div role="group" aria-label="Default equipment">
      {#each equipmentContexts as option (option)}
        <button
          type="button"
          class:selected={defaultEquipmentContext === option}
          onclick={() => (defaultEquipmentContext = option)}
        >
          {option}
        </button>
      {/each}
    </div>
  </section>

  <section>
    <h2>Limitations</h2>
    <ul>
      {#each limitations.filter((l) => l.isActive) as limitation (limitation.id)}
        <li>
          {limitation.zone} ({limitation.severity})
          <button type="button" onclick={() => resolveLimitation(limitation.id)}>Resolved</button>
        </li>
      {/each}
    </ul>

    <div role="group" aria-label="Add limitation zone">
      {#each zones as zone (zone)}
        <button type="button" class:selected={newLimitationZone === zone} onclick={() => (newLimitationZone = zone)}>
          {zone}
        </button>
      {/each}
    </div>
    <div role="group" aria-label="Add limitation severity">
      {#each severities as severity (severity)}
        <button
          type="button"
          class:selected={newLimitationSeverity === severity}
          onclick={() => (newLimitationSeverity = severity)}
        >
          {severity}
        </button>
      {/each}
    </div>
    <button type="button" disabled={!newLimitationZone || !newLimitationSeverity} onclick={addLimitation}>
      Add limitation
    </button>
  </section>

  <button type="button" disabled={saving} onclick={saveProfile}>{saving ? 'Saving…' : 'Save profile'}</button>
  {#if errorMessage}
    <p role="alert">{errorMessage}</p>
  {/if}
{/if}
