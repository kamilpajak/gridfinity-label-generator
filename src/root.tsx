import {component$} from '@builder.io/qwik';
import {QwikCityProvider, RouterOutlet} from '@builder.io/qwik-city';
import './index.css';

export default component$(() => {
    return (
        <QwikCityProvider>
            <head>
                <meta charSet="utf-8"/>
                <title>DIN Label Generator</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                <link rel="icon" type="image/svg+xml" href="/vite.svg"/>
                <link
                    href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;900&family=Oswald:wght@400;700&display=swap"
                    rel="stylesheet"/>
            </head>
            <body>
            <RouterOutlet/>
            </body>
        </QwikCityProvider>
    );
});