<script lang="ts">
  import FollowListPage from "$lib/components/FollowListPage.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<FollowListPage kind="followers" {data} />
