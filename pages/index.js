/* Node Dependencies */
import React from 'react';
import Link from 'next/link';

/* Components */
import SocialMedia from 'Components/socialMedia';

const HomePage = () => {
  return (
      <>
          <section className="main-container">
              <a href="https://www.headout.com/" target="_blank" rel="noreferrer" className="watermark-single-link">
                  <img src="/images/headout-logo.png" alt="Headout" className="watermark-single" />
              </a>
              <div className="image-frame" style={{backgroundColor: '#B482F5'}} />
              <div className="content-container">
                  <div className="image-container">
                      <img src="/images/Tarik_Shillong.jpg" alt="Tarik Sahni" title="tarik-sahni" aria-hidden="true"
                             role="presentation" style={{width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0}}/>
                  </div>
                  <div className="home-page-details">
                      <div className="image-container-mobile">
                          <img src="/images/Tarik_Shillong.jpg" alt="Tarik Sahni" title="tarik-sahni" aria-hidden="true"
                                 role="presentation" style={{width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0}}/>
                      </div>
                      <div className="intro-section">
                          <h6 className="open-sans-font upper-case hi-text fs-3 fw-normal">Hi there ! &#128075; 🇮🇳</h6>
                          <h1 className="yellow-color poppins-font upper-case fw-bold fs-5" style={{marginBottom: '0.6em'}}>
                              <span className="my-details white-color">{`I'm `}</span>
                              Tarik Sahni
                          </h1>
                          <div className="headout-brand">
                              <img src="/images/headout-logo.png" width="36" height="36" alt="Headout" className="headout-logo" />
                              <span className="open-sans-font white-color fs-2">Engineering Manager at <a href="https://www.headout.com/" target="_blank" rel="noreferrer" className="headout-link">Headout</a></span>
                          </div>
                          <p className="open-sans-font white-color fs-2 description-text">{"Headout is home to the world's best real-life experiences - from expert-led tours to incredible landmarks, activities, events, and everything in between."}<br/><br/>{"I manage the mobile (Android & iOS), checkout, and post-booking engineering teams, building systems that help millions discover, book, and manage experiences worldwide."}</p>
                          <div className="app-store-links">
                              <a href={'https://www.headout.com/'} target={'_blank'} rel="noreferrer" className="store-badge store-badge-primary">
                                  <img src="/images/headout-logo.png" width="20" height="20" alt="" className="headout-logo" />
                                  <span>Explore Headout</span>
                              </a>
                              <a href={'https://play.google.com/store/apps/details?id=com.tourlandish.chronos&hl=en_IN'} target={'_blank'} rel="noreferrer" className="store-badge">
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.61 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/></svg>
                                  <span>Google Play</span>
                              </a>
                              <a href={'https://apps.apple.com/us/app/headout-travel-experiences/id899327000'} target={'_blank'} rel="noreferrer" className="store-badge">
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71,19.5C17.88,20.5 17,21.42 15.66,21.43C14.32,21.45 13.87,20.62 12.35,20.62C10.83,20.62 10.33,21.42 9.05,21.45C7.75,21.48 6.76,20.44 5.92,19.44C4.22,17.39 2.95,13.67 4.71,11.11C5.58,9.84 6.97,9.05 8.46,9.03C9.75,9.01 10.96,9.92 11.74,9.92C12.51,9.92 13.98,8.82 15.56,9C16.23,9.03 17.93,9.27 19.02,10.87C18.9,10.95 16.65,12.27 16.67,15.02C16.7,18.31 19.54,19.35 19.58,19.36C19.55,19.43 19.19,20.57 18.71,19.5ZM13,3.5C13.73,2.67 14.94,2.04 15.94,2C16.07,3.17 15.6,4.35 14.9,5.19C14.21,6.04 13.07,6.7 11.95,6.61C11.8,5.46 12.36,4.26 13,3.5Z"/></svg>
                                  <span>App Store</span>
                              </a>
                          </div>
                      </div>
                  </div>
              </div>
          </section>
          <SocialMedia />
      </>

  )
}

export default HomePage;
