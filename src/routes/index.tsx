import { component$ } from "@builder.io/qwik";
import { type DocumentHead } from "@builder.io/qwik-city";
import { DINLabelGenerator } from "~/components/din-label-generator/din-label-generator";

export default component$(() => {
  return (
    <div class="min-h-screen bg-[#F8FAFC] py-8">
      <div class="container mx-auto px-4">
        <h1 class="text-4xl font-bold text-center text-gray-800 mb-8">
          Gridfinity Label Generator
        </h1>
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
      content: "Generate labels for Gridfinity storage system",
    },
  ],
};
