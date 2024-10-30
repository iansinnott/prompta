<script lang="ts">
  import { XCircle, Image } from "lucide-svelte";
  import { attachedImage } from "$lib/stores/stores";
  import { processImageForAI } from "$lib/utils";
  import { toast } from "$lib/toast";
  import { getSystem } from "$lib/gui";

  const sys = getSystem();

  async function handleFileSelect(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const result = await sys.chooseAndOpenImageFile();
      if (!result) return;

      const file = new File([result.data], result.name, {
        type: result.name.endsWith(".svg") ? "image/svg+xml" : "image/jpeg", // fallback type
      });

      const processed = await processImageForAI(file);
      attachedImage.set(processed);
    } catch (error) {
      console.error("Error processing file:", error);
      toast({
        type: "error",
        title: "Error processing image",
        message:
          error instanceof Error ? error.message : "Could not process the selected image file",
      });
    }
  }
</script>

<div class="flex items-end pb-[2px] space-x-2 h-auto pr-[2px] border-r border-zinc-700 relative">
  <button
    type="button"
    class="cursor-pointer p-2 hover:bg-zinc-700 rounded-lg !ml-[2px]"
    on:click={handleFileSelect}
  >
    <Image class="w-5 h-5" />
  </button>

  {#if $attachedImage}
    <div class="absolute left-full bottom-[calc(100%+8px)] w-20 h-20 drop-shadow-lg">
      <img
        src={$attachedImage.base64}
        alt="Attached"
        class="w-full h-full object-cover rounded-lg"
      />
      <button
        class="absolute -top-2 -right-2 bg-zinc-800 rounded-full"
        on:click={() => attachedImage.set(null)}
      >
        <XCircle class="w-4 h-4" />
      </button>
    </div>
  {/if}
</div>
