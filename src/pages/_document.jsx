import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Cinzel:wght@400;600;700&family=Crimson+Text:ital,wght@0,400;0,600;1,400;1,600&family=Bebas+Neue&family=Share+Tech+Mono&display=swap"
          rel="stylesheet"
        />

        {/* Favicons */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="16x16"  href="/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32"  href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="48x48"  href="/favicon-48x48.png" />
        <link rel="icon" type="image/png" sizes="64x64"  href="/favicon-64x64.png" />
        <link rel="apple-touch-icon"       sizes="180x180" href="/favicon-180x180.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/favicon-512x512.png" />

        <meta name="theme-color" content="#080808" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
