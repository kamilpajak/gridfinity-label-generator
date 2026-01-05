<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import type { CustomImage } from '$lib/types/batch';
	import {
		validateImageFile,
		processImageInBrowser,
		isSvgFile,
		processImage,
		ALLOWED_TYPES
	} from '$lib/utils/image-utils';
	import ImageIcon from '@lucide/svelte/icons/image';
	import XIcon from '@lucide/svelte/icons/x';
	import LoaderIcon from '@lucide/svelte/icons/loader';

	interface Props {
		/** Current image value (for two-way binding) */
		value?: CustomImage;
		/** Callback when image changes */
		onchange?: (image: CustomImage | undefined) => void;
		/** Whether the uploader is disabled */
		disabled?: boolean;
		/** Test ID for e2e testing */
		testId?: string;
	}

	let { value = $bindable(), onchange, disabled = false, testId }: Props = $props();

	let fileInput: HTMLInputElement | null = $state(null);
	let isProcessing = $state(false);
	let error = $state<string | null>(null);
	let isDragging = $state(false);

	const acceptTypes = ALLOWED_TYPES.join(',');

	async function handleFile(file: File) {
		error = null;
		isProcessing = true;

		try {
			// Validate first
			const validation = validateImageFile(file);
			if (!validation.valid) {
				throw new Error(validation.error);
			}

			// Process based on file type
			let processed;
			if (isSvgFile(file)) {
				processed = await processImage(file);
			} else {
				processed = await processImageInBrowser(file);
			}

			const newImage: CustomImage = {
				data: processed.data,
				aspectRatio: processed.aspectRatio,
				originalName: processed.originalName
			};

			value = newImage;
			onchange?.(newImage);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Processing failed';
		} finally {
			isProcessing = false;
		}
	}

	function handleInputChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			handleFile(file);
		}
		// Reset input so same file can be selected again
		input.value = '';
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;

		if (disabled || isProcessing) return;

		const file = event.dataTransfer?.files?.[0];
		if (file) {
			handleFile(file);
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (!disabled && !isProcessing) {
			isDragging = true;
		}
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function handleRemove() {
		value = undefined;
		onchange?.(undefined);
		error = null;
	}

	function openFileDialog() {
		fileInput?.click();
	}
</script>

<div class="space-y-2" data-testid={testId}>
	<!-- Hidden file input -->
	<input
		bind:this={fileInput}
		type="file"
		accept={acceptTypes}
		class="hidden"
		onchange={handleInputChange}
		{disabled}
		data-testid={testId ? `${testId}-input` : undefined}
	/>

	{#if value}
		<!-- Preview mode -->
		<div class="relative" data-testid={testId ? `${testId}-preview` : undefined}>
			<div class="flex items-center gap-3 rounded-md border border-input bg-background p-2">
				<img
					src={value.data}
					alt={value.originalName || 'Custom image'}
					class="h-12 w-12 rounded object-contain"
					data-testid={testId ? `${testId}-thumbnail` : undefined}
				/>
				<div class="min-w-0 flex-1">
					<p
						class="truncate text-sm font-medium"
						data-testid={testId ? `${testId}-filename` : undefined}
					>
						{value.originalName || 'Custom image'}
					</p>
					<p class="text-xs text-muted-foreground">
						{value.aspectRatio.toFixed(2)} aspect ratio
					</p>
				</div>
				<Button
					variant="ghost"
					size="icon"
					class="h-8 w-8 shrink-0"
					onclick={handleRemove}
					{disabled}
					data-testid={testId ? `${testId}-remove` : undefined}
				>
					<XIcon class="h-4 w-4" />
					<span class="sr-only">Remove image</span>
				</Button>
			</div>
		</div>
	{:else}
		<!-- Upload mode -->
		<button
			type="button"
			class="flex w-full cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-input p-4 text-center transition-colors hover:border-primary hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-50 {isDragging
				? 'border-primary bg-accent/50'
				: ''}"
			onclick={openFileDialog}
			ondrop={handleDrop}
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			disabled={disabled || isProcessing}
			data-testid={testId ? `${testId}-dropzone` : undefined}
		>
			{#if isProcessing}
				<LoaderIcon class="mb-2 h-8 w-8 animate-spin text-muted-foreground" />
				<span class="text-sm text-muted-foreground">Processing...</span>
			{:else}
				<ImageIcon class="mb-2 h-8 w-8 text-muted-foreground" />
				<span class="text-sm text-muted-foreground">Drop image or click to upload</span>
			{/if}
		</button>
	{/if}

	{#if error}
		<p class="text-sm text-destructive" data-testid={testId ? `${testId}-error` : undefined}>
			{error}
		</p>
	{/if}
</div>
