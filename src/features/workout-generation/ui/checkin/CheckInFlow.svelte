<script lang="ts">
  import { generateWorkout as generateWorkoutRequest, submitCheckIn } from '../api-client';
  import type { EnergyLevel, EquipmentContext, PainReport } from '../../domain/readiness/daily-checkin.schema';
  import type { TrainingDecision } from '../../domain/readiness/training-decision';
  import PainStep from './PainStep.svelte';

  type Step = 'energy' | 'pain' | 'minutes' | 'equipment' | 'submitting' | 'result';

  const energyLevels: EnergyLevel[] = ['low', 'medium', 'high'];
  const minutesOptions = [15, 30, 45, 60, 90];
  const equipmentContexts: EquipmentContext[] = ['none', 'basic', 'gym'];

  let step = $state<Step>('energy');
  let energy = $state<EnergyLevel | null>(null);
  let painReports = $state<PainReport[]>([]);
  let availableMinutes = $state<number | null>(null);

  let decision = $state<TrainingDecision | null>(null);
  let checkInId = $state<string | null>(null);
  let errorMessage = $state<string | null>(null);
  let generating = $state(false);
  let generateError = $state<string | null>(null);
  let generateSucceeded = $state(false);

  function chooseEnergy(level: EnergyLevel) {
    energy = level;
    step = 'pain';
  }

  function completePain(reports: PainReport[]) {
    painReports = reports;
    step = 'minutes';
  }

  function chooseMinutes(minutes: number) {
    availableMinutes = minutes;
    step = 'equipment';
  }

  async function chooseEquipment(context: EquipmentContext) {
    step = 'submitting';
    errorMessage = null;

    const result = await submitCheckIn({
      energy: energy!,
      painReports,
      availableMinutes: availableMinutes!,
      equipmentContext: context,
    });

    if (!result.ok) {
      errorMessage = 'Could not submit your check-in. Please try again.';
      step = 'equipment';
      return;
    }

    decision = result.value.decision;
    checkInId = result.value.checkInId;

    if (decision?.kind === 'CHOICE') {
      window.location.href = `/checkin/${checkInId}/choice`;
      return;
    }
    step = 'result';
  }

  async function generateWorkout() {
    generating = true;
    generateError = null;

    const result = await generateWorkoutRequest();

    if (!result.ok) {
      generating = false;
      generateError = 'Could not generate a workout. Please try again.';
      return;
    }
    generateSucceeded = true;
    window.location.href = `/workout/${result.value.id}`;
  }

  function generateButtonLabel(): string {
    if (generateSucceeded) return 'Workout ready';
    if (generating) return 'Generating…';
    return "Generate today's workout";
  }
</script>

{#if step === 'energy'}
  <h2>Energy</h2>
  <div role="group" aria-label="Energy">
    {#each energyLevels as level (level)}
      <button type="button" onclick={() => chooseEnergy(level)}>{level}</button>
    {/each}
  </div>
{:else if step === 'pain'}
  <h2>Pain</h2>
  <PainStep oncomplete={completePain} />
{:else if step === 'minutes'}
  <h2>Available minutes</h2>
  <div role="group" aria-label="Available minutes">
    {#each minutesOptions as minutes (minutes)}
      <button type="button" onclick={() => chooseMinutes(minutes)}>{minutes} min</button>
    {/each}
  </div>
{:else if step === 'equipment'}
  <h2>Equipment</h2>
  <div role="group" aria-label="Equipment">
    {#each equipmentContexts as context (context)}
      <button type="button" onclick={() => chooseEquipment(context)}>{context}</button>
    {/each}
  </div>
  {#if errorMessage}
    <p role="alert">{errorMessage}</p>
  {/if}
{:else if step === 'submitting'}
  <p>Submitting your check-in…</p>
{:else if step === 'result' && decision}
  {#if decision.kind === 'NORMAL' || decision.kind === 'DELOAD'}
    <p>Today's training: {decision.kind === 'DELOAD' ? 'a lighter deload session' : 'a normal session'}.</p>
    <button type="button" disabled={generating || generateSucceeded} onclick={generateWorkout}>
      {generateButtonLabel()}
    </button>
    {#if generateError}
      <p role="alert">{generateError}</p>
    {/if}
  {:else if decision.kind === 'ACTIVE_RECOVERY'}
    <p>Today is an active recovery day — your recovery plan is ready.</p>
  {/if}
{/if}
