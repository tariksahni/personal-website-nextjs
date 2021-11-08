/* Node Dependencies */
import React from 'react';
import Head from 'next/head';

/* Styles */
import '../styles/globals.css';

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>Tarik Sahni - Front-end Engineer</title>
      </Head>
      <Component {...pageProps} />
    </>
  )
}

export default MyApp;
