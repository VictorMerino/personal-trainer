<script lang="ts">
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
  }

  loadPlan();

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
</script>

{#if loading}
  <Skeleton height="8rem" label="Loading today's workout" />
{:else if loadError}
  <p role="alert">Could not load today's workout.</p>
{:else if alreadyEnded || ended}
  <p>Workout session finished. Nice work.</p>
{:else if exercises.length === 0}
  <p>No exercises scheduled for today.</p>
{:else if allSetsComplete}
  <p>All sets logged for today.</p>
  <button type="button" disabled={ending} onclick={endSession}>Finish workout</button>
{:else if currentExercise && currentTarget}
  <h1>{currentExercise.catalogName}</h1>
  <p>
    Set {setIndex + 1} of {currentExercise.exercise.sets.length}
  </p>
  {#if currentExercise.cues.length > 0}
    <ul>
      {#each currentExercise.cues as cue (cue)}
        <li>{cue}</li>
      {/each}
    </ul>
  {/if}

  <p aria-live="assertive">{restAnnouncement}</p>
  {#if resting}
    <p>Resting: {restRemaining}s of {restTotal}s</p>
  {/if}

  {#if currentTarget.kind === 'load'}
    <div role="group" aria-label="Reps">
      <button type="button" onclick={() => (reps = Math.max(1, reps - 1))}>-</button>
      <span>{reps} reps</span>
      <button type="button" onclick={() => (reps += 1)}>+</button>
    </div>
    <div role="group" aria-label="Load">
      <button type="button" onclick={() => (loadKg = Math.max(0, loadKg - 2.5))}>-</button>
      <span>{loadKg} kg</span>
      <button type="button" onclick={() => (loadKg += 2.5)}>+</button>
    </div>
  {:else if currentTarget.kind === 'reps'}
    <div role="group" aria-label="Reps">
      <button type="button" onclick={() => (reps = Math.max(1, reps - 1))}>-</button>
      <span>{reps} reps</span>
      <button type="button" onclick={() => (reps += 1)}>+</button>
    </div>
  {:else}
    <div role="group" aria-label="Time">
      <button type="button" onclick={() => (seconds = Math.max(5, seconds - 5))}>-</button>
      <span>{seconds}s</span>
      <button type="button" onclick={() => (seconds += 5)}>+</button>
    </div>
  {/if}

  <RpeBar mode="input" value={rpe} onchange={(v) => (rpe = v)} />

  <button type="button" disabled={saving || rpe === null} onclick={logSet}>
    {saving ? 'Saving…' : 'Log set'}
  </button>
  {#if saveError}
    <p role="alert">{saveError}</p>
  {/if}

  <button type="button" onclick={skipExercise}>Skip exercise</button>
  <button type="button" disabled={ending} onclick={endSession}>End session</button>

  {#if toastMessage}
    <Toast message={toastMessage} variant="success" />
  {/if}
{/if}
