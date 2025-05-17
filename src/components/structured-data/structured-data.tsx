import { component$ } from '@builder.io/qwik'

export interface StructuredDataProps {
  type?: 'webApplication' | 'softwareApplication'
}

export const StructuredData = component$<StructuredDataProps>(() => {
  const baseStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Gridfinity Label Generator',
    url: 'https://gridfinitylabels.com',
    description:
      'Create custom labels for Gridfinity storage system. Generate labels for screws, nuts, washers with DIN/ISO standards support.',
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    creator: {
      '@type': 'Person',
      name: 'Kamil Pająk',
    },
    datePublished: '2024-01-01',
    dateModified: new Date().toISOString().split('T')[0],
    keywords:
      'gridfinity, label generator, storage labels, hardware labels, DIN standards, ISO standards, screw labels, nut labels, washer labels',
    inLanguage: 'en',
    isAccessibleForFree: true,
    screenshot: 'https://gridfinitylabels.com/og-image.png',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '150',
      bestRating: '5',
    },
  }

  const breadcrumbStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://gridfinitylabels.com',
      },
    ],
  }

  const websiteStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Gridfinity Label Generator',
    url: 'https://gridfinitylabels.com',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://gridfinitylabels.com/?search={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  }

  // Directly return script tags with JSON as text content
  const baseDataString = JSON.stringify(baseStructuredData)
  const breadcrumbDataString = JSON.stringify(breadcrumbStructuredData)
  const websiteDataString = JSON.stringify(websiteStructuredData)

  return (
    <>
      <script type="application/ld+json">{baseDataString}</script>
      <script type="application/ld+json">{breadcrumbDataString}</script>
      <script type="application/ld+json">{websiteDataString}</script>
    </>
  )
})
