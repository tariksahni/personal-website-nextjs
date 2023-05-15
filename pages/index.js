/* Node Dependencies */
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

/* Components */
import SocialMedia from 'Components/socialMedia';

/* Constants */
import MyImage from 'Static/images/Tarik.jpg';
import MyResume from 'Static/pdf/Tarik.pdf';

const HomePage = () => {
  return (
      <>
          <section className="main-container">
              <div className="image-frame yellow-color-background" />
              <div className="content-container">
                  <div className="image-container">
                      <Image src={MyImage} priority layout='fill' placeholder={'blur'} alt="This is my personal image" title="tarik-sahni" aria-hidden="true"
                             role="presentation"/>
                  </div>
                  <div className="home-page-details">
                      <div className="image-container-mobile">
                          <Image src={MyImage} priority alt="This is my personal image" title="tarik-sahni" aria-hidden="true"
                                 role="presentation"/>
                      </div>
                      <div className="intro-section">
                          <h6 className="open-sans-font upper-case hi-text fs-3 fw-normal">Hi there ! &#128075; 🇮🇳</h6>
                          <h1 className="yellow-color poppins-font upper-case fw-bold fs-5">
                              <span className="my-details white-color">{`I'm `}</span>
                              Tarik Sahni
                          </h1>
                          <p className="open-sans-font white-color fs-2 description-text">{"I am a founding member at Investmint, India's first signal-based trading app. Investmint makes trading and investing effortless for everyone. Whether you are an experienced investor, or a curious newcomer, with actionable signals from data-driven trading models, anyone can start in the stock market right from day one."}</p>
                          <div className="about-me-container yellow-color-background">
                              <a href={'https://www.investmint.club/'} target={'_blank'} rel="noreferrer"  className="download-pdf-anchor"><span
                                  className="black-color upper-case fs-2  fw-bold open-sans-font">Explore Investmint</span></a>
                          </div>
                          <Link href={'/connect'}>
                              <div className="about-me-container mt-2 yellow-color-background cursor-pointer">
                                  <span className="black-color upper-case fs-2  fw-bold open-sans-font">{`Let's connect`}</span>
                              </div>
                          </Link>
                      </div>
                  </div>
              </div>
          </section>
          <SocialMedia />
      </>

  )
}

export default HomePage;
