<script lang="ts">
  interface Props {
    message: string;
    variant?: 'success' | 'error' | 'info';
  }

  const { message, variant = 'info' }: Props = $props();
</script>

<div
  class="toast toast-{variant}"
  role="status"
  aria-live={variant === 'error' ? 'assertive' : 'polite'}
>
  {message}
</div>

<style>
  .toast {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius);
    border: 1px solid var(--line);
    font-family: var(--font-ui);
    font-weight: 600;
    font-size: 0.9375rem;
  }

  .toast-success {
    background: var(--success-soft);
    color: var(--ink);
  }

  .toast-error {
    background: var(--danger-soft);
    color: var(--ink);
  }

  .toast-info {
    background: var(--paper-raised);
    color: var(--ink);
  }
</style>
