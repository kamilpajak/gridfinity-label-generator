<script lang="ts">
	import * as Card from "$lib/components/ui/card";
	import * as Tabs from "$lib/components/ui/tabs";
	import { Switch } from '$lib/components/ui/switch';
	import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group';
	import { Input } from '$lib/components/ui/input';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { Slider } from '$lib/components/ui/slider';
	
	let showStandard = $state(false);
	let showHardwareImage = $state(false);
	let showQRCode = $state(false);
	
	let hardwareType = $state('screw');
	let screwType = $state('bolt');
	let measurementSystem = $state('metric');
	
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
							<Card.Title>Hardware Configuration</Card.Title>
						</Card.Header>
						<Card.Content class="space-y-4">
							<div class="grid grid-cols-3 gap-2">
								<ToggleGroup bind:value={hardwareType} variant="outline" type="single" size="lg" class="w-full">
									<ToggleGroupItem value="screw">Screw</ToggleGroupItem>
									<ToggleGroupItem value="nut">Nut</ToggleGroupItem>
									<ToggleGroupItem value="washer">Washer</ToggleGroupItem>
								</ToggleGroup>
								
								<ToggleGroup bind:value={screwType} variant="outline" type="single" size="lg" disabled={hardwareType === 'nut' || hardwareType === 'washer'} class="w-full">
									<ToggleGroupItem value="bolt">Bolt</ToggleGroupItem>
									<ToggleGroupItem value="screw">Screw</ToggleGroupItem>
								</ToggleGroup>
								
								<ToggleGroup bind:value={measurementSystem} variant="outline" type="single" size="lg" class="w-full">
									<ToggleGroupItem value="metric">Metric</ToggleGroupItem>
									<ToggleGroupItem value="imperial">Imperial</ToggleGroupItem>
								</ToggleGroup>
							</div>
							
							<div class="grid grid-cols-2 gap-4 mt-4">
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
									<Input id="length" placeholder={lengthPlaceholder} disabled={hardwareType === 'nut' || hardwareType === 'washer'} class="w-full" />
								</div>
							</div>
							
							<div class="grid grid-cols-2 gap-4 mt-4">
								<div>
									<Select type="single">
										<SelectTrigger class="w-full">
											Select ISO/DIN standard
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="iso4762">ISO 4762 - Socket Head Cap Screw</SelectItem>
											<SelectItem value="din912">DIN 912 - Socket Head Cap Screw</SelectItem>
											<SelectItem value="iso14579">ISO 14579 - Socket Head Screw</SelectItem>
											<SelectItem value="iso10642">ISO 10642 - Countersunk Head Screw</SelectItem>
											<SelectItem value="din7991">DIN 7991 - Countersunk Head Screw</SelectItem>
											<SelectItem value="iso4026">ISO 4026 - Set Screw</SelectItem>
											<SelectItem value="din913">DIN 913 - Set Screw</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div>
									<Input placeholder="Optional note" class="w-full" />
								</div>
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
