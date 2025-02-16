import { component$ } from "@builder.io/qwik";
import { type DocumentHead } from "@builder.io/qwik-city";
import { DINLabelGenerator } from "~/components/din-label-generator/din-label-generator";

export default component$(() => {
  return (
    <div class="min-h-screen bg-[#F8FAFC] py-8">
      <div class="container mx-auto px-4">
        <DINLabelGenerator />
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Gridfinity Label Generator",
  meta: [
    {
      name: "description",
      content: "Beautifully Simple Labels for Your Gridfinity System",
    },
  ],
};
