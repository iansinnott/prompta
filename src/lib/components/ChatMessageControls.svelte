<script lang="ts">
  import classNames from "classnames";
  import CopyButton from "./CopyButton.svelte";
  import type { ChatMessage } from "$lib/db";
  import { ThumbsUp, ThumbsDown, Pencil, Trash, Check, X } from "lucide-svelte";
  import { currentChatThread, currentlyEditingMessage } from "$lib/stores/stores";
  import { toast } from "$lib/toast";
  let _class: string = "";
  export { _class as class };
  export let item: ChatMessage;

  $: isEditing = $currentlyEditingMessage?.id === item.id;
</script>

<div class={classNames("flex space-x-3 items-center", _class)}>
  {#if item.cancelled}
    <div class="text-zinc-400 text-xs">Cancelled</div>
  {/if}
  <div
    class={classNames("flex space-x-3 group-hover:opacity-100", {
      "opacity-0": !isEditing, // Do not hide the controls when editing
    })}
  >
    <!-- Although this is not a big deal, i want to refactor this so that the item
         content isn't copied over to the copy button until clicked -->
    <CopyButton
      size="18px"
      class="text-white/40 hover:text-white outline-none"
      text={item.content}
    />
    <button
      type="button"
      class=""
      on:click={() => {
        console.log("editing", item.id);
        if (isEditing) {
          $currentlyEditingMessage = null;
        } else {
          $currentlyEditingMessage = {
            id: item.id,
            content: item.content,
          };
        }
      }}
    >
      <Pencil
        class={classNames("w-[18px] h-[18px] ", {
          "text-white/40 hover:text-white": !isEditing,
          "text-white": isEditing,
        })}
      />
    </button>

    {#if isEditing}
      <button
        on:click={async () => {
          if (!$currentlyEditingMessage) {
            console.warn("No message to update");
            return;
          }

          await currentChatThread.updateMessage(item.id, {
            content: $currentlyEditingMessage.content,
          });
          $currentlyEditingMessage = null;
          toast({
            type: "success",
            title: "Message updated",
          });
        }}
      >
        <Check class="w-[18px] h-[18px] text-green-400" />
      </button>
      <button
        on:click={async () => {
          $currentlyEditingMessage = null;
        }}
      >
        <X class="w-[18px] h-[18px] text-red-300" />
      </button>
    {/if}

    <!--   Hopefully this makes it harder to accidentally click delete. Currently no confirmation     -->
    <div class="px-2 !text-white/10 pointer-events-none">{"|"}</div>

    <button
      disabled={isEditing}
      class={classNames("ml-12", {
        "pointer-events-none": isEditing,
      })}
      on:click={async () => {
        await currentChatThread.softDeleteMessage({ id: item.id });
        toast({
          type: "success",
          title: "Message deleted",
        });
      }}
    >
      <Trash class="w-[18px] h-[18px] text-white/40 hover:text-red-500" />
    </button>
  </div>
</div>
