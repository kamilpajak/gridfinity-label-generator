import { component$ } from '@builder.io/qwik'
import { type DocumentHead, Link } from '@builder.io/qwik-city'

export default component$(() => {
  return (
    <div class="min-h-screen flex items-center justify-center bg-gray-50">
      <div class="text-center p-8">
        <h1 class="text-9xl font-bold text-gray-800">404</h1>
        <p class="text-2xl font-semibold text-gray-600 mt-4">Page Not Found</p>
        <p class="text-gray-500 mt-2 mb-8">
          Sorry, the page you're looking for doesn't exist or has been moved.
        </p>

        <div class="space-y-4">
          <Link
            href="/"
            class="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Go to Homepage
          </Link>

          <div class="mt-6">
            <p class="text-gray-500 mb-2">Or try these helpful links:</p>
            <div class="space-x-4">
              <Link href="/" class="text-blue-600 hover:underline">
                Create Label
              </Link>
              <a
                href="https://github.com/kamilpajak/gridfinity-label-generator"
                class="text-blue-600 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>

        <div class="mt-12 text-gray-400">
          <svg
            class="mx-auto h-48 w-48"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
      </div>
    </div>
  )
})

export const head: DocumentHead = {
  title: '404 - Page Not Found | Gridfinity Label Generator',
  meta: [
    {
      name: 'description',
      content:
        'The page you are looking for could not be found. Return to Gridfinity Label Generator homepage.',
    },
    {
      name: 'robots',
      content: 'noindex, follow',
    },
  ],
}
