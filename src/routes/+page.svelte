<script lang="ts">
	import * as Card from "$lib/components/ui/card";
	import * as Tabs from "$lib/components/ui/tabs";
	import { Switch } from '$lib/components/ui/switch';
	import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group';
	import { Input } from '$lib/components/ui/input';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { Slider } from '$lib/components/ui/slider';
	import * as Command from "$lib/components/ui/command";
	import * as Popover from "$lib/components/ui/popover";
	import { Button } from "$lib/components/ui/button";
	import CheckIcon from "@lucide/svelte/icons/check";
	import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
	import { standards, formatDesignations } from '$lib/data/standards';
	import { tick } from "svelte";
	import { cn } from "$lib/utils";
	
	let showStandard = $state(false);
	let showHardwareImage = $state(false);
	let showQRCode = $state(false);
	
	let labelMode = $state('standard');
	let measurementSystem = $state('metric');
	
	let measurementSystemDisabled = $derived(labelMode !== 'standard');
	
	// Store previous values
	let previousLabelMode = 'standard';
	let previousMeasurementSystem = 'metric';
	
	// Ensure exactly one value is always selected
	$effect(() => {
		if (!labelMode || labelMode === '') {
			labelMode = previousLabelMode;
		} else {
			previousLabelMode = labelMode;
		}
	});
	
	$effect(() => {
		if (!measurementSystem || measurementSystem === '') {
			measurementSystem = previousMeasurementSystem;
		} else {
			previousMeasurementSystem = measurementSystem;
		}
	});
	
	let lengthPlaceholder = $derived(
		measurementSystem === 'metric' 
			? 'Length in mm (e.g., 10, 25)' 
			: 'Length in inches (e.g., 1/4, 3/8)'
	);
	
	let threadSizePlaceholder = $derived(
		measurementSystem === 'metric'
			? 'Thread size (e.g., M3, M5)'
			: 'Thread size (e.g., #4-40, 1/4-20)'
	);
	
	let labelHeight = $state('12');
	let labelWidth = $state(35);
	
	let standardsOpen = $state(false);
	let selectedStandardId = $state('');
	
	const standardsWithImages = $derived(
		standards.filter((s) => s.image)
	);
	
	const selectedStandard = $derived(
		standards.find((s) => s.id === selectedStandardId)
	);
	
	function closeStandardsAndFocusTrigger() {
		standardsOpen = false;
	}
</script>

<svelte:head>
	<title>Gridfinity Label Generator</title>
	<meta name="description" content="Print-Ready Labels for Your Gridfinity System" />
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<!-- Hero Section -->
	<div class="text-center mb-8">
		<h1 class="text-4xl font-bold mb-2">Gridfinity Label Generator</h1>
		<p class="text-xl text-muted-foreground">Print-Ready Labels for Your Gridfinity System</p>
	</div>

	<!-- Tabs Component -->
	<Tabs.Root value="single" class="w-full max-w-6xl mx-auto">
		<Tabs.List class="grid w-full grid-cols-2">
			<Tabs.Trigger value="single">Single Label</Tabs.Trigger>
			<Tabs.Trigger value="batch">Batch Mode</Tabs.Trigger>
		</Tabs.List>
		
		<Tabs.Content value="single" class="mt-6">
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<div class="lg:col-span-2">
					<Card.Root>
						<Card.Header>
							<Card.Title>Label Content</Card.Title>
						</Card.Header>
						<Card.Content class="space-y-4">
							<div class="flex flex-col gap-4 sm:grid sm:grid-cols-2">
								<ToggleGroup bind:value={labelMode} variant="outline" type="single" size="default" class="w-full">
									<ToggleGroupItem value="standard" class="flex-1">Fastener</ToggleGroupItem>
									<ToggleGroupItem value="custom" class="flex-1">General Item</ToggleGroupItem>
								</ToggleGroup>
								
								<ToggleGroup bind:value={measurementSystem} variant="outline" type="single" size="default" class="w-full {measurementSystemDisabled ? 'opacity-50 pointer-events-none' : ''}">
									<ToggleGroupItem value="metric" class="flex-1">Metric</ToggleGroupItem>
									<ToggleGroupItem value="imperial" class="flex-1">Imperial</ToggleGroupItem>
								</ToggleGroup>
							</div>
							
							{#if labelMode === 'standard'}
								<div class="flex flex-col gap-4 sm:grid sm:grid-cols-2 mt-4">
									<div>
										<Select type="single">
											<SelectTrigger id="thread-size" class="w-full">
												{threadSizePlaceholder}
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="m3">M3</SelectItem>
												<SelectItem value="m4">M4</SelectItem>
												<SelectItem value="m5">M5</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<div>
										<Input id="length" placeholder={lengthPlaceholder} class="w-full" />
									</div>
								</div>
							{:else}
								<div class="space-y-4 mt-4">
									<Input placeholder="Primary text (e.g., Resistors 10kΩ)" class="w-full" />
									<Input placeholder="Secondary text (e.g., 1/4W ±5%)" class="w-full" />
								</div>
							{/if}
							
							{#if labelMode === 'standard'}
								<div class="space-y-4 mt-4">
									<Popover.Root bind:open={standardsOpen}>
										<Popover.Trigger>
											{#snippet child({ props })}
												<Button
													{...props}
													variant="outline"
													role="combobox"
													aria-expanded={standardsOpen}
													class="w-full justify-between font-normal"
												>
													{selectedStandard ? formatDesignations(selectedStandard) : "Select ISO/DIN standard"}
													<ChevronsUpDownIcon class="ml-2 h-4 w-4 shrink-0 opacity-50" />
												</Button>
											{/snippet}
										</Popover.Trigger>
										<Popover.Content class="w-[400px] p-0">
											<Command.Root>
												<Command.Input placeholder="Search standards..." />
												<Command.Empty>No standard with image found.</Command.Empty>
												<Command.Group class="max-h-[300px] overflow-y-auto">
													{#each standardsWithImages as standard}
														<Command.Item
															value={standard.id}
															onSelect={() => {
																selectedStandardId = standard.id;
																closeStandardsAndFocusTrigger();
															}}
															class="flex items-center justify-between"
														>
															<div class="flex items-center flex-1">
																<CheckIcon
																	class={cn(
																		"mr-2 h-4 w-4",
																		selectedStandardId !== standard.id && "text-transparent"
																	)}
																/>
																<div class="flex flex-col">
																	<span>{formatDesignations(standard)}</span>
																	<span class="text-xs text-muted-foreground">{standard.description}</span>
																</div>
															</div>
															<img 
																src={standard.image} 
																alt={formatDesignations(standard)}
																class="h-10 w-10 object-contain ml-3 flex-shrink-0"
															/>
														</Command.Item>
													{/each}
												</Command.Group>
											</Command.Root>
										</Popover.Content>
									</Popover.Root>
								</div>
							{/if}
							
							<div class="mt-4">
								<Input placeholder="Optional note" class="w-full" />
							</div>
							
							<div class="mt-4">
								<Input placeholder="QR code (URL, part number, etc.)" class="w-full" disabled={!showQRCode} />
							</div>
						</Card.Content>
					</Card.Root>
				</div>
				
				<div>
					<Card.Root>
						<Card.Header>
							<Card.Title>Label Settings</Card.Title>
						</Card.Header>
						<Card.Content class="space-y-4">
							<div class="flex items-center justify-between space-x-2">
								<div class="space-y-0.5">
									<div class="font-medium">Standard Reference</div>
									<div class="text-sm text-muted-foreground">Show ISO/DIN standard</div>
								</div>
								<Switch bind:checked={showStandard} />
							</div>
							
							<div class="flex items-center justify-between space-x-2">
								<div class="space-y-0.5">
									<div class="font-medium">Hardware Image</div>
									<div class="text-sm text-muted-foreground">Visual representation</div>
								</div>
								<Switch bind:checked={showHardwareImage} />
							</div>
							
							<div class="flex items-center justify-between space-x-2">
								<div class="space-y-0.5">
									<div class="font-medium">QR Code</div>
									<div class="text-sm text-muted-foreground">Add scannable code</div>
								</div>
								<Switch bind:checked={showQRCode} />
							</div>
							
							<div class="border-t pt-4 mt-4">
								<h4 class="font-medium mb-3">Dimensions</h4>
								
								<div class="space-y-3">
									<div>
										<div class="text-sm text-muted-foreground mb-2">Height (Brother P-Touch tape)</div>
										<ToggleGroup bind:value={labelHeight} variant="outline" type="single" class="w-full">
											<ToggleGroupItem value="9" class="flex-1">9mm</ToggleGroupItem>
											<ToggleGroupItem value="12" class="flex-1">12mm</ToggleGroupItem>
										</ToggleGroup>
									</div>
									
									<div>
										<div class="flex justify-between items-center mb-2">
											<span class="text-sm text-muted-foreground">Width</span>
											<span class="text-sm font-medium">{labelWidth}mm</span>
										</div>
										<Slider 
											bind:value={labelWidth}
											type="single"
											min={30}
											max={80}
											step={1}
											class="w-full"
										/>
									</div>
								</div>
							</div>
						</Card.Content>
					</Card.Root>
				</div>
			</div>
		</Tabs.Content>
		
		<Tabs.Content value="batch" class="mt-6">
			<Card.Root>
				<Card.Header>
					<Card.Title>Batch Mode</Card.Title>
					<Card.Description>Create multiple labels at once</Card.Description>
				</Card.Header>
				<Card.Content>
					<!-- Placeholder for Batch Mode content -->
					<p class="text-muted-foreground">Batch Mode configuration will go here</p>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>
	</Tabs.Root>
</div>
