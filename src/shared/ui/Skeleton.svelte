<script lang="ts">
  interface Props {
    width?: string;
    height?: string;
    label?: string;
  }

  const { width = '100%', height = '1rem', label = 'Loading' }: Props = $props();
</script>

<div class="skeleton" style:width style:height role="status" aria-label={label}></div>

<style>
  .skeleton {
    border-radius: 0.375rem;
    background: linear-gradient(90deg, #e2e2e2 25%, #f0f0f0 37%, #e2e2e2 63%);
    background-size: 400% 100%;
    animation: shimmer 1.4s ease infinite;
  }

  @keyframes shimmer {
    0% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }
</style>
