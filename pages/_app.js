/* Node Dependencies */
import React from 'react';
import Head from 'next/head';

/* Styles */
import '../styles/globals.css';

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>Tarik Sahni - Engineering Manager</title>
        <meta name="description" content="Tarik Sahni — Engineering Manager at Headout. Leading teams that build world-class experiences for millions." />
      </Head>
      <Component {...pageProps} />
    </>
  )
}

export default MyApp;
