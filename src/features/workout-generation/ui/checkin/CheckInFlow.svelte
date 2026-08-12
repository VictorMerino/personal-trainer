<script lang="ts">
  import { generateWorkout as generateWorkoutRequest, submitCheckIn } from '../api-client';
  import type { EnergyLevel, EquipmentContext, PainReport } from '../../domain/readiness/daily-checkin.schema';
  import type { TrainingDecision } from '../../domain/readiness/training-decision';
  import PainStep from './PainStep.svelte';
  import Skeleton from '../../../../shared/ui/Skeleton.svelte';

  type Step = 'energy' | 'pain' | 'minutes' | 'equipment' | 'submitting' | 'result';

  const stepNumbers: Record<Step, number> = {
    energy: 1,
    pain: 2,
    minutes: 3,
    equipment: 4,
    submitting: 4,
    result: 4,
  };

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

{#if step !== 'submitting' && step !== 'result'}
  <p class="eyebrow">Step {stepNumbers[step]} of 4</p>
{/if}

{#if step === 'energy'}
  <h2>Energy</h2>
  <div class="stack" role="group" aria-label="Energy">
    {#each energyLevels as level (level)}
      <button type="button" class="big-btn raw-value" onclick={() => chooseEnergy(level)}>{level}</button>
    {/each}
  </div>
{:else if step === 'pain'}
  <h2>Pain</h2>
  <PainStep oncomplete={completePain} />
{:else if step === 'minutes'}
  <h2>Available minutes</h2>
  <div class="stack" role="group" aria-label="Available minutes">
    {#each minutesOptions as minutes (minutes)}
      <button type="button" class="big-btn" onclick={() => chooseMinutes(minutes)}>{minutes} min</button>
    {/each}
  </div>
{:else if step === 'equipment'}
  <h2>Equipment</h2>
  <div class="stack" role="group" aria-label="Equipment">
    {#each equipmentContexts as context (context)}
      <button type="button" class="big-btn raw-value" onclick={() => chooseEquipment(context)}>{context}</button>
    {/each}
  </div>
  {#if errorMessage}
    <p class="error-text" role="alert">{errorMessage}</p>
  {/if}
{:else if step === 'submitting'}
  <p class="eyebrow">Submitting your check-in…</p>
  <Skeleton height="3.5rem" />
  <Skeleton height="3.5rem" />
{:else if step === 'result' && decision}
  {#if decision.kind === 'NORMAL' || decision.kind === 'DELOAD'}
    <p class="result-copy">
      Today's training: {decision.kind === 'DELOAD' ? 'a lighter deload session' : 'a normal session'}.
    </p>
    <button type="button" class="big-btn" disabled={generating || generateSucceeded} onclick={generateWorkout}>
      {generateButtonLabel()}
    </button>
    {#if generating}
      <Skeleton height="1rem" width="70%" />
    {/if}
    {#if generateError}
      <p class="error-text" role="alert">{generateError}</p>
    {/if}
  {:else if decision.kind === 'ACTIVE_RECOVERY'}
    <p class="result-copy">Today is an active recovery day — your recovery plan is ready.</p>
    <a href="/" class="text-btn">Back to home</a>
  {/if}
{/if}

<style>
  .eyebrow {
    font-family: var(--font-data);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink-soft);
    margin: 0 0 var(--space-2);
  }

  h2 {
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    margin: 0 0 var(--space-5);
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
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

  .big-btn.raw-value {
    text-transform: capitalize;
  }

  .big-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .result-copy {
    font-size: 1.0625rem;
    margin: 0 0 var(--space-5);
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
    display: inline-block;
  }

  .error-text {
    color: var(--danger);
    font-size: 0.9375rem;
    margin-top: var(--space-3);
  }
</style>
