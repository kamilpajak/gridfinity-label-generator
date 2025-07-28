import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { url } = await request.json();

		if (!url) {
			return json({ error: 'URL is required' }, { status: 400 });
		}

		// Validate URL format
		try {
			new URL(url);
		} catch {
			return json({ error: 'Invalid URL format' }, { status: 400 });
		}

		// Call TinyURL API
		const response = await fetch(
			`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`,
			{
				method: 'GET'
			}
		);

		if (!response.ok) {
			return json({ error: 'Failed to shorten URL' }, { status: 500 });
		}

		const shortUrl = await response.text();

		// Validate response is a valid URL
		try {
			new URL(shortUrl);
		} catch {
			return json({ error: 'Invalid response from TinyURL' }, { status: 500 });
		}

		return json({ shortUrl });
	} catch (error) {
		console.error('URL shortening error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
