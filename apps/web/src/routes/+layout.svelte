<script lang="ts">
  import "../app.css";
  import Shell from "$lib/ui/Shell.svelte";
  let { data, children } = $props();
</script>

<Shell user={data.user}>
  {@render children()}
</Shell>
