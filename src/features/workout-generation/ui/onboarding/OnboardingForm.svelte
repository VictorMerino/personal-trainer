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
  let consentGiven = $state(false);

  onMount(async () => {
    try {
      const result = await getProfile();
      if (result.ok) {
        goal = result.value.profile.goal;
        level = result.value.profile.level;
        defaultEquipmentContext = result.value.profile.defaultEquipmentContext;
        limitations = [...result.value.limitations];
        consentGiven = Boolean(result.value.profile.dataConsentedAt);
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
    if (!consentGiven) {
      errorMessage = 'Please confirm the data consent notice below to continue.';
      return;
    }
    saving = true;
    errorMessage = null;

    const result = await saveProfileRequest({ goal, level, defaultEquipmentContext, consent: true });

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
  <p class="loading-text">Loading your profile…</p>
{:else}
  <section class="block">
    <h2>Goal</h2>
    <div class="chip-row" role="group" aria-label="Goal">
      {#each goals as option (option)}
        <button type="button" class="chip" class:selected={goal === option} onclick={() => (goal = option)}>
          {option.replace('_', ' ')}
        </button>
      {/each}
    </div>
  </section>

  <section class="block">
    <h2>Experience level</h2>
    <div class="chip-row" role="group" aria-label="Experience level">
      {#each levels as option (option)}
        <button type="button" class="chip" class:selected={level === option} onclick={() => (level = option)}>
          {option}
        </button>
      {/each}
    </div>
  </section>

  <section class="block">
    <h2>Default equipment</h2>
    <div class="chip-row" role="group" aria-label="Default equipment">
      {#each equipmentContexts as option (option)}
        <button
          type="button"
          class="chip"
          class:selected={defaultEquipmentContext === option}
          onclick={() => (defaultEquipmentContext = option)}
        >
          {option}
        </button>
      {/each}
    </div>
  </section>

  <section class="block">
    <h2>Limitations</h2>
    {#if limitations.some((l) => l.isActive)}
      <ul class="limitation-list">
        {#each limitations.filter((l) => l.isActive) as limitation (limitation.id)}
          <li>
            <span>{limitation.zone} ({limitation.severity})</span>
            <button type="button" class="text-btn" onclick={() => resolveLimitation(limitation.id)}>Resolved</button>
          </li>
        {/each}
      </ul>
    {/if}

    <p class="field-label">Add a limitation</p>
    <div class="chip-row" role="group" aria-label="Add limitation zone">
      {#each zones as zone (zone)}
        <button
          type="button"
          class="chip"
          class:selected={newLimitationZone === zone}
          onclick={() => (newLimitationZone = zone)}
        >
          {zone}
        </button>
      {/each}
    </div>
    <div class="chip-row" role="group" aria-label="Add limitation severity">
      {#each severities as severity (severity)}
        <button
          type="button"
          class="chip"
          class:selected={newLimitationSeverity === severity}
          onclick={() => (newLimitationSeverity = severity)}
        >
          {severity}
        </button>
      {/each}
    </div>
    <button
      type="button"
      class="text-btn"
      disabled={!newLimitationZone || !newLimitationSeverity}
      onclick={addLimitation}
    >
      Add limitation
    </button>
  </section>

  <section class="block consent-block">
    <h2>Before you continue</h2>
    <p class="consent-copy">
      This app is not a medical service and does not provide medical advice. If you have pain, an
      injury, or a medical condition, consult a qualified professional before training.
    </p>
    <label class="consent-row">
      <input type="checkbox" bind:checked={consentGiven} />
      <span>I consent to my training and injury data being processed to generate and adjust my workouts.</span>
    </label>
  </section>

  <button type="button" class="big-btn" disabled={saving || !consentGiven} onclick={saveProfile}>
    {saving ? 'Saving…' : 'Save profile'}
  </button>
  {#if errorMessage}
    <p class="error-text" role="alert">{errorMessage}</p>
  {/if}
{/if}

<style>
  .loading-text {
    color: var(--ink-soft);
  }

  .block {
    margin-bottom: var(--space-6);
  }

  h2 {
    font-size: 1.0625rem;
    font-weight: 700;
    margin: 0 0 var(--space-3);
  }

  .field-label {
    font-family: var(--font-data);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink-soft);
    margin: 0 0 var(--space-2);
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }

  .chip {
    font-family: var(--font-ui);
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--ink);
    background: var(--paper-raised);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: var(--space-2) var(--space-4);
    cursor: pointer;
    text-transform: capitalize;
  }

  .chip.selected {
    background: var(--accent);
    color: var(--paper-raised);
    border-color: var(--accent);
  }

  .limitation-list {
    list-style: none;
    padding: 0;
    margin: 0 0 var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .limitation-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--paper-raised);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: var(--space-3) var(--space-4);
    font-size: 0.9375rem;
    text-transform: capitalize;
  }

  .text-btn {
    background: none;
    border: none;
    color: var(--ink-soft);
    font-family: var(--font-ui);
    font-size: 0.9375rem;
    font-weight: 600;
    text-decoration: underline;
    cursor: pointer;
    padding: var(--space-2) 0;
    text-transform: none;
  }

  .text-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .consent-block {
    background: var(--paper-raised);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: var(--space-4);
  }

  .consent-copy {
    color: var(--ink-soft);
    font-size: 0.875rem;
    margin: 0 0 var(--space-4);
  }

  .consent-row {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    font-size: 0.9375rem;
    cursor: pointer;
  }

  .consent-row input {
    margin-top: 0.2em;
  }

  .big-btn {
    display: block;
    width: 100%;
    font-family: var(--font-ui);
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--paper-raised);
    background: var(--accent-strong);
    border: none;
    border-radius: var(--radius);
    padding: var(--space-5) var(--space-4);
    text-align: center;
    cursor: pointer;
  }

  .big-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .error-text {
    color: var(--danger);
    font-size: 0.9375rem;
    margin-top: var(--space-3);
  }
</style>
