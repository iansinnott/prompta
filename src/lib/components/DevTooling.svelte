<!-- 
  This is a dev component that exposes some useful things to the window for
  debugging. It's ALSO included in the prod build, since it's useful there as well.
-->
<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import {
    ChatMessage,
    DatabaseMeta,
    Fragment,
    Preferences,
    Thread,
    LLMProvider,
    _clearDatabase,
    _get_db_instance,
  } from "$lib/db";
  import { currentChatThread, currentThread, insertPendingMessage } from "$lib/stores/stores";
  import { featureFlags } from "$lib/featureFlags";

  onMount(() => {
    // This used to be locked behind a dev flag but I find it useful to have access to it for debugging in the prod app.
    for (const [k, v] of [
      ["Thread", Thread],
      ["ChatMessage", ChatMessage],
      ["DatabaseMeta", DatabaseMeta],
      ["Preferences", Preferences],
      ["Fragment", Fragment],
      ["LLMProvider", LLMProvider],
      ["db", _get_db_instance()],
      ["featureFlags", featureFlags],
      [
        "insertPendingMessage",
        ({ content = "" }) => {
          insertPendingMessage({
            threadId: $currentThread.id,
            content,
            model: "nousresearch/nous-capybara-7b",
          });
        },
      ],
    ]) {
      // @ts-expect-error
      (window as any)[k] = v;
    }

    // Dev only
    for (const [k, v] of [["_clearDatabase", _clearDatabase]]) {
      // @ts-expect-error Just for dev, and the error is not consequential
      (window as any)[k] = v;
    }
  });
</script>
