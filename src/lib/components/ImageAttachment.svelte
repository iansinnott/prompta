<script lang="ts">
  import { XCircle, Image, Camera } from "lucide-svelte";
  import { attachedImage } from "$lib/stores/stores";
  import { processImageForAI } from "$lib/utils";
  import { toast } from "$lib/toast";

  async function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
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
    } finally {
      // Reset input so the same file can be selected again
      input.value = "";
    }
  }

  async function captureImage() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not get canvas context");

      context.drawImage(video, 0, 0);

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.8)
      );

      const file = new File([blob], "captured-image.jpg", { type: "image/jpeg" });
      const processed = await processImageForAI(file);

      attachedImage.set(processed);

      stream.getTracks().forEach((track) => track.stop());
    } catch (error) {
      console.error("Error capturing image:", error);
      toast({
        type: "error",
        title: "Error capturing image",
        message: error instanceof Error ? error.message : "Could not access camera",
      });
    }
  }
</script>

<div class="flex items-center space-x-2">
  <input
    type="file"
    accept="image/*"
    class="hidden"
    id="image-upload"
    on:change={handleFileSelect}
  />

  <label for="image-upload" class="cursor-pointer p-2 hover:bg-zinc-700 rounded-lg">
    <Image class="w-5 h-5" />
  </label>

  <button class="p-2 hover:bg-zinc-700 rounded-lg" on:click={captureImage}>
    <Camera class="w-5 h-5" />
  </button>

  {#if $attachedImage}
    <div class="relative">
      <img src={$attachedImage.base64} alt="Attached" class="w-12 h-12 object-cover rounded" />
      <button
        class="absolute -top-2 -right-2 bg-zinc-800 rounded-full"
        on:click={() => attachedImage.set(null)}
      >
        <XCircle class="w-4 h-4" />
      </button>
    </div>
  {/if}
</div>
