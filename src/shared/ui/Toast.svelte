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
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    font-weight: 600;
  }

  .toast-success {
    background: #dcfce7;
    color: #166534;
  }

  .toast-error {
    background: #fee2e2;
    color: #991b1b;
  }

  .toast-info {
    background: #dbeafe;
    color: #1e40af;
  }
</style>
