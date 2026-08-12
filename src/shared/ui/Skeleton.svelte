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
    border-radius: 6px;
    background: linear-gradient(
      90deg,
      var(--line-soft) 25%,
      var(--line) 37%,
      var(--line-soft) 63%
    );
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
