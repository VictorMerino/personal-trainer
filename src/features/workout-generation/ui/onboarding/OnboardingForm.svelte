<script lang="ts">
  import { onMount } from 'svelte';
  import { authorizedFetch } from '../../../../shared/http/authorized-fetch';
  import type { BodyZone } from '../../domain/exercise/exercise.schema';
  import type { EquipmentContext } from '../../domain/readiness/daily-checkin.schema';
  import type { LimitationSeverity } from '../../domain/limitation.schema';
  import type { ExperienceLevel } from '../../domain/profile/user-profile.schema';
  import type { Goal } from '../../domain/generator/generator.constants';

  interface Limitation {
    id: string;
    zone: BodyZone;
    severity: LimitationSeverity;
    isActive: boolean;
  }

  interface Props {
    onsaved?: () => void;
  }

  const { onsaved }: Props = $props();

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
    const response = await authorizedFetch('/api/profile');
    if (response.ok) {
      const body = await response.json();
      goal = body.profile.goal;
      level = body.profile.level;
      defaultEquipmentContext = body.profile.defaultEquipmentContext;
      limitations = body.limitations;
    }
    loading = false;
  });

  async function saveProfile() {
    if (!goal || !level || !defaultEquipmentContext) {
      errorMessage = 'Please choose a goal, experience level, and default equipment.';
      return;
    }
    saving = true;
    errorMessage = null;

    const response = await authorizedFetch('/api/profile', {
      method: 'PUT',
      body: JSON.stringify({ goal, level, defaultEquipmentContext }),
    });

    saving = false;
    if (!response.ok) {
      errorMessage = 'Could not save your profile. Please try again.';
      return;
    }
    onsaved?.();
  }

  async function addLimitation() {
    if (!newLimitationZone || !newLimitationSeverity) return;

    const response = await authorizedFetch('/api/profile/limitations', {
      method: 'POST',
      body: JSON.stringify({ zone: newLimitationZone, severity: newLimitationSeverity }),
    });
    if (!response.ok) {
      errorMessage = 'Could not add that limitation.';
      return;
    }
    const body = await response.json();
    limitations = [...limitations, body.limitation];
    newLimitationZone = null;
    newLimitationSeverity = null;
  }

  async function resolveLimitation(id: string) {
    const response = await authorizedFetch(`/api/profile/limitations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'resolved' }),
    });
    if (!response.ok) {
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
