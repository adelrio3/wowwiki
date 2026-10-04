<script lang="ts">
  let { steps, current }: { steps: string[]; current: number } = $props();
</script>

<ol class="grid gap-2 sm:grid-cols-4">
  {#each steps as step, i}
    {@const state = i < current ? "done" : i === current ? "now" : "todo"}
    <li class="flex items-center gap-2 rounded-md border px-3 py-2 text-sm {state === 'now' ? 'border-accent bg-surface' : 'border-line bg-surface'} {state === 'todo' ? 'text-ink-faint' : ''}">
      <span class="num flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium {state === 'done' ? 'bg-ok-soft text-ok' : state === 'now' ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink-faint'}">{state === "done" ? "✓" : i + 1}</span>
      <span>{step}</span>
    </li>
  {/each}
</ol>
