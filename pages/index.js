/* Node Dependencies */
import React from 'react';
import Image from 'next/image';

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
                      <Image src={MyImage} layout='fill' alt="This is my personal image" title="tarik-sahni" aria-hidden="true"
                             role="presentation"/>
                  </div>
                  <div className="home-page-details">
                      <div className="image-container-mobile">
                          <Image src={MyImage} alt="This is my personal image" title="tarik-sahni" aria-hidden="true"
                                 role="presentation"/>
                      </div>
                      <div className="intro-section">
                          <h6 className="open-sans-font upper-case hi-text fs-3 fw-normal">Hi there ! &#128075;</h6>
                          <h1 className="yellow-color poppins-font upper-case fw-bold fs-5">
                              <span className="my-details white-color">{`I'm `}</span>
                              Tarik Sahni
                          </h1>
                          <p className="open-sans-font white-color fs-2 description-text">Creative and self-starting
                              Front-End Developer with 4+ years experience building stable E2E websites and apps in
                              fast-paced, collaborative environments with great performance and SEO. Highly skilled in
                              HTML/CSS/JavaScript and working knowledge of Web frameworks. Well-versed in Scrum and
                              Agile.</p>
                          <div className="about-me-container yellow-color-background">
                              <a href={MyResume} download={'Tarik_Sahni_FE_Resume'} className="download-pdf-anchor"><span
                                  className="black-color upper-case fs-2  fw-bold open-sans-font">Download Resume &nbsp; 💻</span></a>
                          </div>
                          <div className="about-me-container mt-2 yellow-color-background cursor-pointer">
                              <span className="black-color upper-case fs-2  fw-bold open-sans-font">{`Let's connect on blockchain Ξ`}</span>
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
