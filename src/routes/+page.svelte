<script lang="ts">
	import * as Card from "$lib/components/ui/card";
	import * as Tabs from "$lib/components/ui/tabs";
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
			<Card.Root>
				<Card.Header>
					<Card.Title>Single Label</Card.Title>
					<Card.Description>Create one label at a time</Card.Description>
				</Card.Header>
				<Card.Content>
					<!-- Placeholder for Single Label content -->
					<p class="text-muted-foreground">Single Label configuration will go here</p>
				</Card.Content>
			</Card.Root>
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
