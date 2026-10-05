<script lang="ts">
  /** Inline 24-unit stroke icons. One set for the whole site; no icon fonts. */
  let { name, size = 16, class: cls = "" }: { name: keyof typeof paths; size?: number; class?: string } = $props();
  const paths = {
    book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z M4 19a2 2 0 0 1 2-2h13",
    map: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z M9 4v14 M15 6v14",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0",
    paw: "M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M17 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M4 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M20 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M12 11c-3 0-6 3-6 6a3 3 0 0 0 3 3c1.2 0 2-.6 3-.6s1.8.6 3 .6a3 3 0 0 0 3-3c0-3-3-6-6-6z",
    pin: "M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
    wind: "M3 12h11a3 3 0 1 0-3-3 M3 18h13a3 3 0 1 1-3 3 M3 6h7a2 2 0 1 0-2-2",
    journal: "M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M9 3v18 M13 8h3 M13 12h3",
    plug: "M12 3v12 M7 10l5 5 5-5 M5 21h14",
    search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20 20l-3.5-3.5",
    sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4",
    moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
    menu: "M4 7h16 M4 12h16 M4 17h16",
    x: "M6 6l12 12 M18 6 6 18",
    chevron: "m9 6 6 6-6 6",
    check: "m5 12 5 5L20 7",
    alert: "M12 9v4 M12 17h.01 M10.3 3.9 2.5 17.5A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
    arrow: "M5 12h14 M13 6l6 6-6 6",
    account: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 13a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M6 19.5a7 7 0 0 1 12 0",
    layers: "m12 3 9 5-9 5-9-5 9-5z M3 13l9 5 9-5 M3 17l9 5 9-5",
    clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 7v5l3 2",
    bone: "M7.5 9.5 14.5 16.5 M9.5 7.5 16.5 14.5 M8.5 8.5a2.5 2.5 0 1 0-3.5-3.5 2.5 2.5 0 1 0-3.5 3.5 2.5 2.5 0 0 0 3.5 0 2.5 2.5 0 0 0 3.5 0z M15.5 15.5a2.5 2.5 0 1 1 3.5 3.5 2.5 2.5 0 1 1 3.5-3.5 2.5 2.5 0 0 1-3.5 0 2.5 2.5 0 0 1-3.5 0z",
    bag: "M5 8h14l-1 12H6L5 8z M9 8V6a3 3 0 0 1 6 0v2 M9 11v1 M15 11v1",
    sparkle: "M12 3v4 M12 17v4 M3 12h4 M17 12h4 M6.5 6.5l2.5 2.5 M15 15l2.5 2.5 M6.5 17.5 9 15 M15 9l2.5-2.5",
  } as const;
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class={cls}><path d={paths[name]} /></svg>
