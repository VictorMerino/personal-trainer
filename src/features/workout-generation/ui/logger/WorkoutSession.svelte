<script lang="ts">
  import { onMount } from 'svelte';
  import { endSession as endSessionRequest, getWorkout, logSet as logSetRequest, skipExercise as skipExerciseRequest } from '../api-client';
  import RpeBar from '../../../../shared/ui/RpeBar.svelte';
  import Skeleton from '../../../../shared/ui/Skeleton.svelte';
  import Toast from '../../../../shared/ui/Toast.svelte';
  import { EXERCISE_CATALOG } from '../../domain/exercise/catalog';
  import type { PrescribedExercise, WorkoutPlan } from '../../domain/workout-plan/workout-plan.schema';

  interface Props {
    planId: string;
  }

  const { planId }: Props = $props();

  interface FlatExercise {
    exercise: PrescribedExercise;
    catalogName: string;
    cues: string[];
    restSeconds: number;
  }

  let loading = $state(true);
  let loadError = $state(false);
  let plan = $state<WorkoutPlan | null>(null);
  let alreadyEnded = $state(false);

  let exercises = $state<FlatExercise[]>([]);
  let exerciseIndex = $state(0);
  let setIndex = $state(0);

  let reps = $state(0);
  let loadKg = $state(0);
  let seconds = $state(0);
  let rpe = $state<number | null>(null);

  let saving = $state(false);
  let saveError = $state<string | null>(null);
  let toastMessage = $state<string | null>(null);

  let resting = $state(false);
  let restRemaining = $state(0);
  let restTotal = $state(0);
  let restAnnouncement = $state('');
  let restTimerHandle: ReturnType<typeof window.setInterval> | null = null;

  let ended = $state(false);
  let ending = $state(false);

  const currentExercise = $derived(exercises[exerciseIndex] ?? null);
  const currentTarget = $derived(currentExercise?.exercise.sets[setIndex] ?? null);
  const allSetsComplete = $derived(exerciseIndex >= exercises.length);

  function resetInputsForCurrentSet() {
    rpe = null;
    if (!currentTarget) return;
    if (currentTarget.kind === 'load') {
      reps = currentTarget.reps.min;
      loadKg = currentTarget.loadKg;
    } else if (currentTarget.kind === 'reps') {
      reps = currentTarget.reps.min;
    } else {
      seconds = currentTarget.seconds;
    }
  }

  async function loadPlan() {
    try {
      const result = await getWorkout(planId);
      loading = false;
      if (!result.ok) {
        loadError = true;
        return;
      }
      plan = result.value.plan;
      alreadyEnded = Boolean(result.value.endedAt);

      exercises = plan.blocks.flatMap((block) =>
        block.exercises.map((exercise): FlatExercise => {
          const catalogEntry = EXERCISE_CATALOG.find((e) => e.id === exercise.exerciseId);
          return {
            exercise,
            catalogName: catalogEntry?.name ?? exercise.exerciseId,
            cues: catalogEntry?.cues ?? [],
            restSeconds: catalogEntry?.defaultRestSeconds ?? 90,
          };
        }),
      );
      resetInputsForCurrentSet();
    } catch (err) {
      console.error('[workout-session] failed to load plan', err);
      loading = false;
      loadError = true;
    }
  }

  onMount(loadPlan);

  function stopRestTimer() {
    if (restTimerHandle) window.clearInterval(restTimerHandle);
    restTimerHandle = null;
    resting = false;
  }

  function startRestTimer(totalSeconds: number) {
    stopRestTimer();
    if (totalSeconds <= 0) return;
    resting = true;
    restTotal = totalSeconds;
    restRemaining = totalSeconds;
    const halfway = Math.floor(totalSeconds / 2);
    restAnnouncement = `Resting for ${totalSeconds} seconds`;

    restTimerHandle = window.setInterval(() => {
      restRemaining -= 1;
      if (restRemaining === halfway) restAnnouncement = 'Halfway through your rest';
      if (restRemaining <= 0) {
        restAnnouncement = 'Rest complete';
        stopRestTimer();
      }
    }, 1000);
  }

  function advance() {
    if (!currentExercise) return;
    if (setIndex + 1 < currentExercise.exercise.sets.length) {
      setIndex += 1;
    } else {
      exerciseIndex += 1;
      setIndex = 0;
    }
    resetInputsForCurrentSet();
  }

  async function logSet() {
    if (!currentExercise || !currentTarget || rpe === null) return;
    saving = true;
    saveError = null;

    let actualReps: number | null = null;
    let actualLoadKg: number | null = null;
    let actualSeconds: number | null = null;
    if (currentTarget.kind === 'load') {
      actualReps = reps;
      actualLoadKg = loadKg;
    } else if (currentTarget.kind === 'reps') {
      actualReps = reps;
    } else {
      actualSeconds = seconds;
    }

    const result = await logSetRequest(planId, {
      exerciseId: currentExercise.exercise.exerciseId,
      setIndex,
      actualRpe: rpe,
      actualReps,
      actualLoadKg,
      actualSeconds,
    });
    saving = false;

    if (!result.ok) {
      saveError = 'Could not save that set. Please try again.';
      return;
    }

    toastMessage = 'Set saved';
    const restSeconds = currentExercise.restSeconds;
    advance();
    startRestTimer(restSeconds);
  }

  async function skipExercise() {
    if (!currentExercise) return;
    stopRestTimer();
    await skipExerciseRequest(planId, currentExercise.exercise.exerciseId, null);
    exerciseIndex += 1;
    setIndex = 0;
    resetInputsForCurrentSet();
  }

  async function endSession() {
    ending = true;
    stopRestTimer();
    const result = await endSessionRequest(planId, null);
    ending = false;
    if (result.ok) ended = true;
  }

  function formatClock(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
</script>

{#if loading}
  <Skeleton height="8rem" label="Loading today's workout" />
{:else if loadError}
  <p class="error-text" role="alert">Could not load today's workout.</p>
{:else if alreadyEnded || ended}
  <p class="result-copy">Workout session finished. Nice work.</p>
  <div class="secondary-actions">
    <a href="/app" class="text-btn">Back to home</a>
    <a href="/progress" class="text-btn">View progress</a>
  </div>
{:else if exercises.length === 0}
  <p class="result-copy">No exercises scheduled for today.</p>
{:else if allSetsComplete}
  <p class="result-copy">All sets logged for today.</p>
  <button type="button" class="big-btn" disabled={ending} onclick={endSession}>Finish workout</button>
{:else if currentExercise && currentTarget}
  <p class="eyebrow">
    Set {setIndex + 1} of {currentExercise.exercise.sets.length}
  </p>
  <h1>{currentExercise.catalogName}</h1>
  {#if currentExercise.cues.length > 0}
    <ul class="cues">
      {#each currentExercise.cues as cue (cue)}
        <li>{cue}</li>
      {/each}
    </ul>
  {/if}

  <p class="sr-only" aria-live="assertive">{restAnnouncement}</p>
  {#if resting}
    <div class="rest-panel">
      <div class="rest-clock">{formatClock(restRemaining)}</div>
      <div class="rest-track">
        <div class="rest-fill" style:width="{(restRemaining / restTotal) * 100}%"></div>
      </div>
      <p class="rest-caption">Resting: {restRemaining}s of {restTotal}s</p>
    </div>
  {/if}

  {#if currentTarget.kind === 'load'}
    <div class="stepper-row">
      <div class="stepper" role="group" aria-label="Reps">
        <button type="button" class="stepper-btn" onclick={() => (reps = Math.max(1, reps - 1))}>−</button>
        <span class="stepper-value">{reps} reps</span>
        <button type="button" class="stepper-btn" onclick={() => (reps += 1)}>+</button>
      </div>
      <div class="stepper" role="group" aria-label="Load">
        <button type="button" class="stepper-btn" onclick={() => (loadKg = Math.max(0, loadKg - 2.5))}>−</button>
        <span class="stepper-value">{loadKg} kg</span>
        <button type="button" class="stepper-btn" onclick={() => (loadKg += 2.5)}>+</button>
      </div>
    </div>
  {:else if currentTarget.kind === 'reps'}
    <div class="stepper-row">
      <div class="stepper" role="group" aria-label="Reps">
        <button type="button" class="stepper-btn" onclick={() => (reps = Math.max(1, reps - 1))}>−</button>
        <span class="stepper-value">{reps} reps</span>
        <button type="button" class="stepper-btn" onclick={() => (reps += 1)}>+</button>
      </div>
    </div>
  {:else}
    <div class="stepper-row">
      <div class="stepper" role="group" aria-label="Time">
        <button type="button" class="stepper-btn" onclick={() => (seconds = Math.max(5, seconds - 5))}>−</button>
        <span class="stepper-value">{seconds}s</span>
        <button type="button" class="stepper-btn" onclick={() => (seconds += 5)}>+</button>
      </div>
    </div>
  {/if}

  <div class="rpe-block">
    <RpeBar mode="input" value={rpe} onchange={(v) => (rpe = v)} />
  </div>

  <button type="button" class="big-btn" disabled={saving || rpe === null} onclick={logSet}>
    {saving ? 'Saving…' : 'Log set'}
  </button>
  {#if saveError}
    <p class="error-text" role="alert">{saveError}</p>
  {/if}

  <div class="secondary-actions">
    <button type="button" class="text-btn" onclick={skipExercise}>Skip exercise</button>
    <button type="button" class="text-btn" disabled={ending} onclick={endSession}>End session</button>
  </div>

  {#if toastMessage}
    <div class="toast-slot">
      <Toast message={toastMessage} variant="success" />
    </div>
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

  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    margin: 0 0 var(--space-3);
  }

  .cues {
    margin: 0 0 var(--space-5);
    padding-left: 1.1rem;
    color: var(--ink-soft);
    font-size: 0.9375rem;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  .rest-panel {
    background: var(--paper-raised);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: var(--space-4);
    margin-bottom: var(--space-5);
  }

  .rest-clock {
    font-family: var(--font-data);
    font-variant-numeric: tabular-nums;
    font-size: 2.5rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--accent-strong);
    text-align: center;
  }

  .rest-track {
    height: 6px;
    border-radius: 3px;
    background: var(--line-soft);
    overflow: hidden;
    margin: var(--space-3) 0 var(--space-2);
  }

  .rest-fill {
    height: 100%;
    background: var(--accent);
    transition: width 1s linear;
  }

  .rest-caption {
    font-family: var(--font-data);
    font-size: 0.8125rem;
    color: var(--ink-soft);
    text-align: center;
    margin: 0;
  }

  .stepper-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-bottom: var(--space-5);
  }

  .stepper {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    background: var(--paper-raised);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: var(--space-2) var(--space-3);
  }

  .stepper-btn {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: transparent;
    color: var(--ink);
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
  }

  .stepper-value {
    font-family: var(--font-data);
    font-variant-numeric: tabular-nums;
    font-size: 1.0625rem;
    font-weight: 600;
    min-width: 5ch;
    text-align: center;
  }

  .rpe-block {
    margin-bottom: var(--space-5);
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

  .secondary-actions {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4);
    margin-top: var(--space-4);
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
  }

  .toast-slot {
    margin-top: var(--space-4);
  }

  .result-copy {
    font-size: 1.0625rem;
    margin: 0 0 var(--space-5);
  }

  .error-text {
    color: var(--danger);
    font-size: 0.9375rem;
    margin-top: var(--space-3);
  }
</style>
