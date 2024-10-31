<script lang="ts">
  import { getSystem } from "$lib/gui";

  export let imageUrl: string;
  export let showControls: boolean = false;

  const sys = getSystem();

  async function downloadImage(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    try {
      const isDataUri = imageUrl.startsWith("data:");
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      const extension = blob.type.split("/")[1] || "png";

      const fileName = isDataUri
        ? `image-${new Date().getTime()}.${extension}`
        : imageUrl.split("/").pop() || `image.${extension}`;

      await sys.saveAs(fileName, blob);
    } catch (error) {
      console.error("Error downloading image:", error);
    }
  }
</script>

<div class="relative table">
  <img
    src={imageUrl}
    class="max-w-sm max-h-[200px] rounded-lg my-2 object-contain bg-zinc-900/50"
  />
  {#if showControls}
    <button
      on:click|stopPropagation={downloadImage}
      class="absolute top-4 right-2 p-2 rounded-md bg-zinc-900/90 text-zinc-100
             border border-zinc-700 shadow-lg hover:bg-zinc-600"
      title="Download image"
      aria-label="Download image"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
          clip-rule="evenodd"
        />
      </svg>
    </button>
  {/if}
</div>
